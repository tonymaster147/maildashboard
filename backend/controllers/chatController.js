const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { filterMessage } = require('../services/contentFilter');
const { uploadChatAttachment } = require('../config/drive');

/**
 * 2-way chat channels stored in `channel` column:
 *   'tutor'   → User <-> Tutor
 *   'support' → User <-> Admin/Sales
 *
 * Read tracking uses chat_read_cursors (per-user, per-order, per-role timestamps).
 */

// Auto-detect channel from role (tutor/admin/sales)
// User must specify channel explicitly via query param
function getChannelForRole(role) {
  if (role === 'tutor') return 'tutor';
  if (['admin', 'sales_lead', 'sales_executive'].includes(role)) return 'support';
  return null; // user — needs explicit channel
}

/**
 * Get chat messages for an order
 * Query params: ?channel=tutor|support (required for user, auto-detected for others)
 */
exports.getMessages = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    // Verify access
    if (role === 'user') {
      const [orders] = await db.query('SELECT id FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
      if (orders.length === 0) return res.status(403).json({ error: 'Access denied' });
    } else if (role === 'tutor') {
      const [assignments] = await db.query('SELECT id FROM order_tutors WHERE order_id = ? AND tutor_id = ?', [orderId, userId]);
      if (assignments.length === 0) return res.status(403).json({ error: 'Access denied' });
    }

    // Determine channel filter ('all' = no filter, for monitoring)
    const rawChannel = req.query.channel || getChannelForRole(role);
    const channel = rawChannel === 'all' ? null : rawChannel;
    const channelFilter = channel ? `AND c.channel = ?` : '';
    const channelParams = channel ? [channel] : [];

    const [messages] = await db.query(
      `SELECT c.*,
        CASE
          WHEN c.sender_role = 'user' THEN u.username
          WHEN c.sender_role = 'tutor' THEN t.name
          WHEN c.sender_role = 'admin' THEN 'Admin'
          WHEN c.sender_role IN ('sales_lead', 'sales_executive') THEN COALESCE(su.name, 'Sales')
        END as sender_name
       FROM chats c
       LEFT JOIN users u ON c.sender_id = u.id AND c.sender_role = 'user'
       LEFT JOIN tutors t ON c.sender_id = t.id AND c.sender_role = 'tutor'
       LEFT JOIN sales_users su ON c.sender_id = su.id AND c.sender_role IN ('sales_lead', 'sales_executive')
       WHERE c.order_id = ? ${channelFilter}
       ORDER BY c.created_at ASC`,
      [orderId, ...channelParams]
    );

    // Update read cursor
    await db.query(
      `INSERT INTO chat_read_cursors (order_id, user_id, role, last_read_at)
       VALUES (?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE last_read_at = NOW(3)`,
      [orderId, userId, role]
    );

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Send a chat attachment (one file per call, 10MB cap enforced by multer).
 * Uploads to Google Drive (per-order subfolder), inserts a chat row with the
 * attachment metadata and a NULL message, then broadcasts the same
 * `newMessage` event the socket uses so connected clients render the bubble.
 */
exports.sendAttachment = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const localPath = file.path;
  let driveFileId = null;
  try {
    const { orderId } = req.params;
    const senderId = req.user.id;
    const senderRole = req.user.role;

    // Access checks
    const [orders] = await db.query('SELECT chat_enabled, user_id FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0)                  return res.status(404).json({ error: 'Order not found' });
    if (!orders[0].chat_enabled)              return res.status(403).json({ error: 'Chat is disabled for this order' });
    const orderOwnerId = orders[0].user_id;

    if (senderRole === 'user') {
      const [own] = await db.query('SELECT id FROM orders WHERE id = ? AND user_id = ?', [orderId, senderId]);
      if (own.length === 0) return res.status(403).json({ error: 'Access denied' });
    } else if (senderRole === 'tutor') {
      const [assg] = await db.query('SELECT id FROM order_tutors WHERE order_id = ? AND tutor_id = ?', [orderId, senderId]);
      if (assg.length === 0) return res.status(403).json({ error: 'Access denied' });
    }

    // Channel resolution (same rules as sendMessage)
    let channel;
    if (senderRole === 'tutor') channel = 'tutor';
    else if (['admin', 'sales_lead', 'sales_executive'].includes(senderRole)) channel = 'support';
    else channel = req.body.channel || 'support';

    // Upload to Drive (per-order subfolder)
    const drive = await uploadChatAttachment(localPath, file.originalname, file.mimetype, orderId);
    driveFileId = drive.fileId;

    const [result] = await db.query(
      `INSERT INTO chats (order_id, sender_id, sender_role, channel, message,
         attachment_url, attachment_name, attachment_mime, attachment_size, attachment_drive_id)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      [orderId, senderId, senderRole, channel, drive.fileUrl, file.originalname, file.mimetype, file.size, drive.fileId]
    );

    // Resolve sender_name for emitted payload
    let senderName = 'Admin';
    if (senderRole === 'user')   { const [r] = await db.query('SELECT username FROM users WHERE id = ?', [senderId]); senderName = r[0]?.username || 'User'; }
    if (senderRole === 'tutor')  { const [r] = await db.query('SELECT name FROM tutors WHERE id = ?', [senderId]); senderName = r[0]?.name || 'Tutor'; }
    if (['sales_lead', 'sales_executive'].includes(senderRole)) {
      const [r] = await db.query('SELECT name FROM sales_users WHERE id = ?', [senderId]); senderName = r[0]?.name || 'Sales';
    }

    const messageData = {
      id: result.insertId,
      order_id: parseInt(orderId, 10),
      sender_id: senderId,
      sender_role: senderRole,
      sender_name: senderName,
      channel,
      message: null,
      attachment_url: drive.fileUrl,
      attachment_name: file.originalname,
      attachment_mime: file.mimetype,
      attachment_size: file.size,
      attachment_drive_id: drive.fileId,
      is_flagged: 0,
      created_at: new Date()
    };

    // Broadcast through socket (same channel-aware routing as text messages)
    const io = req.app.get('io');
    if (io) {
      if (channel === 'tutor') {
        io.to(`user_${orderOwnerId}`).emit('newMessage', messageData);
        const [tutors] = await db.query('SELECT tutor_id FROM order_tutors WHERE order_id = ?', [orderId]);
        for (const t of tutors) {
          io.to(`tutor_${t.tutor_id}`).emit('newMessage', messageData);
          io.to(`tutor_${t.tutor_id}`).emit('chatNotification', { order_id: messageData.order_id, sender_name: senderName, message: `📎 ${file.originalname}`, channel });
        }
      } else {
        io.to(`user_${orderOwnerId}`).emit('newMessage', messageData);
        for (const [, s] of io.sockets.sockets) {
          if (s.user && ['admin', 'sales_lead', 'sales_executive'].includes(s.user.role)) {
            s.emit('newMessage', messageData);
            if (senderRole === 'user') s.emit('chatNotification', { order_id: messageData.order_id, sender_name: senderName, message: `📎 ${file.originalname}`, channel });
          }
        }
      }
    }

    res.status(201).json(messageData);
  } catch (err) {
    console.error('Chat attachment error:', err);
    // Best-effort: nothing to roll back on Drive (uploaded file stays harmless)
    res.status(500).json({ error: err.message || 'Failed to upload attachment' });
  } finally {
    // Always clean up the local temp file
    fs.promises.unlink(localPath).catch(() => {});
  }
};

/**
 * Send a chat message (REST fallback)
 */
exports.sendMessage = async (req, res) => {
  try {
    const { order_id, message, channel } = req.body;
    const senderId = req.user.id;
    const senderRole = req.user.role;

    const [orders] = await db.query('SELECT chat_enabled, status FROM orders WHERE id = ?', [order_id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (!orders[0].chat_enabled) return res.status(403).json({ error: 'Chat is disabled for this order' });

    // Determine channel
    const msgChannel = channel || getChannelForRole(senderRole) || 'support';

    const { filteredMessage, isFlagged, flagReason } = filterMessage(message);

    const [result] = await db.query(
      'INSERT INTO chats (order_id, sender_id, sender_role, channel, message, is_flagged, flag_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [order_id, senderId, senderRole, msgChannel, filteredMessage, isFlagged ? 1 : 0, flagReason || null]
    );

    if (isFlagged) {
      await db.query(
        'INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
        ['admin', 'flagged_message', `Flagged message in order ${await require('../utils/orderCode').formatOrderRef(order_id)}: ${flagReason}`, result.insertId, 'chat']
      );
    }

    res.status(201).json({
      id: result.insertId, order_id, sender_id: senderId, sender_role: senderRole,
      channel: msgChannel, message: filteredMessage, is_flagged: isFlagged, created_at: new Date()
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get unread message count
 * For users: returns { tutor: N, support: N } (per-channel)
 * For tutors/admin/sales: returns { unread: N }
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'user') {
      // User gets per-channel counts
      const [results] = await db.query(
        `SELECT c.channel, COUNT(*) as count FROM chats c
         JOIN orders o ON c.order_id = o.id
         LEFT JOIN chat_read_cursors crc ON c.order_id = crc.order_id AND crc.user_id = ? AND crc.role = 'user'
         WHERE o.user_id = ? AND c.sender_role != 'user'
           AND (crc.last_read_at IS NULL OR c.created_at > crc.last_read_at)
         GROUP BY c.channel`,
        [userId, userId]
      );
      const counts = { tutor: 0, support: 0 };
      results.forEach(r => { counts[r.channel] = r.count; });
      // Also return total for backward compat
      res.json({ unread: counts.tutor + counts.support, ...counts });
    } else if (role === 'tutor') {
      const [result] = await db.query(
        `SELECT COUNT(*) as count FROM chats c
         JOIN order_tutors ot ON c.order_id = ot.order_id
         LEFT JOIN chat_read_cursors crc ON c.order_id = crc.order_id AND crc.user_id = ? AND crc.role = 'tutor'
         WHERE ot.tutor_id = ? AND c.channel = 'tutor' AND c.sender_role = 'user'
           AND (crc.last_read_at IS NULL OR c.created_at > crc.last_read_at)`,
        [userId, userId]
      );
      res.json({ unread: result[0].count });
    } else {
      // admin, sales_lead, sales_executive
      const [result] = await db.query(
        `SELECT COUNT(*) as count FROM chats c
         LEFT JOIN chat_read_cursors crc ON c.order_id = crc.order_id AND crc.user_id = ? AND crc.role = ?
         WHERE c.channel = 'support' AND c.sender_role = 'user'
           AND (crc.last_read_at IS NULL OR c.created_at > crc.last_read_at)`,
        [userId, role]
      );
      res.json({ unread: result[0].count });
    }
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Mark all messages as read (update cursors)
 */
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'user') {
      await db.query(
        `INSERT INTO chat_read_cursors (order_id, user_id, role, last_read_at)
         SELECT id, ?, 'user', NOW(3) FROM orders WHERE user_id = ?
         ON DUPLICATE KEY UPDATE last_read_at = NOW(3)`,
        [userId, userId]
      );
    } else if (role === 'tutor') {
      await db.query(
        `INSERT INTO chat_read_cursors (order_id, user_id, role, last_read_at)
         SELECT order_id, ?, 'tutor', NOW(3) FROM order_tutors WHERE tutor_id = ?
         ON DUPLICATE KEY UPDATE last_read_at = NOW(3)`,
        [userId, userId]
      );
    } else {
      await db.query(
        `INSERT INTO chat_read_cursors (order_id, user_id, role, last_read_at)
         SELECT DISTINCT order_id, ?, ?, NOW(3) FROM chats WHERE channel = 'support' AND sender_role = 'user'
         ON DUPLICATE KEY UPDATE last_read_at = NOW(3)`,
        [userId, role]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get unread count per order
 * For users: returns { orderId: { tutor: N, support: N } }
 * For tutors/admin: returns { orderId: N }
 */
exports.getUnreadPerOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'user') {
      const [results] = await db.query(
        `SELECT c.order_id, c.channel, COUNT(*) as count FROM chats c
         JOIN orders o ON c.order_id = o.id
         LEFT JOIN chat_read_cursors crc ON c.order_id = crc.order_id AND crc.user_id = ? AND crc.role = 'user'
         WHERE o.user_id = ? AND c.sender_role != 'user'
           AND (crc.last_read_at IS NULL OR c.created_at > crc.last_read_at)
         GROUP BY c.order_id, c.channel`,
        [userId, userId]
      );
      // Build { orderId: { tutor: N, support: N } }
      const unreadMap = {};
      results.forEach(r => {
        if (!unreadMap[r.order_id]) unreadMap[r.order_id] = { tutor: 0, support: 0 };
        unreadMap[r.order_id][r.channel] = r.count;
      });
      res.json(unreadMap);
    } else if (role === 'tutor') {
      const [results] = await db.query(
        `SELECT c.order_id, COUNT(*) as count FROM chats c
         JOIN order_tutors ot ON c.order_id = ot.order_id
         LEFT JOIN chat_read_cursors crc ON c.order_id = crc.order_id AND crc.user_id = ? AND crc.role = 'tutor'
         WHERE ot.tutor_id = ? AND c.channel = 'tutor' AND c.sender_role = 'user'
           AND (crc.last_read_at IS NULL OR c.created_at > crc.last_read_at)
         GROUP BY c.order_id`,
        [userId, userId]
      );
      const unreadMap = {};
      results.forEach(r => { unreadMap[r.order_id] = r.count; });
      res.json(unreadMap);
    } else {
      const [results] = await db.query(
        `SELECT c.order_id, COUNT(*) as count FROM chats c
         LEFT JOIN chat_read_cursors crc ON c.order_id = crc.order_id AND crc.user_id = ? AND crc.role = ?
         WHERE c.channel = 'support' AND c.sender_role = 'user'
           AND (crc.last_read_at IS NULL OR c.created_at > crc.last_read_at)
         GROUP BY c.order_id`,
        [userId, role]
      );
      const unreadMap = {};
      results.forEach(r => { unreadMap[r.order_id] = r.count; });
      res.json(unreadMap);
    }
  } catch (error) {
    console.error('Get unread per order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
