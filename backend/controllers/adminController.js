const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sendTutorTaskEmail, sendTutorWelcomeEmail, sendSalesWelcomeEmail, sendOrderStatusChangeEmail } = require('../services/emailService');
const { invalidateBannedWordsCache } = require('../services/contentFilter');
const { decryptSecret } = require('../utils/crypto');

// Sanitize a sales executive's data-window (days). Default 60, clamped 1..3650.
function clampWindowDays(v) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return 60;
  return Math.min(3650, Math.max(1, n));
}

/**
 * Admin Dashboard Stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Sales executives only see KPIs for data within their window. Build a
    // safe `AND <col> >= '<datetime>'` fragment (cutoff is a server-side Date,
    // not user input). Empty for admin / sales lead.
    const cutSql = (col) => {
      if (!req.salesCutoff) return '';
      const d = req.salesCutoff, p = n => String(n).padStart(2, '0');
      const dt = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      return ` AND ${col} >= '${dt}'`;
    };
    // Run all stat queries in parallel to reduce connection hold time
    const [
      [[totalSales]],
      [[revenueThisMonth]],
      [[activeOrders]],
      [[completedOrders]],
      [[pendingOrders]],
      [[totalUsers]],
      [[totalTutors]],
      [[flaggedMessages]],
      [[outstanding]],
      [[unassignedPaid]],
      [[workStopped]],
      [[openIssues]],
      [[overdueInstallments]],
      [recentOrders],
      [monthlyRevenue]
    ] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = "completed"${cutSql('created_at')}`),
      db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments
                WHERE status = "completed" AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')${cutSql('created_at')}`),
      db.query(`SELECT COUNT(*) as count FROM orders WHERE status IN ("active", "in_progress")${cutSql('created_at')}`),
      db.query(`SELECT COUNT(*) as count FROM orders WHERE status = "completed"${cutSql('created_at')}`),
      db.query(`SELECT COUNT(*) as count FROM orders WHERE status = "pending"${cutSql('created_at')}`),
      db.query(`SELECT COUNT(*) as count FROM users WHERE role = "user"${cutSql('created_at')}`),
      db.query('SELECT COUNT(*) as count FROM tutors'),
      db.query(`SELECT COUNT(*) as count FROM chats WHERE is_flagged = 1${cutSql('created_at')}`),
      db.query(`SELECT COALESCE(SUM(amount_remaining), 0) as total FROM orders WHERE status NOT IN ("cancelled")${cutSql('created_at')}`),
      db.query(`SELECT COUNT(*) as count FROM orders o
                WHERE o.status = 'active'
                  AND NOT EXISTS (SELECT 1 FROM order_tutors ot WHERE ot.order_id = o.id)${cutSql('o.created_at')}`),
      db.query(`SELECT COUNT(*) as count FROM orders o
                JOIN tutor_statuses ts ON o.tutor_status_id = ts.id
                WHERE ts.code = 'work_stopped' AND o.status = 'active'${cutSql('o.created_at')}`),
      db.query(`SELECT COUNT(*) as count FROM issues WHERE status = 'open'${cutSql('created_at')}`),
      db.query(`SELECT COUNT(*) as count FROM order_installments WHERE status = 'overdue'${cutSql('created_at')}`),
      db.query(`
        SELECT o.id, o.order_code, o.course_name, o.total_price, o.status, o.created_at, u.username
        FROM orders o JOIN users u ON o.user_id = u.id
        WHERE 1=1${cutSql('o.created_at')}
        ORDER BY o.created_at DESC LIMIT 10
      `),
      db.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount) as revenue, COUNT(*) as payments
        FROM payments WHERE status = 'completed'${cutSql('created_at')}
        GROUP BY month ORDER BY month DESC LIMIT 12
      `)
    ]);

    res.json({
      total_sales: totalSales.total,
      revenue_this_month: revenueThisMonth.total,
      active_orders: activeOrders.count,
      completed_orders: completedOrders.count,
      pending_orders: pendingOrders.count,
      total_users: totalUsers.count,
      total_tutors: totalTutors.count,
      flagged_messages: flaggedMessages.count,
      outstanding: outstanding.total,
      unassigned_paid: unassignedPaid.count,
      work_stopped: workStopped.count,
      open_issues: openIssues.count,
      overdue_installments: overdueInstallments.count,
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
    let query = 'SELECT id, username, name, access_code_plain, email, phone, country, signup_ip, role, is_active, created_at FROM users WHERE role = "user"';
    const params = [];
    if (search) {
      query += ' AND (username LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (req.salesCutoff) { query += ' AND created_at >= ?'; params.push(req.salesCutoff); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [users] = await db.query(query, params);
    // Decrypt the access code for display; drop the encrypted blob from the payload.
    // null for users created before the encrypted-copy feature (unrecoverable).
    users.forEach(u => { u.access_code = decryptSecret(u.access_code_plain); delete u.access_code_plain; });
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE role = "user"';
    const countParams = [];
    if (req.salesCutoff) { countQuery += ' AND created_at >= ?'; countParams.push(req.salesCutoff); }
    const [[{ total }]] = await db.query(countQuery, countParams);
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

// Normalize a star rating: one-decimal precision (4.7, 4.8…), clamped to
// 0–5; null when unset.
const parseRating = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Math.round(parseFloat(v) * 10) / 10;
  if (Number.isNaN(n)) return null;
  return Math.min(5, Math.max(0, n));
};

exports.createTutor = async (req, res) => {
  try {
    const { name, email, password, specialization, photo_url, rating } = req.body;
    const [existing] = await db.query('SELECT id FROM tutors WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO tutors (name, email, password, specialization, photo_url, rating) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, specialization || null, photo_url || null, parseRating(rating)]
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
    const { name, email, specialization, status, password, photo_url, rating } = req.body;
    // photo_url / rating are optional — only update when the field is in the
    // request body (so older forms that don't send them don't blank them out).
    const updateParts = ['name = ?', 'email = ?', 'specialization = ?', 'status = ?'];
    const updateVals = [name, email, specialization, status];
    if (photo_url !== undefined) {
      updateParts.push('photo_url = ?');
      updateVals.push(photo_url || null);
    }
    if (rating !== undefined) {
      updateParts.push('rating = ?');
      updateVals.push(parseRating(rating));
    }
    updateVals.push(id);
    await db.query(`UPDATE tutors SET ${updateParts.join(', ')} WHERE id = ?`, updateVals);

    // Optional password reset: only when a non-empty string is provided.
    if (typeof password === 'string' && password.trim().length >= 6) {
      const hashed = await bcrypt.hash(password, 10);
      await db.query('UPDATE tutors SET password = ? WHERE id = ?', [hashed, id]);
    } else if (typeof password === 'string' && password.trim().length > 0) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    res.json({ message: 'Tutor updated' });
  } catch (error) {
    console.error('Update tutor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Photo upload — reuses the same uploads/ disk used by site logos so we
// don't introduce a second storage path. Multer middleware handles the
// disk write; this just returns the public URL.
exports.uploadTutorPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error('Upload tutor photo error:', error);
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
    const { page = 1, limit = 20, status, admin_status_code, search, unassigned } = req.query;
    const offset = (page - 1) * limit;
    let query = `
      SELECT o.*, u.username, ot.name as order_type_name, s.name as subject_name,
        p.name as plan_name, pr.plan_tier,
        astat.code as admin_status_code, astat.name as admin_status_name,
        tstat.code as tutor_status_code, tstat.name as tutor_status_name,
        GROUP_CONCAT(DISTINCT t.name) as tutor_names,
        GROUP_CONCAT(DISTINCT t.id) as tutor_ids
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_types ot ON o.order_type_id = ot.id
      JOIN subjects s ON o.subject_id = s.id
      LEFT JOIN plans p ON o.plan_id = p.id
      LEFT JOIN pricing_rules pr ON o.pricing_rule_id = pr.id
      LEFT JOIN order_tutors otr ON o.id = otr.order_id
      LEFT JOIN tutors t ON otr.tutor_id = t.id
      LEFT JOIN admin_statuses astat ON o.admin_status_id = astat.id
      LEFT JOIN tutor_statuses tstat ON o.tutor_status_id = tstat.id
      WHERE 1=1
    `;
    const params = [];
    if (admin_status_code) { query += ' AND astat.code = ?'; params.push(admin_status_code); }
    else if (status)       { query += ' AND o.status = ?';   params.push(status); }
    if (search) { query += ' AND (o.course_name LIKE ? OR u.username LIKE ? OR o.order_code LIKE ? OR o.id = ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, search); }
    if (req.salesCutoff) { query += ' AND o.created_at >= ?'; params.push(req.salesCutoff); }
    query += ' GROUP BY o.id';
    if (unassigned === 'true') { query += ' HAVING tutor_names IS NULL'; }
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [orders] = await db.query(query, params);
    let countQuery = `SELECT COUNT(DISTINCT o.id) as total FROM orders o JOIN users u ON o.user_id = u.id
      LEFT JOIN order_tutors otr ON o.id = otr.order_id
      LEFT JOIN admin_statuses astat ON o.admin_status_id = astat.id WHERE 1=1`;
    const countParams = [];
    if (admin_status_code) { countQuery += ' AND astat.code = ?'; countParams.push(admin_status_code); }
    else if (status)       { countQuery += ' AND o.status = ?';   countParams.push(status); }
    if (search) { countQuery += ' AND (o.course_name LIKE ? OR u.username LIKE ? OR o.order_code LIKE ? OR o.id = ?)'; countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, search); }
    if (req.salesCutoff) { countQuery += ' AND o.created_at >= ?'; countParams.push(req.salesCutoff); }
    if (unassigned === 'true') { countQuery += ' AND otr.order_id IS NULL'; }
    const [[{ total }]] = await db.query(countQuery, countParams);
    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Admin code → legacy status mapping, so legacy code paths still work
const ADMIN_CODE_TO_LEGACY = {
  unpaid:                  'incomplete',
  paid_partial_unassigned: 'pending',
  paid_full_unassigned:    'pending',
  paid_partial_assigned:   'active',
  paid_full_assigned:      'active',
  paid_completed:          'completed',
  cancelled:               'cancelled'
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_status_code, cancellation_note } = req.body;
    let { status } = req.body;

    // Resolve new-model code → row + legacy fallback
    let adminStatusId = null;
    if (admin_status_code) {
      const [rows] = await db.query('SELECT id FROM admin_statuses WHERE code = ?', [admin_status_code]);
      if (rows.length === 0) return res.status(400).json({ error: `Unknown admin_status_code: ${admin_status_code}` });
      adminStatusId = rows[0].id;
      status = ADMIN_CODE_TO_LEGACY[admin_status_code] || status;
    }
    if (!status) return res.status(400).json({ error: 'admin_status_code or status is required' });

    // Cancellation requires an explanatory note
    const isCancelling = admin_status_code === 'cancelled' || status === 'cancelled';
    const note = typeof cancellation_note === 'string' ? cancellation_note.trim() : '';
    if (isCancelling && !note) {
      return res.status(400).json({ error: 'A cancellation note is required when cancelling an order.' });
    }

    // Fetch current order details + user email before updating
    const [orders] = await db.query(
      `SELECT o.*, u.email, u.username, p.name as plan_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN plans p ON o.plan_id = p.id
       WHERE o.id = ?`, [id]
    );

    const oldStatus = orders.length > 0 ? orders[0].status : null;
    const isCompleting = admin_status_code === 'paid_completed' || status === 'completed';

    // Block completion if there's an outstanding balance
    if (isCompleting && orders.length > 0 && parseFloat(orders[0].amount_remaining) > 0) {
      return res.status(400).json({
        error: `Cannot mark as completed. Outstanding balance: $${parseFloat(orders[0].amount_remaining).toFixed(2)}`
      });
    }

    // ── Unpaid → Paid (Full / Partial): collect payment info; only Admin or
    // Sales Lead may do it. Records an audit row, updates the order's
    // paid/remaining balances, and books a completed payment for revenue. ──
    const order0 = orders[0];
    let currentCode = null;
    if (order0 && order0.admin_status_id) {
      const [[c]] = await db.query('SELECT code FROM admin_statuses WHERE id = ?', [order0.admin_status_id]);
      currentCode = c ? c.code : null;
    }
    const targetIsPaid = /^paid_(full|partial)/.test(admin_status_code || '');
    if (order0 && currentCode === 'unpaid' && targetIsPaid) {
      if (!['admin', 'sales_lead'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only an Admin or Sales Lead can mark an order as paid.' });
      }
      const pay = req.body.payment || {};
      const mode = String(pay.mode_of_communication || '').trim();
      const invoiceNo = String(pay.invoice_no || '').trim();
      const payDate = String(pay.payment_date || '').trim();
      const amount = parseFloat(pay.amount);
      const payNote = String(pay.note || '').trim();
      const isPartial = admin_status_code.startsWith('paid_partial');
      const total = parseFloat(order0.total_price);

      // Partial is only allowed for eligible Online Class orders (same rule as
      // the student Stripe flow: Online Class + total >= $455 or 45+ days).
      if (isPartial) {
        const { isPartialEligible, PARTIAL_PAYMENT_AMOUNT } = require('./paymentController');
        const [[ot]] = await db.query('SELECT name FROM order_types WHERE id = ?', [order0.order_type_id]);
        if (!isPartialEligible(order0, ot ? ot.name : '') || total <= PARTIAL_PAYMENT_AMOUNT) {
          return res.status(400).json({ error: 'Partial payment is only available for eligible Online Class orders (total ≥ $455 or 45+ days).' });
        }
      }

      if (!mode) return res.status(400).json({ error: 'Mode of communication is required.' });
      if (!invoiceNo) return res.status(400).json({ error: 'Invoice number is required.' });
      if (!payDate) return res.status(400).json({ error: 'Date of payment is required.' });
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'A valid payment amount is required.' });
      if (amount > total + 0.001) return res.status(400).json({ error: `Amount cannot exceed the order total ($${total.toFixed(2)}).` });
      // Note mandatory when a FULL payment's amount differs from the order total.
      if (!isPartial && Math.abs(amount - total) > 0.001 && !payNote) {
        return res.status(400).json({ error: 'A note is required when the amount differs from the order total.' });
      }

      const amountPaid = Math.round(amount * 100) / 100;
      const amountRemaining = Math.max(0, Math.round((total - amountPaid) * 100) / 100);
      const paymentType = isPartial ? 'partial' : 'full';

      // Best-effort collector name for the audit trail
      let collectorName = req.user.name || req.user.username || null;
      if (!collectorName) {
        if (req.user.role === 'admin') collectorName = 'Admin';
        else {
          const [[su]] = await db.query('SELECT name FROM sales_users WHERE id = ?', [req.user.id]);
          collectorName = su ? su.name : null;
        }
      }

      await db.query(
        'UPDATE orders SET payment_type = ?, amount_paid = ?, amount_remaining = ? WHERE id = ?',
        [paymentType, amountPaid, amountRemaining, id]
      );
      await db.query(
        `INSERT INTO order_payment_collections
           (order_id, payment_type, mode_of_communication, invoice_no, payment_date, amount, note, collected_by_id, collected_by_role, collected_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, paymentType, mode, invoiceNo, payDate, amountPaid, payNote || null, req.user.id, req.user.role, collectorName]
      );
      // Book a completed payment so the amount counts toward revenue/reports.
      await db.query(
        'INSERT INTO payments (order_id, user_id, amount, status) VALUES (?, ?, ?, ?)',
        [id, order0.user_id, amountPaid, 'completed']
      );
    }

    // Keep the assigned/unassigned suffix honest: a "(Assigned)" paid status
    // with no tutor becomes "(Not Assigned)", and vice-versa. Mirrors how
    // assignTutors promotes the status when a tutor is added.
    if (admin_status_code && /^paid_(full|partial)_(assigned|unassigned)$/.test(admin_status_code)) {
      const [[tc]] = await db.query('SELECT COUNT(*) AS cnt FROM order_tutors WHERE order_id = ?', [id]);
      const wantCode = admin_status_code.replace(/_(assigned|unassigned)$/, tc.cnt > 0 ? '_assigned' : '_unassigned');
      if (wantCode !== admin_status_code) {
        const [rows] = await db.query('SELECT id FROM admin_statuses WHERE code = ?', [wantCode]);
        if (rows.length) {
          adminStatusId = rows[0].id;
          status = ADMIN_CODE_TO_LEGACY[wantCode] || status;
        }
      }
    }

    if (adminStatusId !== null) {
      if (isCancelling) {
        await db.query('UPDATE orders SET status = ?, admin_status_id = ?, cancellation_note = ? WHERE id = ?', [status, adminStatusId, note, id]);
      } else {
        await db.query('UPDATE orders SET status = ?, admin_status_id = ? WHERE id = ?', [status, adminStatusId, id]);
      }
    } else {
      await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    }

    // Disable chat if completed
    if (isCompleting) {
      await db.query('UPDATE orders SET chat_enabled = 0 WHERE id = ?', [id]);
    }

    // Notify user + send email
    if (orders.length > 0) {
      const order = orders[0];
      const { formatOrderRef } = require('../utils/orderCode');
      const { notifyUser } = require('../services/notifyUser');
      const ref = await formatOrderRef(id);
      await notifyUser(req.app.get('io'), order.user_id, {
        type: 'order_update',
        message: `Order ${ref} status: ${status}`,
        referenceId: Number(id),
        referenceType: 'order',
      });

      // Send status change email to user (non-blocking)
      if (order.email && oldStatus !== status) {
        sendOrderStatusChangeEmail(order.email, {
          orderId: id,
          courseName: order.course_name,
          oldStatus,
          newStatus: status,
          planName: order.plan_name,
          totalPrice: order.total_price
        }).catch(e => console.error('Status change email error:', e));
      }
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

    const { formatOrderRef } = require('../utils/orderCode');
    const assignRef = await formatOrderRef(id);

    // Add new assignments
    const { notifyTutor } = require('../services/notifyUser');
    for (const tutorId of tutor_ids) {
      await db.query('INSERT INTO order_tutors (order_id, tutor_id) VALUES (?, ?)', [id, tutorId]);

      // Bell-panel notification (persisted + live push to the tutor)
      await notifyTutor(req.app.get('io'), tutorId, {
        type: 'task_assigned',
        message: `New task assigned: Order ${assignRef}`,
        referenceId: Number(id),
        referenceType: 'order',
      }).catch(e => console.error('task_assigned notify failed:', e.message));

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

    // Notify the student — knowing a tutor picked up their order matters.
    if (tutor_ids.length > 0) {
      const [[orderOwner]] = await db.query('SELECT user_id FROM orders WHERE id = ?', [id]);
      if (orderOwner?.user_id) {
        const [tutorNames] = await db.query(
          `SELECT GROUP_CONCAT(name SEPARATOR ', ') AS names FROM tutors WHERE id IN (${tutor_ids.map(() => '?').join(',')})`,
          tutor_ids
        );
        const names = tutorNames[0]?.names;
        const { notifyUser } = require('../services/notifyUser');
        await notifyUser(req.app.get('io'), orderOwner.user_id, {
          type: 'tutor_assigned',
          message: names
            ? `${names} ${tutor_ids.length > 1 ? 'have' : 'has'} been assigned to your order ${assignRef}`
            : `A tutor has been assigned to your order ${assignRef}`,
          referenceId: Number(id),
          referenceType: 'order',
        }).catch(e => console.error('tutor_assigned notify failed:', e.message));
      }
    }

    // Update order status to active if pending; also promote admin/tutor status.
    // Pick partial vs full assigned variant from the current payment_type.
    const statuses = require('../utils/statuses');
    const [[currentOrder]] = await db.query('SELECT payment_type FROM orders WHERE id = ?', [id]);
    const assignedCode = currentOrder?.payment_type === 'partial' ? 'paid_partial_assigned' : 'paid_full_assigned';
    const adminAssignedId   = await statuses.adminId(assignedCode);
    const tutorInProgressId = await statuses.tutorId('in_progress');
    await db.query(
      `UPDATE orders
       SET status = "active",
           admin_status_id = COALESCE(?, admin_status_id),
           tutor_status_id = COALESCE(tutor_status_id, ?)
       WHERE id = ? AND status IN ('pending', 'active')`,
      [adminAssignedId, tutorInProgressId, id]
    );

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
    let chatQuery = `
      SELECT DISTINCT o.id as order_id, o.order_code, o.course_name, u.username,
        (SELECT COUNT(*) FROM chats WHERE order_id = o.id) as message_count,
        (SELECT COUNT(*) FROM chats WHERE order_id = o.id AND is_flagged = 1) as flagged_count,
        (SELECT MAX(created_at) FROM chats WHERE order_id = o.id) as last_message_at
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE EXISTS (SELECT 1 FROM chats WHERE order_id = o.id)`;
    const chatParams = [];
    if (req.salesCutoff) { chatQuery += ' AND o.created_at >= ?'; chatParams.push(req.salesCutoff); }
    chatQuery += ' ORDER BY last_message_at DESC';
    const [chats] = await db.query(chatQuery, chatParams);
    res.json(chats);
  } catch (error) {
    console.error('Get all chats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFlaggedMessages = async (req, res) => {
  try {
    let flaggedQuery = `
      SELECT c.*, o.course_name, o.order_code,
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
      WHERE c.is_flagged = 1`;
    const flaggedParams = [];
    if (req.salesCutoff) { flaggedQuery += ' AND c.created_at >= ?'; flaggedParams.push(req.salesCutoff); }
    flaggedQuery += ' ORDER BY c.created_at DESC';
    const [messages] = await db.query(flaggedQuery, flaggedParams);
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
    const { getSetting, DEFAULT_ADMIN_EMAILS } = require('../services/settings');
    const adminNotificationEmails = await getSetting('admin_notification_emails', DEFAULT_ADMIN_EMAILS);
    res.json({ orderTypes, subjects, educationLevels, plans, coupons, adminNotificationEmails });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update the global admin notification email list (comma/newline separated).
exports.updateNotificationEmails = async (req, res) => {
  try {
    const { emails } = req.body;
    const { setSetting, parseEmailList } = require('../services/settings');
    const list = parseEmailList(emails);

    if (list.length === 0) {
      return res.status(400).json({ error: 'Enter at least one email address.' });
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = list.filter(e => !emailRe.test(e));
    if (invalid.length) {
      return res.status(400).json({ error: `Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}` });
    }

    const value = list.join(', ');
    await setSetting('admin_notification_emails', value);
    res.json({ message: 'Notification emails updated', adminNotificationEmails: value });
  } catch (error) {
    console.error('Update notification emails error:', error);
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
        o.order_code,
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
      LEFT JOIN plans p ON o.plan_id = p.id
      LEFT JOIN order_tutors otr ON o.id = otr.order_id
      LEFT JOIN tutors t ON otr.tutor_id = t.id
      LEFT JOIN payments pay ON o.id = pay.order_id
      WHERE 1=1
    `;
    
    const params = [];

    // Apply filters
    if (search) {
      // Match course name, numeric id, or the friendly order code (MMT018…)
      query += ' AND (o.course_name LIKE ? OR o.id = ? OR o.order_code LIKE ?)';
      params.push(`%${search}%`, search, `%${search}%`);
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

    if (req.salesCutoff) { query += ' AND o.created_at >= ?'; params.push(req.salesCutoff); }

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
const AVAILABLE_MENUS = ['dashboard', 'users', 'tutors', 'orders', 'chats', 'issues', 'reports', 'settings'];

exports.getAllSalesUsers = async (req, res) => {
  try {
    const [salesUsers] = await db.query(
      'SELECT id, name, email, role, status, data_window_days, created_at, updated_at FROM sales_users ORDER BY created_at DESC'
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
    const { name, email, password, role, permissions, data_window_days } = req.body;
    if (!['sales_lead', 'sales_executive'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const windowDays = clampWindowDays(data_window_days);
    const [existing] = await db.query('SELECT id FROM sales_users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO sales_users (name, email, password, role, data_window_days) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, windowDays]
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
    const { name, email, role, status, permissions, data_window_days } = req.body;
    if (role && !['sales_lead', 'sales_executive'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const windowDays = clampWindowDays(data_window_days);
    await db.query(
      'UPDATE sales_users SET name = ?, email = ?, role = ?, status = ?, data_window_days = ? WHERE id = ?',
      [name, email, role, status, windowDays, id]
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
