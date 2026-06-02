// Issue / support-ticket flow.
//   - User opens an issue (optionally linked to one of their orders).
//   - Admin + every active sales user receive an email.
//   - Replies on either side flip last_message_role and bump last_message_at.
//   - Admin/sales can close; only admin/sales can reopen.

const db = require('../config/db');
const { formatOrderRef } = require('../utils/orderCode');
const {
  sendIssueCreated,
  sendIssueReplyToUser,
  sendIssueReplyToAdmin
} = require('../services/emailService');

const ALLOWED_CATEGORIES = [
  'Unresponsive Tutor',
  'Underperformance by Tutor',
  'Missed Assignments',
  "Can't reach customer service",
  'Other'
];
const ADMIN_EMAIL = 'faruqui.a4u@gmail.com';

async function getAdminAndSalesRecipients() {
  const [sales] = await db.query("SELECT email FROM sales_users WHERE status = 'active' AND email IS NOT NULL");
  return [ADMIN_EMAIL, ...sales.map(s => s.email)].filter(Boolean);
}

function isStaff(role) {
  return ['admin', 'sales_lead', 'sales_executive'].includes(role);
}

// Auto-generated subject
async function buildSubject(category, orderId) {
  if (!orderId) return category;
  const ref = await formatOrderRef(orderId);
  return `${category} — Order ${ref}`;
}

// ───────────────────────── USER ENDPOINTS ─────────────────────────

exports.listMyIssues = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      `SELECT i.*, o.order_code,
        (SELECT message FROM issue_messages WHERE issue_id = i.id ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM issues i
       LEFT JOIN orders o ON i.order_id = o.id
       WHERE i.user_id = ?
       ORDER BY i.last_message_at DESC, i.created_at DESC`,
      [userId]
    );
    res.json({ issues: rows });
  } catch (err) {
    console.error('listMyIssues error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createIssue = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, order_id, description } = req.body;

    if (!ALLOWED_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
    if (!description || description.trim().length < 5) return res.status(400).json({ error: 'Please describe the issue (at least 5 characters)' });

    let resolvedOrderId = null;
    if (order_id) {
      const [own] = await db.query('SELECT id FROM orders WHERE id = ? AND user_id = ?', [order_id, userId]);
      if (own.length === 0) return res.status(400).json({ error: 'Order not found or not yours' });
      resolvedOrderId = own[0].id;
    }

    const subject = await buildSubject(category, resolvedOrderId);

    const [result] = await db.query(
      `INSERT INTO issues (user_id, order_id, category, subject, status, last_message_at, last_message_role)
       VALUES (?, ?, ?, ?, 'open', NOW(), 'user')`,
      [userId, resolvedOrderId, category, subject]
    );
    const issueId = result.insertId;

    await db.query(
      'INSERT INTO issue_messages (issue_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)',
      [issueId, userId, 'user', description.trim()]
    );

    // In-app notifications for admin + sales
    const msg = `New issue #${issueId} — ${subject}`;
    for (const role of ['admin', 'sales_lead', 'sales_executive']) {
      await db.query('INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
        [role, 'issue_created', msg, issueId, 'issue']);
    }

    // Email admin + sales (non-blocking)
    const [[user]] = await db.query('SELECT username, email FROM users WHERE id = ?', [userId]);
    const recipients = await getAdminAndSalesRecipients();
    sendIssueCreated({
      issueId,
      subject,
      category,
      description: description.trim(),
      userName: user?.username,
      userEmail: user?.email,
      orderId: resolvedOrderId,
      recipients
    }).catch(e => console.error('Issue created email error:', e));

    res.status(201).json({ id: issueId, subject });
  } catch (err) {
    console.error('createIssue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getIssueDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const userId = req.user.id;

    const [issues] = await db.query(
      `SELECT i.*, o.order_code, u.username AS user_name, u.email AS user_email
       FROM issues i
       LEFT JOIN orders o ON i.order_id = o.id
       JOIN users u ON i.user_id = u.id
       WHERE i.id = ?`,
      [id]
    );
    if (issues.length === 0) return res.status(404).json({ error: 'Issue not found' });
    const issue = issues[0];

    // Access: owner OR admin/sales
    if (!isStaff(role) && issue.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const [messages] = await db.query(
      `SELECT m.*,
        CASE m.sender_role
          WHEN 'user'  THEN u.username
          WHEN 'admin' THEN 'Admin'
          ELSE COALESCE(su.name, 'Sales')
        END AS sender_name
       FROM issue_messages m
       LEFT JOIN users u ON m.sender_id = u.id AND m.sender_role = 'user'
       LEFT JOIN sales_users su ON m.sender_id = su.id AND m.sender_role IN ('sales_lead','sales_executive')
       WHERE m.issue_id = ?
       ORDER BY m.created_at ASC`,
      [id]
    );

    // Bump the appropriate read cursor so the sidebar badge clears for that role
    if (role === 'user') {
      await db.query('UPDATE issues SET user_seen_at = NOW() WHERE id = ?', [id]);
    } else {
      await db.query('UPDATE issues SET staff_seen_at = NOW() WHERE id = ?', [id]);
    }

    res.json({ issue, messages });
  } catch (err) {
    console.error('getIssueDetail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Unread issue count for the calling role.
 *   User:  count of own issues where staff replied since user_seen_at.
 *   Staff: count of issues where the user replied since staff_seen_at.
 */
exports.unreadCount = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    let count = 0;
    if (role === 'user') {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS n FROM issues
         WHERE user_id = ?
           AND last_message_role <> 'user'
           AND (user_seen_at IS NULL OR last_message_at > user_seen_at)`,
        [userId]
      );
      count = rows[0].n;
    } else if (isStaff(role)) {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS n FROM issues
         WHERE last_message_role = 'user'
           AND (staff_seen_at IS NULL OR last_message_at > staff_seen_at)`
      );
      count = rows[0].n;
    }
    res.json({ unread: count });
  } catch (err) {
    console.error('unreadCount error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const senderId = req.user.id;
    const { message } = req.body;
    if (!message || message.trim().length === 0) return res.status(400).json({ error: 'Message is required' });

    const [issues] = await db.query(
      `SELECT i.*, u.email AS user_email, u.username AS user_name
       FROM issues i JOIN users u ON i.user_id = u.id WHERE i.id = ?`,
      [id]
    );
    if (issues.length === 0) return res.status(404).json({ error: 'Issue not found' });
    const issue = issues[0];

    if (!isStaff(role) && issue.user_id !== senderId) return res.status(403).json({ error: 'Access denied' });
    if (issue.status === 'closed') return res.status(400).json({ error: 'This issue is closed. Ask support to reopen it.' });

    await db.query(
      'INSERT INTO issue_messages (issue_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)',
      [id, senderId, role, message.trim()]
    );
    await db.query(
      'UPDATE issues SET last_message_at = NOW(), last_message_role = ? WHERE id = ?',
      [role, id]
    );

    // Notify the OTHER side
    if (role === 'user') {
      const notifMsg = `User replied on issue #${id}`;
      for (const r of ['admin', 'sales_lead', 'sales_executive']) {
        await db.query('INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
          [r, 'issue_reply', notifMsg, id, 'issue']);
      }
      const recipients = await getAdminAndSalesRecipients();
      sendIssueReplyToAdmin({ issueId: id, subject: issue.subject, body: message.trim(), userName: issue.user_name, recipients })
        .catch(e => console.error('Issue reply admin email error:', e));
    } else {
      // Admin/sales replying
      if (issue.user_email) {
        sendIssueReplyToUser({ issueId: id, subject: issue.subject, body: message.trim(), userName: issue.user_name, to: issue.user_email })
          .catch(e => console.error('Issue reply user email error:', e));
      }
      await db.query('INSERT INTO notifications (user_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
        [issue.user_id, 'user', 'issue_reply', `Support replied on issue #${id}`, id, 'issue']);
    }

    res.status(201).json({ message: 'Reply added' });
  } catch (err) {
    console.error('addMessage error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ───────────────────────── STAFF ENDPOINTS ─────────────────────────

exports.listAllIssues = async (req, res) => {
  try {
    const { status, search } = req.query;
    let q = `SELECT i.*, o.order_code, u.username AS user_name, u.email AS user_email,
              (SELECT message FROM issue_messages WHERE issue_id = i.id ORDER BY created_at DESC LIMIT 1) AS last_message
             FROM issues i
             JOIN users u ON i.user_id = u.id
             LEFT JOIN orders o ON i.order_id = o.id
             WHERE 1=1`;
    const params = [];
    if (status === 'open' || status === 'closed') { q += ' AND i.status = ?'; params.push(status); }
    if (search) {
      q += ' AND (i.subject LIKE ? OR i.category LIKE ? OR u.username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    q += ' ORDER BY i.last_message_at DESC, i.created_at DESC';
    const [rows] = await db.query(q, params);
    res.json({ issues: rows });
  } catch (err) {
    console.error('listAllIssues error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.closeIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    await db.query(
      "UPDATE issues SET status = 'closed', closed_at = NOW(), closed_by_role = ? WHERE id = ?",
      [role, id]
    );

    const [[issue]] = await db.query('SELECT user_id, subject FROM issues WHERE id = ?', [id]);
    if (issue) {
      await db.query('INSERT INTO notifications (user_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
        [issue.user_id, 'user', 'issue_closed', `Issue #${id} has been closed`, id, 'issue']);
    }
    res.json({ message: 'Issue closed' });
  } catch (err) {
    console.error('closeIssue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.reopenIssue = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE issues SET status = 'open', closed_at = NULL, closed_by_role = NULL WHERE id = ?", [id]);
    res.json({ message: 'Issue reopened' });
  } catch (err) {
    console.error('reopenIssue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.ALLOWED_CATEGORIES = ALLOWED_CATEGORIES;
