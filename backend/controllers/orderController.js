const db = require('../config/db');

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
