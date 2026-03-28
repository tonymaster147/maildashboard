const db = require('../config/db');
const { filterMessage } = require('../services/contentFilter');

/**
 * Get chat messages for an order
 */
exports.getMessages = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    // Verify access
    if (role === 'user') {
      const [orders] = await db.query('SELECT id FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
      if (orders.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (role === 'tutor') {
      const [assignments] = await db.query(
        'SELECT id FROM order_tutors WHERE order_id = ? AND tutor_id = ?',
        [orderId, userId]
      );
      if (assignments.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const [messages] = await db.query(
      `SELECT c.*, 
        CASE 
          WHEN c.sender_role = 'user' THEN u.username
          WHEN c.sender_role = 'tutor' THEN t.name
          WHEN c.sender_role = 'admin' THEN 'Admin'
        END as sender_name
       FROM chats c
       LEFT JOIN users u ON c.sender_id = u.id AND c.sender_role = 'user'
       LEFT JOIN tutors t ON c.sender_id = t.id AND c.sender_role = 'tutor'
       WHERE c.order_id = ?
       ORDER BY c.created_at ASC`,
      [orderId]
    );

    // Mark messages as read
    await db.query(
      'UPDATE chats SET is_read = 1 WHERE order_id = ? AND sender_id != ? AND is_read = 0',
      [orderId, userId]
    );

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Send a chat message (REST fallback, primary through Socket.io)
 */
exports.sendMessage = async (req, res) => {
  try {
    const { order_id, message } = req.body;
    const senderId = req.user.id;
    const senderRole = req.user.role;

    // Check if chat is enabled for this order
    const [orders] = await db.query('SELECT chat_enabled, status FROM orders WHERE id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!orders[0].chat_enabled) {
      return res.status(403).json({ error: 'Chat is disabled for this order' });
    }

    // Filter message content
    const { filteredMessage, isFlagged, flagReason } = filterMessage(message);

    const [result] = await db.query(
      'INSERT INTO chats (order_id, sender_id, sender_role, message, is_flagged, flag_reason) VALUES (?, ?, ?, ?, ?, ?)',
      [order_id, senderId, senderRole, filteredMessage, isFlagged ? 1 : 0, flagReason || null]
    );

    // If flagged, create admin notification
    if (isFlagged) {
      await db.query(
        'INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
        ['admin', 'flagged_message', `Flagged message in order #${order_id}: ${flagReason}`, result.insertId, 'chat']
      );
    }

    res.status(201).json({
      id: result.insertId,
      order_id,
      sender_id: senderId,
      sender_role: senderRole,
      message: filteredMessage,
      is_flagged: isFlagged,
      created_at: new Date()
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get unread message count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let query;
    if (role === 'user') {
      query = `
        SELECT COUNT(*) as count FROM chats c
        JOIN orders o ON c.order_id = o.id
        WHERE o.user_id = ? AND c.sender_role != 'user' AND c.is_read = 0
      `;
    } else if (role === 'tutor') {
      query = `
        SELECT COUNT(*) as count FROM chats c
        JOIN order_tutors ot ON c.order_id = ot.order_id
        WHERE ot.tutor_id = ? AND c.sender_role != 'tutor' AND c.is_read = 0
      `;
    } else {
      query = `SELECT COUNT(*) as count FROM chats WHERE is_read = 0 AND sender_role != 'admin'`;
    }

    const [result] = await db.query(query, role !== 'admin' ? [userId] : []);
    res.json({ unread: result[0].count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get unread message count per order
 */
exports.getUnreadPerOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let query;
    if (role === 'user') {
      query = `
        SELECT c.order_id, COUNT(*) as count FROM chats c
        JOIN orders o ON c.order_id = o.id
        WHERE o.user_id = ? AND c.sender_role != 'user' AND c.is_read = 0
        GROUP BY c.order_id
      `;
    } else if (role === 'tutor') {
      query = `
        SELECT c.order_id, COUNT(*) as count FROM chats c
        JOIN order_tutors ot ON c.order_id = ot.order_id
        WHERE ot.tutor_id = ? AND c.sender_role != 'tutor' AND c.is_read = 0
        GROUP BY c.order_id
      `;
    } else {
      query = `SELECT order_id, COUNT(*) as count FROM chats WHERE is_read = 0 AND sender_role != 'admin' GROUP BY order_id`;
    }

    const [results] = await db.query(query, role !== 'admin' ? [userId] : []);
    // Convert to { orderId: count } map
    const unreadMap = {};
    results.forEach(r => { unreadMap[r.order_id] = r.count; });
    res.json(unreadMap);
  } catch (error) {
    console.error('Get unread per order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
