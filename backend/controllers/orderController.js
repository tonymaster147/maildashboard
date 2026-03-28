const db = require('../config/db');
const { sendNewOrderAdmin, sendOrderConfirmationUser } = require('../services/emailService');

/**
 * Get all order types
 */
exports.getOrderTypes = async (req, res) => {
  try {
    const [types] = await db.query('SELECT * FROM order_types WHERE is_active = 1');
    res.json(types);
  } catch (error) {
    console.error('Get order types error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get all subjects (searchable)
 */
exports.getSubjects = async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM subjects WHERE is_active = 1';
    const params = [];
    
    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY name ASC';
    const [subjects] = await db.query(query, params);
    res.json(subjects);
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get all education levels
 */
exports.getEducationLevels = async (req, res) => {
  try {
    const [levels] = await db.query('SELECT * FROM education_levels WHERE is_active = 1');
    res.json(levels);
  } catch (error) {
    console.error('Get education levels error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get all plans with pricing
 */
exports.getPlans = async (req, res) => {
  try {
    const [plans] = await db.query('SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order ASC');
    res.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create order (after successful payment)
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      order_type_id, course_name, subject_id, education_level_id,
      plan_id, additional_instructions, school_url, school_username,
      school_password, start_date, end_date, num_weeks, urgent_fee,
      coupon_code, payment_session_id
    } = req.body;

    // Get plan price
    const [plans] = await db.query('SELECT price FROM plans WHERE id = ?', [plan_id]);
    if (plans.length === 0) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    let price = parseFloat(plans[0].price);
    let urgentFee = parseFloat(urgent_fee || 0);
    let discountAmount = 0;
    let couponId = null;

    // Apply coupon if provided
    if (coupon_code) {
      const [coupons] = await db.query(
        'SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)',
        [coupon_code]
      );
      if (coupons.length > 0) {
        couponId = coupons[0].id;
        discountAmount = (price * coupons[0].discount_percent) / 100;
        await db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId]);
      }
    }

    const totalPrice = price + urgentFee - discountAmount;

    const [result] = await db.query(
      `INSERT INTO orders (user_id, order_type_id, course_name, subject_id, education_level_id, plan_id, price, urgent_fee, total_price, additional_instructions, school_url, school_username, school_password, start_date, end_date, num_weeks, coupon_id, discount_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, order_type_id, course_name, subject_id, education_level_id, plan_id, price, urgentFee, totalPrice, additional_instructions || null, school_url || null, school_username || null, school_password || null, start_date, end_date, num_weeks || 0, couponId, discountAmount]
    );

    // Create notification for admin
    await db.query(
      'INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'new_order', `New order #${result.insertId} received`, result.insertId, 'order']
    );

    res.status(201).json({
      message: 'Order created successfully',
      order_id: result.insertId,
      total_price: totalPrice
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get user's orders
 */
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT o.*, 
        ot.name as order_type_name, 
        s.name as subject_name, 
        el.name as education_level_name, 
        p.name as plan_name,
        GROUP_CONCAT(DISTINCT t.name) as tutor_names
      FROM orders o
      JOIN order_types ot ON o.order_type_id = ot.id
      JOIN subjects s ON o.subject_id = s.id
      JOIN education_levels el ON o.education_level_id = el.id
      JOIN plans p ON o.plan_id = p.id
      LEFT JOIN order_tutors otr ON o.id = otr.order_id
      LEFT JOIN tutors t ON otr.tutor_id = t.id
      WHERE o.user_id = ?
    `;
    const params = [userId];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    query += ' GROUP BY o.id ORDER BY o.created_at DESC';

    const [orders] = await db.query(query, params);
    res.json(orders);
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get single order detail
 */
exports.getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    let query = `
      SELECT o.*, 
        ot.name as order_type_name, 
        s.name as subject_name, 
        el.name as education_level_name, 
        p.name as plan_name,
        u.username
      FROM orders o
      JOIN order_types ot ON o.order_type_id = ot.id
      JOIN subjects s ON o.subject_id = s.id
      JOIN education_levels el ON o.education_level_id = el.id
      JOIN plans p ON o.plan_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `;
    const params = [id];

    // Non-admin users can only see their own orders
    if (role === 'user') {
      query += ' AND o.user_id = ?';
      params.push(userId);
    }

    const [orders] = await db.query(query, params);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Get assigned tutors
    const [tutors] = await db.query(
      `SELECT t.id, t.name FROM order_tutors otr
       JOIN tutors t ON otr.tutor_id = t.id
       WHERE otr.order_id = ?`,
      [id]
    );
    order.tutors = tutors;

    // Get files
    const [files] = await db.query('SELECT * FROM files WHERE order_id = ? ORDER BY created_at DESC', [id]);
    order.files = files;

    // Remove sensitive info for tutor role
    if (role === 'tutor') {
      delete order.school_url;
      delete order.school_username;
      delete order.school_password;
      // Only show username, not email
      delete order.email;
    }

    res.json(order);
  } catch (error) {
    console.error('Get order detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Validate coupon code
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { code } = req.body;

    const [coupons] = await db.query(
      'SELECT id, code, discount_percent FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)',
      [code]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired coupon code' });
    }

    res.json({
      valid: true,
      discount_percent: coupons[0].discount_percent
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create draft order (Step 1)
 */
exports.createDraftOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_type_id, course_name, subject_id, education_level_id, source_url } = req.body;

    const [result] = await db.query(
      `INSERT INTO orders 
       (user_id, order_type_id, course_name, subject_id, education_level_id, plan_id, price, total_price, start_date, end_date, status, source_url)
       VALUES (?, ?, ?, ?, ?, 1, 0, 0, CURDATE(), CURDATE(), 'incomplete', ?)`,
      [userId, order_type_id, course_name, subject_id, education_level_id, source_url || null]
    );

    // Fetch enriched data for email
    const [userData] = await db.query('SELECT username, email FROM users WHERE id = ?', [userId]);
    const [typeData] = await db.query('SELECT name FROM order_types WHERE id = ?', [order_type_id]);
    const [subjectData] = await db.query('SELECT name FROM subjects WHERE id = ?', [subject_id]);
    const [levelData] = await db.query('SELECT name FROM education_levels WHERE id = ?', [education_level_id]);

    const orderDetails = {
      orderId: result.insertId,
      courseName: course_name,
      username: userData[0]?.username,
      orderType: typeData[0]?.name,
      subject: subjectData[0]?.name,
      educationLevel: levelData[0]?.name,
      status: 'incomplete',
      sourceUrl: source_url
    };

    // Send emails (non-blocking)
    sendNewOrderAdmin(orderDetails).catch(e => console.error('Admin email error:', e));
    if (userData[0]?.email) {
      sendOrderConfirmationUser(userData[0].email, orderDetails).catch(e => console.error('User email error:', e));
    }

    res.status(201).json({ order_id: result.insertId, message: 'Draft order created' });
  } catch (error) {
    console.error('Create draft order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update draft order (Subsequent steps)
 */
exports.updateDraftOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    // Build dynamic update query
    let query = 'UPDATE orders SET ';
    const params = [];
    
    // Whitelist fields
    const validFields = ['start_date', 'end_date', 'num_weeks', 'plan_id', 'urgent_fee', 'additional_instructions', 'school_url', 'school_username', 'school_password', 'source_url', 'price', 'total_price', 'coupon_id', 'discount_amount'];

    validFields.forEach(field => {
      if (updateData[field] !== undefined) {
        let val = updateData[field] === '' ? null : updateData[field];
        if (field === 'plan_id' && val === null) {
          // Skip updating plan_id to null to avoid foreign key constraint errors
          return;
        }
        query += `${field} = ?, `;
        params.push(val);
      }
    });

    if (params.length > 0) {
      // Remove last comma and space
      query = query.slice(0, -2);
      
      query += ' WHERE id = ? AND user_id = ? AND status = "incomplete"';
      params.push(id, userId);

      const [result] = await db.query(query, params);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Draft order not found or unauthorized' });
      }
    }

    // Handle file associations if any
    if (updateData.temp_file_ids && updateData.temp_file_ids.length > 0) {
      for (const fileId of updateData.temp_file_ids) {
        await db.query('UPDATE files SET order_id = ? WHERE id = ?', [id, fileId]);
      }
    }

    // Send admin notification on each update (non-blocking)
    try {
      const [orderData] = await db.query(
        `SELECT o.*, u.username, ot.name as order_type_name, s.name as subject_name, el.name as education_level_name, p.name as plan_name
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN order_types ot ON o.order_type_id = ot.id
         LEFT JOIN subjects s ON o.subject_id = s.id
         LEFT JOIN education_levels el ON o.education_level_id = el.id
         LEFT JOIN plans p ON o.plan_id = p.id
         WHERE o.id = ?`, [id]
      );
      if (orderData.length > 0) {
        const od = orderData[0];
        sendNewOrderAdmin({
          orderId: id,
          courseName: od.course_name,
          username: od.username,
          orderType: od.order_type_name,
          subject: od.subject_name,
          educationLevel: od.education_level_name,
          planName: od.plan_name,
          totalPrice: od.total_price,
          sourceUrl: od.source_url,
          status: od.status
        }).catch(e => console.error('Admin update email error:', e));
      }
    } catch (emailErr) {
      console.error('Update email error:', emailErr);
    }

    res.json({ message: 'Draft order updated' });
  } catch (error) {
    console.error('Update draft order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
