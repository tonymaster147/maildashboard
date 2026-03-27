const db = require('../config/db');
const fs = require('fs');
const path = require('path');

/**
 * Upload files locally
 */
exports.uploadFiles = async (req, res) => {
  try {
    const files = req.files;
    const { order_id } = req.body;
    const uploaderId = req.user.id;
    const uploaderRole = req.user.role;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadedFiles = [];

    for (const file of files) {
      try {
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

        const [result] = await db.query(
          'INSERT INTO files (order_id, file_url, file_name, file_size, drive_file_id, uploaded_by, uploaded_by_role) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [order_id ? parseInt(order_id) : null, fileUrl, file.originalname, file.size, file.filename, uploaderId, uploaderRole]
        );

        uploadedFiles.push({
          id: result.insertId,
          file_name: file.originalname,
          file_url: fileUrl,
          file_size: file.size,
          drive_file_id: file.filename
        });
      } catch (uploadError) {
        console.error(`Failed to save ${file.originalname}:`, uploadError.message);
      }
    }

    res.json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload files error:', error);
    res.status(500).json({ error: 'Server error during file upload' });
  }
};

/**
 * Get files for an order
 */
exports.getOrderFiles = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [files] = await db.query(
      'SELECT * FROM files WHERE order_id = ? ORDER BY created_at DESC',
      [orderId]
    );

    res.json(files);
  } catch (error) {
    console.error('Get order files error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Delete a file
 */
exports.deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const [files] = await db.query('SELECT * FROM files WHERE id = ?', [id]);
    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete local file
    if (files[0].drive_file_id) {
      const filePath = path.join(__dirname, '..', 'uploads', files[0].drive_file_id);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete from DB
    await db.query('DELETE FROM files WHERE id = ?', [id]);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
