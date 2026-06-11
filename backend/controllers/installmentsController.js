const db = require('../config/db');
const stripe = require('../config/stripe');
const { sendInstallmentPlanCreated, sendInstallmentReminder, sendInstallmentPaid } = require('../services/emailService');

/**
 * Admin/Sales: Create installment plan for a partial-paid order
 * Body: {
 *   installments: [{ amount, due_date }, ...]  (2 to 6 items)
 *   convenience_fee: number (optional, default 0)
 *   fee_type: 'flat' | 'percent' (only used to compute, fee is stored as flat in orders.convenience_fee)
 *   split_mode: 'equal' | 'manual'  (informational, server validates totals either way)
 * }
 */
exports.createInstallmentPlan = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { installments, convenience_fee = 0, fee_type = 'flat' } = req.body;

    if (!Array.isArray(installments) || installments.length < 2 || installments.length > 6) {
      return res.status(400).json({ error: 'Installments must be 2 to 6 items' });
    }

    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    if (order.payment_type !== 'partial' || parseFloat(order.amount_remaining) <= 0) {
      return res.status(400).json({ error: 'Order has no outstanding balance' });
    }
    if (order.has_installments) {
      return res.status(400).json({ error: 'Installment plan already exists' });
    }

    const remaining = parseFloat(order.amount_remaining);
    let feeAmount = 0;
    if (fee_type === 'percent') {
      feeAmount = (remaining * parseFloat(convenience_fee || 0)) / 100;
    } else {
      feeAmount = parseFloat(convenience_fee || 0);
    }
    feeAmount = Math.round(feeAmount * 100) / 100;

    const expectedTotal = remaining + feeAmount;
    const sumInstallments = installments.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    if (Math.abs(sumInstallments - expectedTotal) > 0.5) {
      return res.status(400).json({
        error: `Installment amounts ($${sumInstallments.toFixed(2)}) must equal remaining + fee ($${expectedTotal.toFixed(2)})`
      });
    }

    // Validate each installment
    for (let i = 0; i < installments.length; i++) {
      if (!installments[i].amount || !installments[i].due_date) {
        return res.status(400).json({ error: `Installment ${i + 1} missing amount or due date` });
      }
    }

    // Insert installments
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < installments.length; i++) {
        await conn.query(
          'INSERT INTO order_installments (order_id, installment_number, amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
          [orderId, i + 1, parseFloat(installments[i].amount), installments[i].due_date, 'pending']
        );
      }
      await conn.query(
        'UPDATE orders SET has_installments = 1, convenience_fee = ?, amount_remaining = ? WHERE id = ?',
        [feeAmount, expectedTotal, orderId]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    // Fetch user email and send notification
    const [users] = await db.query('SELECT email, username FROM users WHERE id = ?', [order.user_id]);
    const user = users[0] || {};
    const [installmentRows] = await db.query(
      'SELECT id, installment_number, amount, due_date, status FROM order_installments WHERE order_id = ? ORDER BY installment_number',
      [orderId]
    );

    if (user.email) {
      sendInstallmentPlanCreated(user.email, {
        orderId,
        username: user.username,
        installments: installmentRows,
        convenienceFee: feeAmount,
        siteId: order.site_id
      }).catch(e => console.error('Installment email error:', e));
    }

    // Bell-panel notification (live) — the student should know their
    // remaining balance was split into a payment plan.
    {
      const { notifyUser } = require('../services/notifyUser');
      const ref = await require('../utils/orderCode').formatOrderRef(orderId);
      const firstDue = installmentRows[0]
        ? new Date(installmentRows[0].due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;
      await notifyUser(req.app.get('io'), order.user_id, {
        type: 'installment_plan',
        message: `Your remaining balance on order ${ref} was split into ${installmentRows.length} installments${firstDue ? ` — first due ${firstDue}` : ''}`,
        referenceId: Number(orderId),
        referenceType: 'order',
      }).catch(e => console.error('installment_plan notify failed:', e.message));
    }

    res.json({ message: 'Installment plan created', installments: installmentRows, convenience_fee: feeAmount });
  } catch (error) {
    console.error('Create installment plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * List installments for an order (used by admin, sales, and user)
 */
exports.getInstallments = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const role = req.user.role;
    const userId = req.user.id;

    // Permission: user can only see own order
    if (role === 'user') {
      const [check] = await db.query('SELECT user_id FROM orders WHERE id = ?', [orderId]);
      if (check.length === 0 || check[0].user_id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const [rows] = await db.query(
      'SELECT id, installment_number, amount, due_date, status, paid_at FROM order_installments WHERE order_id = ? ORDER BY installment_number',
      [orderId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get installments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Admin/Sales: Update existing installment plan
 * Body: { installments: [{ id, amount, due_date }, ...] } for unpaid installments only
 */
exports.updateInstallmentPlan = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { installments } = req.body;
    if (!Array.isArray(installments) || installments.length === 0) {
      return res.status(400).json({ error: 'installments required' });
    }

    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

    // Fetch all existing installments
    const [existing] = await db.query(
      'SELECT id, amount, status FROM order_installments WHERE order_id = ?',
      [orderId]
    );
    const existingMap = new Map(existing.map(e => [e.id, e]));

    // Validate: all submitted ids exist, none are already paid
    for (const upd of installments) {
      const inst = existingMap.get(parseInt(upd.id));
      if (!inst) return res.status(400).json({ error: `Installment ${upd.id} not found in this order` });
      if (inst.status === 'paid') return res.status(400).json({ error: `Installment #${upd.id} is already paid and cannot be edited` });
      if (!upd.amount || !upd.due_date) return res.status(400).json({ error: 'Each installment requires amount and due_date' });
      if (parseFloat(upd.amount) <= 0) return res.status(400).json({ error: 'Amount must be > 0' });
    }

    // Sum check: new unpaid sum must equal old unpaid sum
    const oldUnpaidSum = existing
      .filter(e => e.status !== 'paid')
      .reduce((s, e) => s + parseFloat(e.amount), 0);
    const newUnpaidSum = installments.reduce((s, i) => s + parseFloat(i.amount), 0);
    if (Math.abs(oldUnpaidSum - newUnpaidSum) > 0.5) {
      return res.status(400).json({
        error: `Sum of unpaid installments must equal $${oldUnpaidSum.toFixed(2)} (got $${newUnpaidSum.toFixed(2)})`
      });
    }

    // Make sure all unpaid installments are covered
    const submittedIds = new Set(installments.map(i => parseInt(i.id)));
    const unpaidIds = existing.filter(e => e.status !== 'paid').map(e => e.id);
    for (const id of unpaidIds) {
      if (!submittedIds.has(id)) {
        return res.status(400).json({ error: `Missing installment id ${id} in update payload` });
      }
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const upd of installments) {
        await conn.query(
          'UPDATE order_installments SET amount = ?, due_date = ?, reminder_sent_dates = NULL WHERE id = ?',
          [parseFloat(upd.amount), upd.due_date, parseInt(upd.id)]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const [rows] = await db.query(
      'SELECT id, installment_number, amount, due_date, status FROM order_installments WHERE order_id = ? ORDER BY installment_number',
      [orderId]
    );

    // Tell the student their plan changed (amounts / due dates)
    {
      const [[orderOwner]] = await db.query('SELECT user_id FROM orders WHERE id = ?', [orderId]);
      if (orderOwner?.user_id) {
        const { notifyUser } = require('../services/notifyUser');
        const ref = await require('../utils/orderCode').formatOrderRef(orderId);
        await notifyUser(req.app.get('io'), orderOwner.user_id, {
          type: 'installment_plan',
          message: `Your installment plan on order ${ref} was updated — check the new amounts and due dates`,
          referenceId: Number(orderId),
          referenceType: 'order',
        }).catch(e => console.error('installment_plan notify failed:', e.message));
      }
    }

    res.json({ message: 'Installment plan updated', installments: rows });
  } catch (error) {
    console.error('Update installment plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Admin/Sales: Delete installment plan (only if nothing paid yet)
 */
exports.deleteInstallmentPlan = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const [paid] = await db.query(
      "SELECT COUNT(*) as cnt FROM order_installments WHERE order_id = ? AND status = 'paid'",
      [orderId]
    );
    if (paid[0].cnt > 0) {
      return res.status(400).json({ error: 'Cannot delete plan with paid installments' });
    }
    const [orders] = await db.query('SELECT convenience_fee FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

    await db.query('DELETE FROM order_installments WHERE order_id = ?', [orderId]);
    const fee = parseFloat(orders[0].convenience_fee || 0);
    await db.query(
      'UPDATE orders SET has_installments = 0, convenience_fee = 0, amount_remaining = amount_remaining - ? WHERE id = ?',
      [fee, orderId]
    );
    res.json({ message: 'Installment plan deleted' });
  } catch (error) {
    console.error('Delete installment plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Admin/Sales: Mark a single installment as paid (offline)
 */
exports.markInstallmentPaid = async (req, res) => {
  try {
    const { installment_id } = req.params;
    const [rows] = await db.query(
      `SELECT i.*, o.user_id, o.site_id, u.email, u.username
       FROM order_installments i
       JOIN orders o ON i.order_id = o.id
       JOIN users u ON o.user_id = u.id
       WHERE i.id = ?`, [installment_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Installment not found' });
    const inst = rows[0];
    if (inst.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    const amount = parseFloat(inst.amount);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        "UPDATE order_installments SET status = 'paid', paid_at = NOW(), stripe_payment_intent = ? WHERE id = ?",
        [`offline-${Date.now()}`, installment_id]
      );
      await conn.query(
        "UPDATE orders SET amount_paid = amount_paid + ?, amount_remaining = GREATEST(amount_remaining - ?, 0) WHERE id = ?",
        [amount, amount, inst.order_id]
      );
      await conn.query(
        'INSERT INTO payments (order_id, user_id, amount, status, stripe_session_id) VALUES (?, ?, ?, ?, ?)',
        [inst.order_id, inst.user_id, amount, 'completed', `offline-inst-${installment_id}-${Date.now()}`]
      );
      // If all installments now paid, mark order payment_type as full
      const [remaining] = await conn.query(
        "SELECT COUNT(*) as cnt FROM order_installments WHERE order_id = ? AND status != 'paid'",
        [inst.order_id]
      );
      if (remaining[0].cnt === 0) {
        await conn.query("UPDATE orders SET payment_type = 'full' WHERE id = ?", [inst.order_id]);
        await require('../utils/statuses').promotePartialToFullIfCleared(inst.order_id, conn);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    if (inst.email) {
      sendInstallmentPaid(inst.email, {
        orderId: inst.order_id,
        username: inst.username,
        paidInstallments: [{ installment_number: inst.installment_number, amount }],
        siteId: inst.site_id
      }).catch(e => console.error('Mark paid email error:', e));
    }

    // Bell-panel confirmation (live)
    {
      const { notifyUser } = require('../services/notifyUser');
      const ref = await require('../utils/orderCode').formatOrderRef(inst.order_id);
      await notifyUser(req.app.get('io'), inst.user_id, {
        type: 'payment_received',
        message: `Installment #${inst.installment_number} ($${amount.toFixed(2)}) on order ${ref} marked as paid`,
        referenceId: Number(inst.order_id),
        referenceType: 'order',
      }).catch(e => console.error('installment paid notify failed:', e.message));
    }

    res.json({ message: 'Installment marked as paid', amount });
  } catch (error) {
    console.error('Mark installment paid error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Admin/Sales: Mark ALL remaining installments as paid (offline)
 */
exports.markAllInstallmentsPaid = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const [pending] = await db.query(
      "SELECT id, installment_number, amount FROM order_installments WHERE order_id = ? AND status != 'paid'",
      [orderId]
    );
    if (pending.length === 0) return res.status(400).json({ error: 'No pending installments' });

    const total = pending.reduce((s, p) => s + parseFloat(p.amount), 0);
    const [orderRows] = await db.query('SELECT user_id, site_id FROM orders WHERE id = ?', [orderId]);
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const userId = orderRows[0].user_id;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const ids = pending.map(p => p.id);
      await conn.query(
        "UPDATE order_installments SET status = 'paid', paid_at = NOW(), stripe_payment_intent = ? WHERE id IN (?)",
        [`offline-${Date.now()}`, ids]
      );
      await conn.query(
        "UPDATE orders SET amount_paid = amount_paid + ?, amount_remaining = 0, payment_type = 'full' WHERE id = ?",
        [total, orderId]
      );
      await require('../utils/statuses').promotePartialToFullIfCleared(orderId, conn);
      await conn.query(
        'INSERT INTO payments (order_id, user_id, amount, status, stripe_session_id) VALUES (?, ?, ?, ?, ?)',
        [orderId, userId, total, 'completed', `offline-all-${orderId}-${Date.now()}`]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const [userRows] = await db.query('SELECT email, username FROM users WHERE id = ?', [userId]);
    if (userRows.length > 0 && userRows[0].email) {
      sendInstallmentPaid(userRows[0].email, {
        orderId,
        username: userRows[0].username,
        paidInstallments: pending,
        siteId: orderRows[0].site_id
      }).catch(e => console.error('Mark all paid email error:', e));
    }

    // Bell-panel confirmation (live)
    {
      const { notifyUser } = require('../services/notifyUser');
      const ref = await require('../utils/orderCode').formatOrderRef(orderId);
      await notifyUser(req.app.get('io'), userId, {
        type: 'payment_received',
        message: `All remaining installments ($${total.toFixed(2)}) on order ${ref} marked as paid — balance cleared`,
        referenceId: Number(orderId),
        referenceType: 'order',
      }).catch(e => console.error('all installments paid notify failed:', e.message));
    }

    res.json({ message: 'All installments marked as paid', amount: total });
  } catch (error) {
    console.error('Mark all installments paid error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * User: Create PaymentIntent for a single installment
 */
exports.payInstallment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { installment_id } = req.params;

    const [rows] = await db.query(
      `SELECT i.*, o.user_id, o.total_price, o.site_id
       FROM order_installments i
       JOIN orders o ON i.order_id = o.id
       WHERE i.id = ?`, [installment_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Installment not found' });
    const inst = rows[0];
    if (inst.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (inst.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    const amount = parseFloat(inst.amount);
    const amountCents = Math.round(amount * 100);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      description: `Installment ${inst.installment_number} - Order ${await require('../utils/orderCode').formatOrderRef(inst.order_id)}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: userId.toString(),
        order_id: inst.order_id.toString(),
        installment_id: installment_id.toString(),
        payment_type: 'installment',
        charge_amount: amount.toFixed(2)
      }
    });

    await db.query(
      'INSERT INTO payments (order_id, user_id, stripe_session_id, amount, status) VALUES (?, ?, ?, ?, ?)',
      [inst.order_id, userId, intent.id, amount, 'pending']
    );

    res.json({ client_secret: intent.client_secret, amount });
  } catch (error) {
    console.error('Pay installment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * User: Pay all pending installments at once
 */
exports.payAllInstallments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: orderId } = req.params;

    const [check] = await db.query('SELECT user_id, site_id FROM orders WHERE id = ?', [orderId]);
    if (check.length === 0 || check[0].user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [pending] = await db.query(
      "SELECT id, amount FROM order_installments WHERE order_id = ? AND status = 'pending'",
      [orderId]
    );
    if (pending.length === 0) return res.status(400).json({ error: 'No pending installments' });

    const total = pending.reduce((s, p) => s + parseFloat(p.amount), 0);
    const amountCents = Math.round(total * 100);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      description: `Pay all installments - Order ${await require('../utils/orderCode').formatOrderRef(orderId)}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: userId.toString(),
        order_id: orderId.toString(),
        installment_ids: pending.map(p => p.id).join(','),
        payment_type: 'installment_all',
        charge_amount: total.toFixed(2)
      }
    });

    await db.query(
      'INSERT INTO payments (order_id, user_id, stripe_session_id, amount, status) VALUES (?, ?, ?, ?, ?)',
      [orderId, userId, intent.id, total, 'pending']
    );

    res.json({ client_secret: intent.client_secret, amount: total });
  } catch (error) {
    console.error('Pay all installments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Mark installment(s) as paid after Stripe PaymentIntent succeeds.
 * Called from webhook/fulfill-intent for metadata.payment_type === 'installment' or 'installment_all'.
 */
exports.fulfillInstallmentIntent = async (intent, io = null) => {
  const meta = intent.metadata || {};
  const orderId = parseInt(meta.order_id);
  let installmentIds = [];

  if (meta.payment_type === 'installment' && meta.installment_id) {
    installmentIds = [parseInt(meta.installment_id)];
  } else if (meta.payment_type === 'installment_all' && meta.installment_ids) {
    installmentIds = meta.installment_ids.split(',').map(id => parseInt(id)).filter(Boolean);
  } else {
    return null;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let totalPaid = 0;
    for (const iid of installmentIds) {
      const [rows] = await conn.query("SELECT amount, status FROM order_installments WHERE id = ?", [iid]);
      if (rows.length === 0 || rows[0].status === 'paid') continue;
      totalPaid += parseFloat(rows[0].amount);
      await conn.query(
        "UPDATE order_installments SET status = 'paid', paid_at = NOW(), stripe_payment_intent = ? WHERE id = ?",
        [intent.id, iid]
      );
    }
    await conn.query(
      "UPDATE payments SET stripe_payment_id = ?, status = 'completed' WHERE stripe_session_id = ?",
      [intent.id, intent.id]
    );
    // Update order: reduce amount_remaining, increase amount_paid
    await conn.query(
      "UPDATE orders SET amount_paid = amount_paid + ?, amount_remaining = GREATEST(amount_remaining - ?, 0) WHERE id = ?",
      [totalPaid, totalPaid, orderId]
    );
    // If all installments paid, mark payment_type as full
    const [remaining] = await conn.query(
      "SELECT COUNT(*) as cnt FROM order_installments WHERE order_id = ? AND status != 'paid'",
      [orderId]
    );
    if (remaining[0].cnt === 0) {
      await conn.query("UPDATE orders SET payment_type = 'full' WHERE id = ?", [orderId]);
      await require('../utils/statuses').promotePartialToFullIfCleared(orderId, conn);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  // Send paid email
  try {
    const [orderRows] = await db.query(
      `SELECT o.*, u.email, u.username FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?`,
      [orderId]
    );
    if (orderRows.length > 0 && orderRows[0].email) {
      const [paidInsts] = await db.query(
        "SELECT installment_number, amount FROM order_installments WHERE id IN (?)",
        [installmentIds]
      );
      sendInstallmentPaid(orderRows[0].email, {
        orderId,
        username: orderRows[0].username,
        paidInstallments: paidInsts,
        siteId: orderRows[0].site_id
      }).catch(e => console.error('Installment paid email error:', e));

      // Bell-panel confirmation (live) for the Stripe-paid installment(s)
      const { notifyUser, notifyStaff } = require('../services/notifyUser');
      const ref = await require('../utils/orderCode').formatOrderRef(orderId);
      const paidTotal = paidInsts.reduce((s, p) => s + parseFloat(p.amount), 0);
      await notifyUser(io, orderRows[0].user_id, {
        type: 'payment_received',
        message: paidInsts.length > 1
          ? `Payment of $${paidTotal.toFixed(2)} received — ${paidInsts.length} installments cleared on order ${ref}`
          : `Installment #${paidInsts[0]?.installment_number} ($${paidTotal.toFixed(2)}) paid on order ${ref}`,
        referenceId: Number(orderId),
        referenceType: 'order',
      }).catch(e => console.error('installment stripe notify failed:', e.message));
      // Staff should see incoming money too
      await notifyStaff(io, {
        type: 'payment_received',
        message: `Installment payment of $${paidTotal.toFixed(2)} received on order ${ref} (${orderRows[0].username})`,
        referenceId: Number(orderId),
        referenceType: 'order',
      }).catch(e => console.error('installment staff notify failed:', e.message));
    }
  } catch (e) {
    console.error('Installment paid email lookup failed:', e);
  }

  return orderId;
};

/**
 * Cron job: send reminder emails for upcoming + overdue installments
 * Runs daily at 09:00 server time
 */
exports.runReminderCron = async () => {
  try {
    // Find pending installments with due_date in next 3 days OR overdue
    const [rows] = await db.query(`
      SELECT i.*, o.user_id, o.site_id, u.email, u.username
      FROM order_installments i
      JOIN orders o ON i.order_id = o.id
      JOIN users u ON o.user_id = u.id
      WHERE i.status = 'pending'
        AND i.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
    `);

    const today = new Date().toISOString().split('T')[0];

    for (const r of rows) {
      const dueDate = new Date(r.due_date);
      const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));

      // Mark overdue if past due
      if (daysUntilDue < 0 && r.status === 'pending') {
        await db.query("UPDATE order_installments SET status = 'overdue' WHERE id = ?", [r.id]);
      }

      // Track which dates we've sent reminders so we don't double-fire same day
      let sentDates = [];
      try {
        sentDates = r.reminder_sent_dates ? JSON.parse(r.reminder_sent_dates) : [];
      } catch { sentDates = []; }
      if (sentDates.includes(today)) continue;

      // Send reminder to user
      if (r.email) {
        sendInstallmentReminder(r.email, {
          orderId: r.order_id,
          username: r.username,
          installmentNumber: r.installment_number,
          amount: r.amount,
          dueDate: r.due_date,
          daysUntilDue,
          siteId: r.site_id,
          recipient: 'user'
        }).catch(e => console.error('Reminder email error (user):', e));
      }

      // Send reminder to admin
      sendInstallmentReminder(null, {
        orderId: r.order_id,
        username: r.username,
        installmentNumber: r.installment_number,
        amount: r.amount,
        dueDate: r.due_date,
        daysUntilDue,
        siteId: r.site_id,
        recipient: 'admin'
      }).catch(e => console.error('Reminder email error (admin):', e));

      // Bell-panel reminder (live if the student is online). Same daily
      // dedupe as the emails via reminder_sent_dates.
      {
        const { notifyUser } = require('../services/notifyUser');
        const ref = await require('../utils/orderCode').formatOrderRef(r.order_id);
        const io = require('../server').io;
        await notifyUser(io, r.user_id, {
          type: 'payment_reminder',
          message: daysUntilDue < 0
            ? `Installment #${r.installment_number} ($${parseFloat(r.amount).toFixed(2)}) on order ${ref} is overdue`
            : `Installment #${r.installment_number} ($${parseFloat(r.amount).toFixed(2)}) on order ${ref} is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
          referenceId: Number(r.order_id),
          referenceType: 'order',
        }).catch(e => console.error('reminder cron notify failed:', e.message));
      }

      sentDates.push(today);
      await db.query(
        "UPDATE order_installments SET reminder_sent_dates = ? WHERE id = ?",
        [JSON.stringify(sentDates), r.id]
      );
    }
    console.log(`[Reminder Cron] Processed ${rows.length} installments at ${new Date().toISOString()}`);
  } catch (e) {
    console.error('Reminder cron error:', e);
  }
};
