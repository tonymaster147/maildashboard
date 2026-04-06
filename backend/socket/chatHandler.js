const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { filterMessage } = require('../services/contentFilter');
require('dotenv').config();

/**
 * 2-way chat with channel column:
 *   channel='tutor'   → User <-> Tutor
 *   channel='support' → User <-> Admin/Sales
 *
 * User frontend sends channel in the sendMessage data.
 * Tutor/Admin/Sales channel is auto-detected from role.
 */

module.exports = function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Cache sender names
  const senderNameCache = new Map();
  async function getSenderName(role, id) {
    const key = `${role}_${id}`;
    if (senderNameCache.has(key)) return senderNameCache.get(key);
    let name = 'Admin';
    try {
      if (role === 'user') {
        const [rows] = await db.query('SELECT username FROM users WHERE id = ?', [id]);
        name = rows[0]?.username || 'User';
      } else if (role === 'tutor') {
        const [rows] = await db.query('SELECT name FROM tutors WHERE id = ?', [id]);
        name = rows[0]?.name || 'Tutor';
      } else if (role === 'sales_lead' || role === 'sales_executive') {
        const [rows] = await db.query('SELECT name FROM sales_users WHERE id = ?', [id]);
        name = rows[0]?.name || 'Sales';
      }
    } catch (e) { /* use default */ }
    senderNameCache.set(key, name);
    return name;
  }

  // Helper: emit to all connected admin/sales sockets (except excludeId)
  function emitToAdminSales(event, data, excludeId) {
    for (const [, s] of io.sockets.sockets) {
      if (s.user && ['admin', 'sales_lead', 'sales_executive'].includes(s.user.role)) {
        if (excludeId && s.id === excludeId) continue;
        s.emit(event, data);
      }
    }
  }

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.id} (${socket.user.role})`);

    // Join personal room for targeted notifications
    const personalRoom = `${socket.user.role}_${socket.user.id}`;
    socket.join(personalRoom);

    // Join order chat room
    socket.on('joinRoom', async (orderId) => {
      try {
        const roomName = `order_${orderId}`;
        if (socket.rooms.has(roomName)) return;

        const role = socket.user.role;
        const userId = socket.user.id;

        if (role === 'user') {
          const [orders] = await db.query('SELECT id FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
          if (orders.length === 0) return;
        } else if (role === 'tutor') {
          const [assignments] = await db.query('SELECT id FROM order_tutors WHERE order_id = ? AND tutor_id = ?', [orderId, userId]);
          if (assignments.length === 0) return;
        }

        socket.join(roomName);
      } catch (err) {
        console.error('joinRoom error:', err.message);
      }
    });

    socket.on('leaveRoom', (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // Send message with channel-based routing
    socket.on('sendMessage', async (data) => {
      try {
        const { order_id, message, channel: clientChannel } = data;
        const senderId = socket.user.id;
        const senderRole = socket.user.role;

        // Determine channel
        let channel;
        if (senderRole === 'tutor') {
          channel = 'tutor';
        } else if (['admin', 'sales_lead', 'sales_executive'].includes(senderRole)) {
          channel = 'support';
        } else {
          // User must specify channel
          channel = clientChannel || 'support';
        }

        // Check chat enabled + get order owner
        const [orders] = await db.query('SELECT chat_enabled, user_id FROM orders WHERE id = ?', [order_id]);
        if (orders.length === 0 || !orders[0].chat_enabled) {
          socket.emit('error', { message: 'Chat is disabled for this order' });
          return;
        }
        const orderOwnerId = orders[0].user_id;

        // Filter message
        const { filteredMessage, isFlagged, flagReason } = await filterMessage(message);

        // Save to DB with channel
        const [result] = await db.query(
          'INSERT INTO chats (order_id, sender_id, sender_role, channel, message, is_flagged, flag_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [order_id, senderId, senderRole, channel, filteredMessage, isFlagged ? 1 : 0, flagReason || null]
        );

        const senderName = await getSenderName(senderRole, senderId);

        const messageData = {
          id: result.insertId,
          order_id,
          sender_id: senderId,
          sender_role: senderRole,
          sender_name: senderName,
          channel,
          message: filteredMessage,
          is_flagged: isFlagged,
          created_at: new Date()
        };

        // ── DELIVER MESSAGE to the correct channel only ──

        if (channel === 'tutor') {
          // Tutor channel: deliver to user + tutor(s) only
          // Send back to sender
          socket.emit('newMessage', messageData);

          if (senderRole === 'user') {
            // User sent → deliver to assigned tutors
            const [tutors] = await db.query('SELECT tutor_id FROM order_tutors WHERE order_id = ?', [order_id]);
            for (const t of tutors) {
              io.to(`tutor_${t.tutor_id}`).emit('newMessage', messageData);
              io.to(`tutor_${t.tutor_id}`).emit('chatNotification', { order_id, sender_name: senderName, message: filteredMessage, channel });
            }
          } else {
            // Tutor sent → deliver to order owner
            io.to(`user_${orderOwnerId}`).emit('newMessage', messageData);
            io.to(`user_${orderOwnerId}`).emit('chatNotification', { order_id, sender_name: senderName, message: filteredMessage, channel });
          }

        } else {
          // Support channel: deliver to user + admin/sales only
          socket.emit('newMessage', messageData);

          if (senderRole === 'user') {
            // User sent → deliver to all admin/sales directly
            emitToAdminSales('newMessage', messageData);
            emitToAdminSales('chatNotification', { order_id, sender_name: senderName, message: filteredMessage, channel });
          } else {
            // Admin/Sales sent → deliver to order owner
            io.to(`user_${orderOwnerId}`).emit('newMessage', messageData);
            io.to(`user_${orderOwnerId}`).emit('chatNotification', { order_id, sender_name: senderName, message: filteredMessage, channel });
            // Also deliver to other admin/sales (exclude sender)
            emitToAdminSales('newMessage', messageData, socket.id);
          }
        }

        // If flagged, notify admin channel
        if (isFlagged) {
          io.emit('flaggedMessage', { ...messageData, flag_reason: flagReason });
          await db.query(
            'INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
            ['admin', 'flagged_message', `Flagged: ${flagReason} in order #${order_id}`, result.insertId, 'chat']
          );
        }
      } catch (error) {
        console.error('Socket sendMessage error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('typing', (data) => {
      socket.to(`order_${data.order_id}`).emit('userTyping', {
        user_id: socket.user.id, role: socket.user.role, name: data.name
      });
    });

    socket.on('stopTyping', (data) => {
      socket.to(`order_${data.order_id}`).emit('userStopTyping', {
        user_id: socket.user.id, role: socket.user.role
      });
    });

    // Keep adminMonitorAll for backward compat (no-op now, direct socket iteration used instead)
    socket.on('adminMonitorAll', () => {});

    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.user.id}`);
    });
  });
};
