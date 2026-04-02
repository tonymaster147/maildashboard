const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sendTutorTaskEmail, sendTutorWelcomeEmail, sendSalesWelcomeEmail } = require('../services/emailService');
const { invalidateBannedWordsCache } = require('../services/contentFilter');

/**
 * Admin Dashboard Stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Run all stat queries in parallel to reduce connection hold time
    const [
      [[totalSales]],
      [[activeOrders]],
      [[completedOrders]],
      [[pendingOrders]],
      [[totalUsers]],
      [[totalTutors]],
      [[flaggedMessages]],
      [recentOrders],
      [monthlyRevenue]
    ] = await Promise.all([
      db.query('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = "completed"'),
      db.query('SELECT COUNT(*) as count FROM orders WHERE status IN ("active", "in_progress")'),
      db.query('SELECT COUNT(*) as count FROM orders WHERE status = "completed"'),
      db.query('SELECT COUNT(*) as count FROM orders WHERE status = "pending"'),
      db.query('SELECT COUNT(*) as count FROM users WHERE role = "user"'),
      db.query('SELECT COUNT(*) as count FROM tutors'),
      db.query('SELECT COUNT(*) as count FROM chats WHERE is_flagged = 1'),
      db.query(`
        SELECT o.id, o.course_name, o.total_price, o.status, o.created_at, u.username
        FROM orders o JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC LIMIT 10
      `),
      db.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount) as revenue
        FROM payments WHERE status = 'completed'
        GROUP BY month ORDER BY month DESC LIMIT 12
      `)
    ]);

    res.json({
      total_sales: totalSales.total,
      active_orders: activeOrders.count,
      completed_orders: completedOrders.count,
      pending_orders: pendingOrders.count,
      total_users: totalUsers.count,
      total_tutors: totalTutors.count,
      flagged_messages: flaggedMessages.count,
      recent_orders: recentOrders,
      monthly_revenue: monthlyRevenue.reverse()
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= USER MANAGEMENT =============
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    let query = 'SELECT id, username, email, role, is_active, created_at FROM users WHERE role = "user"';
    const params = [];
    if (search) {
      query += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [users] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM users WHERE role = "user"');
    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    res.json({ message: 'User status updated' });
  } catch (error) {
    console.error('Toggle user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= TUTOR MANAGEMENT =============
exports.getAllTutors = async (req, res) => {
  try {
    const [tutors] = await db.query(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM order_tutors WHERE tutor_id = t.id) as active_tasks,
        (SELECT COUNT(*) FROM order_tutors ot JOIN orders o ON ot.order_id = o.id WHERE ot.tutor_id = t.id AND o.status = 'completed') as completed_tasks
       FROM tutors t ORDER BY t.created_at DESC`
    );
    res.json(tutors);
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createTutor = async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;
    const [existing] = await db.query('SELECT id FROM tutors WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO tutors (name, email, password, specialization) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, specialization || null]
    );

    // Send welcome email with credentials (non-blocking)
    sendTutorWelcomeEmail(email, name, password).catch(e => console.error('Tutor welcome email error:', e));

    res.status(201).json({ message: 'Tutor created', id: result.insertId });
  } catch (error) {
    console.error('Create tutor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, specialization, status } = req.body;
    await db.query(
      'UPDATE tutors SET name = ?, email = ?, specialization = ?, status = ? WHERE id = ?',
      [name, email, specialization, status, id]
    );
    res.json({ message: 'Tutor updated' });
  } catch (error) {
    console.error('Update tutor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteTutor = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM order_tutors WHERE tutor_id = ?', [id]);
    await db.query('DELETE FROM tutors WHERE id = ?', [id]);
    res.json({ message: 'Tutor deleted' });
  } catch (error) {
    console.error('Delete tutor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= ORDER MANAGEMENT =============
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;
    let query = `
      SELECT o.*, u.username, ot.name as order_type_name, s.name as subject_name,
        p.name as plan_name, GROUP_CONCAT(DISTINCT t.name) as tutor_names,
        GROUP_CONCAT(DISTINCT t.id) as tutor_ids
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_types ot ON o.order_type_id = ot.id
      JOIN subjects s ON o.subject_id = s.id
      JOIN plans p ON o.plan_id = p.id
      LEFT JOIN order_tutors otr ON o.id = otr.order_id
      LEFT JOIN tutors t ON otr.tutor_id = t.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ' AND o.status = ?'; params.push(status); }
    if (search) { query += ' AND (o.course_name LIKE ? OR u.username LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [orders] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM orders');
    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    
    // Disable chat if completed
    if (status === 'completed') {
      await db.query('UPDATE orders SET chat_enabled = 0 WHERE id = ?', [id]);
    }

    // Notify user
    const [orders] = await db.query('SELECT user_id FROM orders WHERE id = ?', [id]);
    if (orders.length > 0) {
      await db.query(
        'INSERT INTO notifications (user_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
        [orders[0].user_id, 'user', 'order_update', `Order #${id} status: ${status}`, id, 'order']
      );
    }

    res.json({ message: 'Order status updated' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.assignTutors = async (req, res) => {
  try {
    const { id } = req.params;
    const { tutor_ids } = req.body;

    // Get order details for email
    const [orders] = await db.query(
      `SELECT o.course_name, s.name as subject_name, p.name as plan_name 
       FROM orders o 
       LEFT JOIN subjects s ON o.subject_id = s.id 
       LEFT JOIN plans p ON o.plan_id = p.id 
       WHERE o.id = ?`, [id]
    );
    const orderDetails = orders.length > 0 ? {
      orderId: id,
      courseName: orders[0].course_name,
      subject: orders[0].subject_name,
      planName: orders[0].plan_name
    } : { orderId: id };

    // Remove existing assignments
    await db.query('DELETE FROM order_tutors WHERE order_id = ?', [id]);

    // Add new assignments
    for (const tutorId of tutor_ids) {
      await db.query('INSERT INTO order_tutors (order_id, tutor_id) VALUES (?, ?)', [id, tutorId]);
      
      // Save notification to DB
      await db.query(
        'INSERT INTO notifications (tutor_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
        [tutorId, 'tutor', 'task_assigned', `New task assigned: Order #${id}`, id, 'order']
      );

      // Get tutor details for email + emit targeted socket event
      const [tutorData] = await db.query('SELECT name, email FROM tutors WHERE id = ?', [tutorId]);
      if (tutorData.length > 0) {
        const { name, email } = tutorData[0];
        
        // 1. Emit live socket evet
        const io = req.app.get('io');
        if (io) {
          io.to(`tutor_${tutorId}`).emit('tutorNewTask', { tutorId, orderId: id });
        }
        
        // 2. Send email (non-blocking)
        sendTutorTaskEmail(email, name, orderDetails).catch(e => console.error('Tutor email error:', e));
      }
    }

    // Update order status to active if pending
    await db.query('UPDATE orders SET status = "active" WHERE id = ? AND status = "pending"', [id]);

    res.json({ message: 'Tutors assigned successfully' });
  } catch (error) {
    console.error('Assign tutors error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.reopenChat = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE orders SET chat_enabled = 1 WHERE id = ?', [id]);
    res.json({ message: 'Chat reopened' });
  } catch (error) {
    console.error('Reopen chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= CHAT MONITORING =============
exports.getAllChats = async (req, res) => {
  try {
    const [chats] = await db.query(`
      SELECT DISTINCT o.id as order_id, o.course_name, u.username,
        (SELECT COUNT(*) FROM chats WHERE order_id = o.id) as message_count,
        (SELECT COUNT(*) FROM chats WHERE order_id = o.id AND is_flagged = 1) as flagged_count,
        (SELECT MAX(created_at) FROM chats WHERE order_id = o.id) as last_message_at
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE EXISTS (SELECT 1 FROM chats WHERE order_id = o.id)
      ORDER BY last_message_at DESC
    `);
    res.json(chats);
  } catch (error) {
    console.error('Get all chats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFlaggedMessages = async (req, res) => {
  try {
    const [messages] = await db.query(`
      SELECT c.*, o.course_name,
        CASE
          WHEN c.sender_role = 'user' THEN u.username
          WHEN c.sender_role = 'tutor' THEN t.name
          WHEN c.sender_role IN ('sales_lead', 'sales_executive') THEN COALESCE(su.name, 'Sales')
          ELSE 'Admin'
        END as sender_name
      FROM chats c
      JOIN orders o ON c.order_id = o.id
      LEFT JOIN users u ON c.sender_id = u.id AND c.sender_role = 'user'
      LEFT JOIN tutors t ON c.sender_id = t.id AND c.sender_role = 'tutor'
      LEFT JOIN sales_users su ON c.sender_id = su.id AND c.sender_role IN ('sales_lead', 'sales_executive')
      WHERE c.is_flagged = 1
      ORDER BY c.created_at DESC
    `);
    res.json(messages);
  } catch (error) {
    console.error('Get flagged messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= SETTINGS MANAGEMENT =============
exports.getSettings = async (req, res) => {
  try {
    const [orderTypes] = await db.query('SELECT * FROM order_types ORDER BY id');
    const [subjects] = await db.query('SELECT * FROM subjects ORDER BY name');
    const [educationLevels] = await db.query('SELECT * FROM education_levels ORDER BY id');
    const [plans] = await db.query('SELECT * FROM plans ORDER BY sort_order');
    const [coupons] = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json({ orderTypes, subjects, educationLevels, plans, coupons });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, features, is_active } = req.body;
    await db.query(
      'UPDATE plans SET name = ?, price = ?, description = ?, features = ?, is_active = ? WHERE id = ?',
      [name, price, description, JSON.stringify(features), is_active, id]
    );
    res.json({ message: 'Plan updated' });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const { code, discount_percent, max_uses, expires_at } = req.body;
    const [result] = await db.query(
      'INSERT INTO coupons (code, discount_percent, max_uses, expires_at) VALUES (?, ?, ?, ?)',
      [code.toUpperCase(), discount_percent, max_uses || null, expires_at || null]
    );
    res.status(201).json({ message: 'Coupon created', id: result.insertId });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    await db.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= NOTIFICATIONS =============
exports.getNotifications = async (req, res) => {
  try {
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE role = "admin" ORDER BY created_at DESC LIMIT 50'
    );
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= REPORTS =============
exports.getReports = async (req, res) => {
  try {
    const { 
      search, // Search by course name or order ID
      status, // payment status
      order_status, // project status
      user_id,
      tutor_id,
      start_date, // order created_at start
      end_date // order created_at end
    } = req.query;

    let query = `
      SELECT 
        o.id as order_id,
        o.course_name as project_name,
        o.status as order_status,
        o.total_price as amount,
        o.created_at as order_created_date,
        u.username as user_name,
        u.email as user_email,
        GROUP_CONCAT(DISTINCT t.name) as assigned_tutors,
        ot.name as order_type,
        s.name as subject,
        p.name as plan,
        IFNULL(pay.status, 'unpaid') as payment_status
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_types ot ON o.order_type_id = ot.id
      JOIN subjects s ON o.subject_id = s.id
      JOIN plans p ON o.plan_id = p.id
      LEFT JOIN order_tutors otr ON o.id = otr.order_id
      LEFT JOIN tutors t ON otr.tutor_id = t.id
      LEFT JOIN payments pay ON o.id = pay.order_id
      WHERE 1=1
    `;
    
    const params = [];

    // Apply filters
    if (search) {
      query += ' AND (o.course_name LIKE ? OR o.id = ?)';
      params.push(`%${search}%`, search);
    }
    
    if (status) {
      query += ' AND IFNULL(pay.status, "unpaid") = ?';
      params.push(status);
    }

    if (order_status) {
      query += ' AND o.status = ?';
      params.push(order_status);
    }
    
    if (user_id) {
      query += ' AND o.user_id = ?';
      params.push(user_id);
    }
    
    if (tutor_id) {
      query += ' AND o.id IN (SELECT order_id FROM order_tutors WHERE tutor_id = ?)';
      params.push(tutor_id);
    }
    
    if (start_date) {
      query += ' AND o.created_at >= ?';
      params.push(start_date + ' 00:00:00');
    }
    
    if (end_date) {
      query += ' AND o.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    query += ' GROUP BY o.id ORDER BY o.created_at DESC';

    const [reports] = await db.query(query, params);
    
    // Also get all users and tutors for dropdown filters
    const [filterUsers] = await db.query('SELECT id, username FROM users WHERE role = "user" ORDER BY username');
    const [filterTutors] = await db.query('SELECT id, name FROM tutors ORDER BY name');

    res.json({
      data: reports,
      meta: {
        users: filterUsers,
        tutors: filterTutors
      }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= BANNED WORDS =============
exports.getBannedWords = async (req, res) => {
  try {
    const [words] = await db.query('SELECT * FROM banned_words ORDER BY created_at DESC');
    res.json({ banned_words: words });
  } catch (error) {
    console.error('Get banned words error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.addBannedWord = async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Word is required' });
    }
    const cleanWord = word.trim().toLowerCase();
    
    await db.query('INSERT INTO banned_words (word) VALUES (?)', [cleanWord]);
    invalidateBannedWordsCache();
    res.status(201).json({ message: 'Banned word added', word: cleanWord });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This phrase is already banned' });
    }
    console.error('Add banned word error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteBannedWord = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM banned_words WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Banned word not found' });
    }
    invalidateBannedWordsCache();
    res.json({ message: 'Banned word deleted' });
  } catch (error) {
    console.error('Delete banned word error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= SALES USER MANAGEMENT =============
const AVAILABLE_MENUS = ['dashboard', 'users', 'tutors', 'orders', 'chats', 'reports', 'settings'];

exports.getAllSalesUsers = async (req, res) => {
  try {
    const [salesUsers] = await db.query(
      'SELECT id, name, email, role, status, created_at, updated_at FROM sales_users ORDER BY created_at DESC'
    );
    // Load permissions for each
    for (const su of salesUsers) {
      const [perms] = await db.query(
        'SELECT menu_key FROM sales_permissions WHERE sales_user_id = ? AND is_allowed = 1',
        [su.id]
      );
      su.permissions = perms.map(p => p.menu_key);
    }
    res.json(salesUsers);
  } catch (error) {
    console.error('Get sales users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createSalesUser = async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!['sales_lead', 'sales_executive'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const [existing] = await db.query('SELECT id FROM sales_users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO sales_users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    // Save permissions
    if (permissions && Array.isArray(permissions)) {
      for (const menuKey of permissions) {
        if (AVAILABLE_MENUS.includes(menuKey)) {
          await db.query(
            'INSERT INTO sales_permissions (sales_user_id, menu_key, is_allowed) VALUES (?, ?, 1)',
            [result.insertId, menuKey]
          );
        }
      }
    }

    // Chat is always allowed — add it explicitly
    await db.query(
      'INSERT IGNORE INTO sales_permissions (sales_user_id, menu_key, is_allowed) VALUES (?, ?, 1)',
      [result.insertId, 'sales_chat']
    );

    // Send welcome email with credentials (non-blocking)
    sendSalesWelcomeEmail(email, name, password, role).catch(e => console.error('Sales welcome email error:', e));

    res.status(201).json({ message: 'Sales user created', id: result.insertId });
  } catch (error) {
    console.error('Create sales user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateSalesUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status, permissions } = req.body;
    if (role && !['sales_lead', 'sales_executive'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    await db.query(
      'UPDATE sales_users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?',
      [name, email, role, status, id]
    );

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      await db.query('DELETE FROM sales_permissions WHERE sales_user_id = ?', [id]);
      for (const menuKey of permissions) {
        if (AVAILABLE_MENUS.includes(menuKey)) {
          await db.query(
            'INSERT INTO sales_permissions (sales_user_id, menu_key, is_allowed) VALUES (?, ?, 1)',
            [id, menuKey]
          );
        }
      }
      // Always keep sales_chat
      await db.query(
        'INSERT IGNORE INTO sales_permissions (sales_user_id, menu_key, is_allowed) VALUES (?, ?, 1)',
        [id, 'sales_chat']
      );
    }

    res.json({ message: 'Sales user updated' });
  } catch (error) {
    console.error('Update sales user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteSalesUser = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM sales_permissions WHERE sales_user_id = ?', [id]);
    await db.query('DELETE FROM sales_users WHERE id = ?', [id]);
    res.json({ message: 'Sales user deleted' });
  } catch (error) {
    console.error('Delete sales user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getSalesPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const [perms] = await db.query(
      'SELECT menu_key FROM sales_permissions WHERE sales_user_id = ? AND is_allowed = 1',
      [id]
    );
    res.json({ permissions: perms.map(p => p.menu_key), available_menus: AVAILABLE_MENUS });
  } catch (error) {
    console.error('Get sales permissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
