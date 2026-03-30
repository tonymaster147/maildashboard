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

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.id} (${socket.user.role})`);

    // Track online status and join individual room for targeted notifications
    const roomId = `${socket.user.role}_${socket.user.id}`;
    socket.join(roomId);
    onlineUsers.set(roomId, socket.id);

    // Join order room
    socket.on('joinRoom', async (orderId) => {
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
      // Admin can join any room

      socket.join(`order_${orderId}`);
      console.log(`📥 ${role} ${userId} joined room order_${orderId}`);
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

        // Get sender name
        let senderName = 'Admin';
        if (senderRole === 'user') {
          const [users] = await db.query('SELECT username FROM users WHERE id = ?', [senderId]);
          senderName = users[0]?.username || 'User';
        } else if (senderRole === 'tutor') {
          const [tutors] = await db.query('SELECT name FROM tutors WHERE id = ?', [senderId]);
          senderName = tutors[0]?.name || 'Tutor';
        }

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
          // Notify the order owner (if sender is not user)
          if (senderRole !== 'user') {
            const [orderOwner] = await db.query('SELECT user_id FROM orders WHERE id = ?', [order_id]);
            if (orderOwner.length > 0) {
              const ownerSocketId = onlineUsers.get(`user_${orderOwner[0].user_id}`);
              if (ownerSocketId) {
                io.to(ownerSocketId).emit('chatNotification', { order_id, sender_name: senderName, message: filteredMessage });
              }
            }
          }
          // Notify assigned tutors (if sender is not tutor, or is a different tutor)
          const [assignedTutors] = await db.query('SELECT tutor_id FROM order_tutors WHERE order_id = ?', [order_id]);
          for (const at of assignedTutors) {
            if (senderRole === 'tutor' && at.tutor_id === senderId) continue;
            const tutorSocketId = onlineUsers.get(`tutor_${at.tutor_id}`);
            if (tutorSocketId) {
              io.to(tutorSocketId).emit('chatNotification', { order_id, sender_name: senderName, message: filteredMessage });
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

    // Admin: join all rooms for monitoring
    socket.on('adminMonitorAll', () => {
      if (socket.user.role === 'admin') {
        // Join a special admin monitoring channel
        socket.join('admin_monitor');
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      onlineUsers.delete(`${socket.user.role}_${socket.user.id}`);
      console.log(`🔌 User disconnected: ${socket.user.id}`);
    });
  });
};
