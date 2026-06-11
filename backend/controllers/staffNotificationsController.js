// Notification feed for staff (admin / sales_lead / sales_executive) and
// tutors — powers the bell panel in both panels, mirroring the student feed.
//
// Staff rows are role-broadcast (shared read-state per role, matching the
// existing schema usage). Tutor rows are per-tutor (tutor_id).

const db = require('../config/db');

const LIST_LIMIT = 30;

// Build the WHERE clause + params for the caller's identity.
function scopeFor(req) {
  const role = req.user.role;
  if (role === 'tutor') {
    return { where: "role = 'tutor' AND tutor_id = ?", params: [req.user.id] };
  }
  // Staff broadcast rows have no user/tutor binding.
  return { where: 'role = ? AND user_id IS NULL AND tutor_id IS NULL', params: [role] };
}

exports.list = async (req, res) => {
  try {
    const { where, params } = scopeFor(req);
    const [rows] = await db.query(
      `SELECT id, type, message, is_read, reference_id, reference_type, created_at
       FROM notifications WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ${LIST_LIMIT}`,
      params
    );
    res.json({ notifications: rows });
  } catch (error) {
    console.error('Staff notifications list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const { where, params } = scopeFor(req);
    const [rows] = await db.query(
      `SELECT COUNT(*) AS unread FROM notifications WHERE ${where} AND is_read = 0`,
      params
    );
    res.json({ unread: rows[0].unread });
  } catch (error) {
    console.error('Staff notifications unread error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { where, params } = scopeFor(req);
    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND ${where}`,
      [req.params.id, ...params]
    );
    res.json({ message: 'Marked read' });
  } catch (error) {
    console.error('Staff notification mark read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const { where, params } = scopeFor(req);
    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE ${where} AND is_read = 0`,
      params
    );
    res.json({ message: 'All marked read' });
  } catch (error) {
    console.error('Staff notifications mark all error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
