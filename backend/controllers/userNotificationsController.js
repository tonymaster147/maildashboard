// Student-facing notification feed for the dashboard bell panel.
//
// Sources:
//  - Persisted rows in `notifications` where role='user' (status changes,
//    task completed, files uploaded by tutor, issue replies/closures —
//    everything EXCEPT chat, which has its own badge on the Chat nav item).
//  - Payment reminders are lazily generated on list: for any of the user's
//    live orders with an overdue installment or an outstanding partial
//    balance we insert a `payment_reminder` row, deduped to at most one per
//    order per 7 days. No cron needed.

const db = require('../config/db');
const { formatOrderRef } = require('../utils/orderCode');

const REMINDER_COOLDOWN_DAYS = 7;
const LIST_LIMIT = 30;

// Generate payment_reminder rows for this user's orders that need money,
// skipping orders that already got a reminder inside the cooldown window.
async function generatePaymentReminders(userId) {
  // Overdue installments on live orders
  const [overdue] = await db.query(
    `SELECT o.id AS order_id, o.order_code,
            SUM(oi.amount) AS amount_due, COUNT(*) AS installments_due
     FROM order_installments oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.user_id = ? AND oi.status = 'overdue'
       AND o.status NOT IN ('completed', 'cancelled')
     GROUP BY o.id, o.order_code`,
    [userId]
  );

  // Outstanding partial balances (no installment plan) on live orders
  const [partials] = await db.query(
    `SELECT o.id AS order_id, o.order_code, o.amount_remaining
     FROM orders o
     WHERE o.user_id = ? AND o.payment_type = 'partial'
       AND o.amount_remaining > 0 AND IFNULL(o.has_installments, 0) = 0
       AND o.status NOT IN ('completed', 'cancelled', 'incomplete')`,
    [userId]
  );

  const candidates = [
    ...overdue.map(r => ({
      orderId: r.order_id,
      message: `Payment reminder: ${r.installments_due} overdue installment${r.installments_due > 1 ? 's' : ''} ($${Number(r.amount_due).toFixed(2)}) on order ${r.order_code || formatOrderRef(r.order_id)}`,
    })),
    ...partials.map(r => ({
      orderId: r.order_id,
      message: `Payment reminder: $${Number(r.amount_remaining).toFixed(2)} remaining on order ${r.order_code || formatOrderRef(r.order_id)}`,
    })),
  ];
  if (!candidates.length) return;

  for (const c of candidates) {
    const [recent] = await db.query(
      `SELECT id FROM notifications
       WHERE user_id = ? AND type = 'payment_reminder' AND reference_id = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
       LIMIT 1`,
      [userId, c.orderId, REMINDER_COOLDOWN_DAYS]
    );
    if (recent.length) continue;
    await db.query(
      'INSERT INTO notifications (user_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'user', 'payment_reminder', c.message, c.orderId, 'order']
    );
  }
}

exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    // Lazy reminder generation — failures here must never break the feed.
    await generatePaymentReminders(userId).catch(e =>
      console.error('payment reminder generation failed:', e.message)
    );
    const [rows] = await db.query(
      `SELECT id, type, message, is_read, reference_id, reference_type, created_at
       FROM notifications
       WHERE user_id = ? AND role = 'user'
       ORDER BY created_at DESC, id DESC
       LIMIT ${LIST_LIMIT}`,
      [userId]
    );
    res.json({ notifications: rows });
  } catch (error) {
    console.error('List user notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS unread FROM notifications
       WHERE user_id = ? AND role = 'user' AND is_read = 0`,
      [req.user.id]
    );
    res.json({ unread: rows[0].unread });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.markRead = async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await db.query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND role = 'user' AND is_read = 0",
      [req.user.id]
    );
    res.json({ message: 'All marked read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
