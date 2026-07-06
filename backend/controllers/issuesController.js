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
const { getAdminEmails } = require('../services/settings');

const ALLOWED_CATEGORIES = [
  'Unresponsive Tutor',
  'Underperformance by Tutor',
  'Missed Assignments',
  "Can't reach customer service",
  'Other'
];
async function getAdminAndSalesRecipients() {
  const [sales] = await db.query("SELECT email FROM sales_users WHERE status = 'active' AND email IS NOT NULL");
  const adminEmails = await getAdminEmails();
  return [...adminEmails, ...sales.map(s => s.email)].filter(Boolean);
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

    // In-app notifications for admin + sales (persisted + live panel push)
    {
      const io = req.app.get('io');
      const { notifyStaff } = require('../services/notifyUser');
      await notifyStaff(io, {
        type: 'issue_created',
        message: `New issue #${issueId} — ${subject}`,
        referenceId: issueId,
        referenceType: 'issue',
      }).catch(e => console.error('issue_created staff notify failed:', e.message));
      // Sidebar badge bump
      if (io) io.to('admin_monitor').emit('issueNotification', { issue_id: issueId, kind: 'created' });
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
      `SELECT i.*, o.order_code, u.username AS user_name, u.email AS user_email,
              et.name AS escalated_tutor_name
       FROM issues i
       LEFT JOIN orders o ON i.order_id = o.id
       JOIN users u ON i.user_id = u.id
       LEFT JOIN tutors et ON i.escalated_tutor_id = et.id
       WHERE i.id = ?`,
      [id]
    );
    if (issues.length === 0) return res.status(404).json({ error: 'Issue not found' });
    const issue = issues[0];

    // Access: owner, admin/sales, or the escalated tutor
    if (role === 'tutor') {
      if (issue.escalated_tutor_id !== userId) return res.status(403).json({ error: 'Access denied' });
    } else if (!isStaff(role) && issue.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [messages] = await db.query(
      `SELECT m.*,
        CASE m.sender_role
          WHEN 'user'  THEN u.username
          WHEN 'admin' THEN 'Admin'
          WHEN 'tutor' THEN COALESCE(tut.name, 'Tutor')
          ELSE COALESCE(su.name, 'Sales')
        END AS sender_name
       FROM issue_messages m
       LEFT JOIN users u ON m.sender_id = u.id AND m.sender_role = 'user'
       LEFT JOIN tutors tut ON m.sender_id = tut.id AND m.sender_role = 'tutor'
       LEFT JOIN sales_users su ON m.sender_id = su.id AND m.sender_role IN ('sales_lead','sales_executive')
       WHERE m.issue_id = ?
       ORDER BY m.created_at ASC`,
      [id]
    );

    // Bump the appropriate read cursor so the sidebar badge clears for that role
    if (role === 'user') {
      await db.query('UPDATE issues SET user_seen_at = NOW() WHERE id = ?', [id]);
    } else if (role === 'tutor') {
      await db.query('UPDATE issues SET tutor_seen_at = NOW() WHERE id = ?', [id]);
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
    } else if (role === 'tutor') {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS n FROM issues
         WHERE escalated_tutor_id = ?
           AND last_message_role <> 'tutor'
           AND (tutor_seen_at IS NULL OR last_message_at > tutor_seen_at)`,
        [userId]
      );
      count = rows[0].n;
    } else if (isStaff(role)) {
      let q = `SELECT COUNT(*) AS n FROM issues
         WHERE last_message_role = 'user'
           AND (staff_seen_at IS NULL OR last_message_at > staff_seen_at)`;
      const p = [];
      if (req.salesCutoff) { q += ' AND created_at >= ?'; p.push(req.salesCutoff); }
      const [rows] = await db.query(q, p);
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

    // Access: owner, staff, or the escalated tutor
    if (role === 'tutor') {
      if (issue.escalated_tutor_id !== senderId) return res.status(403).json({ error: 'Access denied' });
    } else if (!isStaff(role) && issue.user_id !== senderId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (issue.status === 'closed') return res.status(400).json({ error: 'This ticket is closed. Ask support to reopen it.' });

    await db.query(
      'INSERT INTO issue_messages (issue_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)',
      [id, senderId, role, message.trim()]
    );
    await db.query(
      'UPDATE issues SET last_message_at = NOW(), last_message_role = ? WHERE id = ?',
      [role, id]
    );

    // ── 3-way fan-out: notify every party except the sender ──
    const io = req.app.get('io');
    const { notifyUser, notifyStaff, notifyTutor } = require('../services/notifyUser');
    const senderName = role === 'user' ? (issue.user_name || 'Student') : role === 'tutor' ? 'Tutor' : 'Support';

    // Student
    if (role !== 'user') {
      await notifyUser(io, issue.user_id, {
        type: 'issue_reply', message: `New reply on escalation #${id}`, referenceId: Number(id), referenceType: 'issue',
      }).catch(e => console.error('issue reply user notify failed:', e.message));
      if (issue.user_email) {
        sendIssueReplyToUser({ issueId: id, subject: issue.subject, body: message.trim(), userName: senderName, to: issue.user_email })
          .catch(e => console.error('Issue reply user email error:', e));
      }
    }
    // Admin + sales
    if (!isStaff(role)) {
      await notifyStaff(io, {
        type: 'issue_reply', message: `${senderName} replied on escalation #${id} — ${issue.subject}`, referenceId: Number(id), referenceType: 'issue',
      }).catch(e => console.error('issue_reply staff notify failed:', e.message));
      if (io) io.to('admin_monitor').emit('issueNotification', { issue_id: Number(id), kind: 'reply' });
      const recipients = await getAdminAndSalesRecipients();
      sendIssueReplyToAdmin({ issueId: id, subject: issue.subject, body: message.trim(), userName: senderName, recipients })
        .catch(e => console.error('Issue reply admin email error:', e));
    }
    // Escalated tutor
    if (issue.escalated_tutor_id && role !== 'tutor') {
      await notifyTutor(io, issue.escalated_tutor_id, {
        type: 'issue_reply', message: `New reply on escalation #${id} — ${issue.subject}`, referenceId: Number(id), referenceType: 'issue',
      }).catch(e => console.error('issue reply tutor notify failed:', e.message));
      const [[tut]] = await db.query('SELECT email FROM tutors WHERE id = ?', [issue.escalated_tutor_id]);
      if (tut?.email) {
        sendIssueReplyToUser({ issueId: id, subject: issue.subject, body: message.trim(), userName: senderName, to: tut.email })
          .catch(e => console.error('Issue reply tutor email error:', e));
      }
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
    if (req.salesCutoff) { q += ' AND i.created_at >= ?'; params.push(req.salesCutoff); }
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
      const { notifyUser } = require('../services/notifyUser');
      await notifyUser(req.app.get('io'), issue.user_id, {
        type: 'issue_closed',
        message: `Issue #${id} has been closed`,
        referenceId: Number(id),
        referenceType: 'issue',
      });
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

    const [[issue]] = await db.query('SELECT user_id FROM issues WHERE id = ?', [id]);
    if (issue) {
      const { notifyUser } = require('../services/notifyUser');
      await notifyUser(req.app.get('io'), issue.user_id, {
        type: 'issue_reply',
        message: `Issue #${id} has been reopened by support`,
        referenceId: Number(id),
        referenceType: 'issue',
      }).catch(e => console.error('issue reopen notify failed:', e.message));
    }

    res.json({ message: 'Issue reopened' });
  } catch (err) {
    console.error('reopenIssue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Staff escalate a ticket to a tutor (the tutor joins the thread).
exports.escalateToTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const { tutor_id } = req.body;
    const [[tutor]] = await db.query("SELECT id, name, email FROM tutors WHERE id = ? AND status = 'active'", [tutor_id]);
    if (!tutor) return res.status(400).json({ error: 'Tutor not found or inactive' });
    const [[issue]] = await db.query('SELECT * FROM issues WHERE id = ?', [id]);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    await db.query('UPDATE issues SET escalated_tutor_id = ?, escalated_at = NOW() WHERE id = ?', [tutor_id, id]);

    // Post a visible system note (as the escalating staff) so all parties see it.
    const note = `🔺 Escalated to tutor ${tutor.name}.`;
    await db.query('INSERT INTO issue_messages (issue_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)', [id, req.user.id, req.user.role, note]);
    await db.query('UPDATE issues SET last_message_at = NOW(), last_message_role = ? WHERE id = ?', [req.user.role, id]);

    const io = req.app.get('io');
    const { notifyTutor, notifyUser } = require('../services/notifyUser');
    await notifyTutor(io, tutor_id, {
      type: 'issue_escalated', message: `New escalation assigned — #${id}: ${issue.subject}`,
      referenceId: Number(id), referenceType: 'issue',
    }).catch(e => console.error('escalation tutor notify failed:', e.message));
    if (tutor.email) {
      const { sendIssueEscalatedTutor } = require('../services/emailService');
      sendIssueEscalatedTutor({ issueId: id, subject: issue.subject, tutorName: tutor.name, to: tutor.email })
        .catch(e => console.error('escalation tutor email failed:', e.message));
    }
    await notifyUser(io, issue.user_id, {
      type: 'issue_reply', message: `Your escalation #${id} was assigned to a tutor`,
      referenceId: Number(id), referenceType: 'issue',
    }).catch(() => {});

    res.json({ message: 'Escalated to tutor', tutor: { id: tutor.id, name: tutor.name } });
  } catch (err) {
    console.error('escalateToTutor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Tickets escalated to the calling tutor.
exports.listTutorEscalations = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { status } = req.query;
    let q = `SELECT i.*, o.order_code, u.username AS user_name,
              (SELECT message FROM issue_messages WHERE issue_id = i.id ORDER BY created_at DESC LIMIT 1) AS last_message,
              (i.last_message_role <> 'tutor' AND (i.tutor_seen_at IS NULL OR i.last_message_at > i.tutor_seen_at)) AS unread
             FROM issues i
             JOIN users u ON i.user_id = u.id
             LEFT JOIN orders o ON i.order_id = o.id
             WHERE i.escalated_tutor_id = ?`;
    const p = [tutorId];
    if (status === 'open' || status === 'closed') { q += ' AND i.status = ?'; p.push(status); }
    q += ' ORDER BY i.last_message_at DESC, i.created_at DESC';
    const [rows] = await db.query(q, p);
    res.json({ issues: rows });
  } catch (err) {
    console.error('listTutorEscalations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.ALLOWED_CATEGORIES = ALLOWED_CATEGORIES;
