const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { filterMessage } = require('../services/contentFilter');
require('dotenv').config();

module.exports = function setupSocket(io) {
  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Track online users
  const onlineUsers = new Map();

  // Cache sender names to avoid repeated DB lookups
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

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.id} (${socket.user.role})`);

    // Track online status and join individual room for targeted notifications
    const roomId = `${socket.user.role}_${socket.user.id}`;
    socket.join(roomId);
    onlineUsers.set(roomId, socket.id);

    // Join order room (with dedup and error handling)
    socket.on('joinRoom', async (orderId) => {
      try {
        const roomName = `order_${orderId}`;
        // Skip if already in this room
        if (socket.rooms.has(roomName)) return;

        const role = socket.user.role;
        const userId = socket.user.id;

        // Verify access
        if (role === 'user') {
          const [orders] = await db.query('SELECT id FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
          if (orders.length === 0) return;
        } else if (role === 'tutor') {
          const [assignments] = await db.query(
            'SELECT id FROM order_tutors WHERE order_id = ? AND tutor_id = ?',
            [orderId, userId]
          );
          if (assignments.length === 0) return;
        }
        // Admin and sales users can join any room

        socket.join(roomName);
        console.log(`📥 ${role} ${userId} joined room ${roomName}`);
      } catch (err) {
        console.error('joinRoom error:', err.message);
      }
    });

    // Leave room
    socket.on('leaveRoom', (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // Send message
    socket.on('sendMessage', async (data) => {
      try {
        const { order_id, message } = data;
        const senderId = socket.user.id;
        const senderRole = socket.user.role;

        // Check chat enabled
        const [orders] = await db.query('SELECT chat_enabled FROM orders WHERE id = ?', [order_id]);
        if (orders.length === 0 || !orders[0].chat_enabled) {
          socket.emit('error', { message: 'Chat is disabled for this order' });
          return;
        }

        // Filter message (now async)
        const { filteredMessage, isFlagged, flagReason } = await filterMessage(message);

        // Save to DB
        const [result] = await db.query(
          'INSERT INTO chats (order_id, sender_id, sender_role, message, is_flagged, flag_reason) VALUES (?, ?, ?, ?, ?, ?)',
          [order_id, senderId, senderRole, filteredMessage, isFlagged ? 1 : 0, flagReason || null]
        );

        // Get sender name (cached)
        const senderName = await getSenderName(senderRole, senderId);

        const messageData = {
          id: result.insertId,
          order_id,
          sender_id: senderId,
          sender_role: senderRole,
          sender_name: senderName,
          message: filteredMessage,
          is_flagged: isFlagged,
          created_at: new Date()
        };

        // Broadcast to room
        io.to(`order_${order_id}`).emit('newMessage', messageData);

        // Send global notification to users NOT currently in the room
        try {
          const notifPayload = { order_id, sender_name: senderName, message: filteredMessage };

          // Fetch owner + assigned tutors in parallel (2 queries → 1 round-trip)
          const [ownerResult, tutorResult] = await Promise.all([
            senderRole !== 'user' ? db.query('SELECT user_id FROM orders WHERE id = ?', [order_id]) : [[]],
            db.query('SELECT tutor_id FROM order_tutors WHERE order_id = ?', [order_id])
          ]);

          // Notify the order owner
          if (senderRole !== 'user' && ownerResult[0].length > 0) {
            const ownerSocketId = onlineUsers.get(`user_${ownerResult[0][0].user_id}`);
            if (ownerSocketId) {
              io.to(ownerSocketId).emit('chatNotification', notifPayload);
            }
          }
          // Notify assigned tutors
          for (const at of tutorResult[0]) {
            if (senderRole === 'tutor' && at.tutor_id === senderId) continue;
            const tutorSocketId = onlineUsers.get(`tutor_${at.tutor_id}`);
            if (tutorSocketId) {
              io.to(tutorSocketId).emit('chatNotification', notifPayload);
            }
          }
          // Notify all online sales users (no DB query needed — just iterate onlineUsers)
          const salesRoles = ['sales_lead', 'sales_executive'];
          for (const [key, socketId] of onlineUsers.entries()) {
            if (salesRoles.some(r => key.startsWith(r + '_'))) {
              if (key === `${senderRole}_${senderId}`) continue;
              io.to(socketId).emit('chatNotification', notifPayload);
            }
          }
          // Notify admin if sender is not admin
          if (senderRole !== 'admin') {
            for (const [key, socketId] of onlineUsers.entries()) {
              if (key.startsWith('admin_')) {
                io.to(socketId).emit('chatNotification', notifPayload);
              }
            }
          }
        } catch (notifErr) {
          console.error('Chat notification error:', notifErr);
        }

        // If flagged, notify admin channel
        if (isFlagged) {
          io.emit('flaggedMessage', {
            ...messageData,
            flag_reason: flagReason
          });

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

    // Typing indicator
    socket.on('typing', (data) => {
      socket.to(`order_${data.order_id}`).emit('userTyping', {
        user_id: socket.user.id,
        role: socket.user.role,
        name: data.name
      });
    });

    socket.on('stopTyping', (data) => {
      socket.to(`order_${data.order_id}`).emit('userStopTyping', {
        user_id: socket.user.id,
        role: socket.user.role
      });
    });

    // Admin/Sales: join monitoring room (with dedup)
    socket.on('adminMonitorAll', () => {
      if (['admin', 'sales_lead', 'sales_executive'].includes(socket.user.role)) {
        if (!socket.rooms.has('admin_monitor')) {
          socket.join('admin_monitor');
        }
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      onlineUsers.delete(`${socket.user.role}_${socket.user.id}`);
      console.log(`🔌 User disconnected: ${socket.user.id}`);
    });
  });
};
