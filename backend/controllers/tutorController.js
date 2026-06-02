const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { uploadToGoogleDrive } = require('../config/drive');

/**
 * Get assigned tasks for tutor
 */
exports.getTasks = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT o.id, o.order_code, o.course_name, o.status, o.start_date, o.end_date, o.num_weeks, o.chat_enabled, o.created_at,
        ot.name as order_type_name, s.name as subject_name, el.name as education_level_name,
        p.name as plan_name, u.username,
        astat.code as admin_status_code, astat.name as admin_status_name,
        tstat.code as tutor_status_code, tstat.name as tutor_status_name
      FROM orders o
      JOIN order_tutors otr ON o.id = otr.order_id
      JOIN order_types ot ON o.order_type_id = ot.id
      JOIN subjects s ON o.subject_id = s.id
      JOIN education_levels el ON o.education_level_id = el.id
      LEFT JOIN plans p ON o.plan_id = p.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN admin_statuses astat ON o.admin_status_id = astat.id
      LEFT JOIN tutor_statuses tstat ON o.tutor_status_id = tstat.id
      WHERE otr.tutor_id = ?
    `;
    const params = [tutorId];

    const { tutor_status_code } = req.query;
    if (tutor_status_code) {
      query += ' AND tstat.code = ?';
      params.push(tutor_status_code);
    } else if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC';
    const [tasks] = await db.query(query, params);

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get single task detail (for tutor, no user email shown)
 */
exports.getTaskDetail = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { id } = req.params;

    const [tasks] = await db.query(`
      SELECT o.id, o.order_code, o.course_name, o.additional_instructions, o.status, o.start_date, o.end_date,
        o.school_url, o.school_username, o.school_password, o.login_updated_at,
        o.num_weeks, o.chat_enabled, o.created_at,
        ot.name as order_type_name, s.name as subject_name, el.name as education_level_name,
        p.name as plan_name, u.username,
        astat.code as admin_status_code, astat.name as admin_status_name,
        tstat.code as tutor_status_code, tstat.name as tutor_status_name
      FROM orders o
      JOIN order_tutors otr ON o.id = otr.order_id
      JOIN order_types ot ON o.order_type_id = ot.id
      JOIN subjects s ON o.subject_id = s.id
      JOIN education_levels el ON o.education_level_id = el.id
      LEFT JOIN plans p ON o.plan_id = p.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN admin_statuses astat ON o.admin_status_id = astat.id
      LEFT JOIN tutor_statuses tstat ON o.tutor_status_id = tstat.id
      WHERE o.id = ? AND otr.tutor_id = ?
    `, [id, tutorId]);

    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[0];

    // Get files
    const [files] = await db.query('SELECT * FROM files WHERE order_id = ? ORDER BY created_at DESC', [id]);
    task.files = files;

    res.json(task);
  } catch (error) {
    console.error('Get task detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Mark task as completed
 */
exports.completeTask = async (req, res) => {
  // Back-compat wrapper — forwards to updateTutorStatus with code='completed'
  req.body = { ...req.body, tutor_status_code: 'completed' };
  return exports.updateTutorStatus(req, res);
};

/**
 * Tutor updates their own work-status (in_progress / work_stopped / completed).
 * Independent of admin_status; admin sees this read-only.
 */
exports.updateTutorStatus = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { id } = req.params;
    const { tutor_status_code } = req.body;
    if (!tutor_status_code) return res.status(400).json({ error: 'tutor_status_code is required' });

    // Verify assignment
    const [assignments] = await db.query(
      'SELECT id FROM order_tutors WHERE order_id = ? AND tutor_id = ?',
      [id, tutorId]
    );
    if (assignments.length === 0) return res.status(403).json({ error: 'Not assigned to this task' });

    const [statusRows] = await db.query('SELECT id, code FROM tutor_statuses WHERE code = ? AND is_active = 1', [tutor_status_code]);
    if (statusRows.length === 0) return res.status(400).json({ error: `Unknown tutor_status_code: ${tutor_status_code}` });
    const newStatusId = statusRows[0].id;

    // For "completed" we also disable chat and update the legacy status column
    if (tutor_status_code === 'completed') {
      await db.query('UPDATE orders SET tutor_status_id = ?, status = "completed", chat_enabled = 0 WHERE id = ?', [newStatusId, id]);
    } else {
      await db.query('UPDATE orders SET tutor_status_id = ? WHERE id = ?', [newStatusId, id]);
    }

    // Notify user only on completion
    if (tutor_status_code === 'completed') {
      const [orders] = await db.query('SELECT user_id FROM orders WHERE id = ?', [id]);
      if (orders.length > 0) {
        const ref = await require('../utils/orderCode').formatOrderRef(id);
        await db.query(
          'INSERT INTO notifications (user_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
          [orders[0].user_id, 'user', 'task_completed', `Order ${ref} has been completed`, id, 'order']
        );
      }
    }

    res.json({ message: 'Tutor status updated', tutor_status_code });
  } catch (error) {
    console.error('Update tutor status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Upload work files (tutor)
 */
exports.uploadWorkFiles = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { id } = req.params;
    const files = req.files;

    // Verify assignment
    const [assignments] = await db.query(
      'SELECT id FROM order_tutors WHERE order_id = ? AND tutor_id = ?',
      [id, tutorId]
    );
    if (assignments.length === 0) {
      return res.status(403).json({ error: 'Not assigned to this task' });
    }

    const uploadedFiles = [];
    for (const file of files) {
      try {
        const filePath = path.join(__dirname, '..', 'uploads', file.filename);
        
        let fileUrl = '';
        let fileDriveId = file.filename;
        
        try {
          // Attempt Google Drive upload
          const driveResponse = await uploadToGoogleDrive(filePath, file.originalname, file.mimetype);
          fileUrl = driveResponse.fileUrl; // Use fileUrl to open in browser instead of downloadUrl
          fileDriveId = driveResponse.fileId;
          
          // Delete local temporary file since it's on Drive now
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (driveErr) {
          console.error(`Google Drive upload failed for ${file.originalname}, falling back to local storage:`, driveErr.message);
          fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
        }
        
        const [result] = await db.query(
          'INSERT INTO files (order_id, file_url, file_name, file_size, drive_file_id, uploaded_by, uploaded_by_role) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, fileUrl, file.originalname, file.size, fileDriveId, tutorId, 'tutor']
        );
        uploadedFiles.push({ id: result.insertId, file_name: file.originalname, file_url: fileUrl });
      } catch (err) {
        console.error(`Upload failed for ${file.originalname}:`, err.message);
      }
    }

    // Notify user
    const [orders] = await db.query('SELECT user_id FROM orders WHERE id = ?', [id]);
    if (orders.length > 0) {
      const ref = await require('../utils/orderCode').formatOrderRef(id);
      await db.query(
        'INSERT INTO notifications (user_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
        [orders[0].user_id, 'user', 'file_uploaded', `New files uploaded for Order ${ref}`, id, 'order']
      );
    }

    res.json({ message: `${uploadedFiles.length} file(s) uploaded`, files: uploadedFiles });
  } catch (error) {
    console.error('Upload work files error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get tutor notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE tutor_id = ? ORDER BY created_at DESC LIMIT 50',
      [tutorId]
    );
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
