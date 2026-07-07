// Persist a user-facing notification AND push it live over socket.io to the
// student's personal room (`user_<id>`, joined in socket/chatHandler.js).
//
// Every place that inserts a role='user' notification should go through this
// helper so the bell panel updates in real time without a refresh.
//
//   const { notifyUser } = require('../services/notifyUser');
//   await notifyUser(req.app.get('io'), order.user_id, {
//     type: 'order_update',
//     message: `Order ${ref} status: ${name}`,
//     referenceId: order.id,
//     referenceType: 'order',
//   });

const db = require('../config/db');

async function notifyUser(io, userId, { type, message, referenceId = null, referenceType = null }) {
  const [result] = await db.query(
    'INSERT INTO notifications (user_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, 'user', type, message, referenceId, referenceType]
  );
  const notification = {
    id: result.insertId,
    user_id: userId,
    role: 'user',
    type,
    message,
    is_read: 0,
    reference_id: referenceId,
    reference_type: referenceType,
    created_at: new Date().toISOString(),
  };
  if (io) {
    try {
      io.to(`user_${userId}`).emit('notification', notification);
    } catch (e) {
      console.error('notifyUser socket emit failed:', e.message);
    }
  }
  return notification;
}

// Chat variant — deduped so a busy conversation doesn't flood the bell.
// One UNREAD row per order+channel: while the student hasn't read it, new
// messages just refresh that row's text/time and re-emit (with is_update so
// the frontend doesn't double-count the badge). Once read, the next message
// creates a fresh row.
async function notifyUserChat(io, userId, { orderId, channel, senderName, orderRef }) {
  const refType = channel === 'tutor' ? 'chat_tutor' : 'chat_support';
  const message = `New message from ${senderName} on order ${orderRef}`;

  const [existing] = await db.query(
    `SELECT id FROM notifications
     WHERE user_id = ? AND role = 'user' AND type = 'chat_message'
       AND reference_type = ? AND reference_id = ? AND is_read = 0
     LIMIT 1`,
    [userId, refType, orderId]
  );

  let id;
  let isUpdate = false;
  if (existing.length) {
    id = existing[0].id;
    isUpdate = true;
    await db.query(
      'UPDATE notifications SET message = ?, created_at = NOW() WHERE id = ?',
      [message, id]
    );
  } else {
    const [result] = await db.query(
      'INSERT INTO notifications (user_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'user', 'chat_message', message, orderId, refType]
    );
    id = result.insertId;
  }

  const notification = {
    id, user_id: userId, role: 'user', type: 'chat_message', message,
    is_read: 0, reference_id: orderId, reference_type: refType,
    created_at: new Date().toISOString(),
    is_update: isUpdate,
  };
  if (io) {
    try {
      io.to(`user_${userId}`).emit('notification', notification);
    } catch (e) {
      console.error('notifyUserChat socket emit failed:', e.message);
    }
  }
  return notification;
}

// ─────────────────────────── STAFF (admin / sales) ───────────────────────────
// Staff notifications are role-broadcast rows (one row per role, shared by
// everyone holding that role — matches the pre-existing schema usage).
// Live delivery rides the admin_monitor room every staff Layout joins; each
// client keeps only payloads whose role matches its own.

const STAFF_ROLES = ['admin', 'sales_lead', 'sales_executive'];

async function notifyStaff(io, { type, message, referenceId = null, referenceType = null, roles = STAFF_ROLES }) {
  for (const role of roles) {
    const [result] = await db.query(
      'INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
      [role, type, message, referenceId, referenceType]
    );
    if (io) {
      try {
        io.to('admin_monitor').emit('staffNotification', {
          id: result.insertId, role, type, message,
          is_read: 0, reference_id: referenceId, reference_type: referenceType,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('notifyStaff emit failed:', e.message);
      }
    }
  }
}

// Targeted staff notification — ONE specific sales person (not the role
// broadcast). Rides the same admin_monitor socket; the client keeps it only
// when sales_user_id matches theirs (or is null = broadcast).
async function notifySalesUser(io, salesUserId, role, { type, message, referenceId = null, referenceType = null }) {
  const [result] = await db.query(
    'INSERT INTO notifications (role, sales_user_id, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
    [role, salesUserId, type, message, referenceId, referenceType]
  );
  if (io) {
    try {
      io.to('admin_monitor').emit('staffNotification', {
        id: result.insertId, role, sales_user_id: salesUserId, type, message,
        is_read: 0, reference_id: referenceId, reference_type: referenceType,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('notifySalesUser emit failed:', e.message);
    }
  }
  return result.insertId;
}

// Deduped chat row per role+order: while unread, new user messages just
// refresh the row (is_update tells clients not to double-count the badge).
async function notifyStaffChat(io, { orderId, senderName, orderRef, roles = STAFF_ROLES }) {
  const message = `New support message from ${senderName} on order ${orderRef}`;
  for (const role of roles) {
    const [existing] = await db.query(
      `SELECT id FROM notifications
       WHERE role = ? AND user_id IS NULL AND tutor_id IS NULL AND type = 'chat_message'
         AND reference_type = 'chat_support' AND reference_id = ? AND is_read = 0
       LIMIT 1`,
      [role, orderId]
    );
    let id, isUpdate = false;
    if (existing.length) {
      id = existing[0].id;
      isUpdate = true;
      await db.query('UPDATE notifications SET message = ?, created_at = NOW() WHERE id = ?', [message, id]);
    } else {
      const [result] = await db.query(
        'INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
        [role, 'chat_message', message, orderId, 'chat_support']
      );
      id = result.insertId;
    }
    if (io) {
      try {
        io.to('admin_monitor').emit('staffNotification', {
          id, role, type: 'chat_message', message,
          is_read: 0, reference_id: orderId, reference_type: 'chat_support',
          created_at: new Date().toISOString(), is_update: isUpdate,
        });
      } catch (e) {
        console.error('notifyStaffChat emit failed:', e.message);
      }
    }
  }
}

// ─────────────────────────────── TUTOR ───────────────────────────────
// Per-tutor rows (tutor_id), live over the tutor's personal room using the
// same 'notification' event name the student panel listens on.

async function notifyTutor(io, tutorId, { type, message, referenceId = null, referenceType = null }) {
  const [result] = await db.query(
    'INSERT INTO notifications (tutor_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
    [tutorId, 'tutor', type, message, referenceId, referenceType]
  );
  const notification = {
    id: result.insertId, tutor_id: tutorId, role: 'tutor', type, message,
    is_read: 0, reference_id: referenceId, reference_type: referenceType,
    created_at: new Date().toISOString(),
  };
  if (io) {
    try {
      io.to(`tutor_${tutorId}`).emit('notification', notification);
    } catch (e) {
      console.error('notifyTutor emit failed:', e.message);
    }
  }
  return notification;
}

async function notifyTutorChat(io, tutorId, { orderId, senderName, orderRef }) {
  const message = `New message from ${senderName} on order ${orderRef}`;
  const [existing] = await db.query(
    `SELECT id FROM notifications
     WHERE tutor_id = ? AND role = 'tutor' AND type = 'chat_message'
       AND reference_type = 'chat_tutor' AND reference_id = ? AND is_read = 0
     LIMIT 1`,
    [tutorId, orderId]
  );
  let id, isUpdate = false;
  if (existing.length) {
    id = existing[0].id;
    isUpdate = true;
    await db.query('UPDATE notifications SET message = ?, created_at = NOW() WHERE id = ?', [message, id]);
  } else {
    const [result] = await db.query(
      'INSERT INTO notifications (tutor_id, role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
      [tutorId, 'tutor', 'chat_message', message, orderId, 'chat_tutor']
    );
    id = result.insertId;
  }
  if (io) {
    try {
      io.to(`tutor_${tutorId}`).emit('notification', {
        id, tutor_id: tutorId, role: 'tutor', type: 'chat_message', message,
        is_read: 0, reference_id: orderId, reference_type: 'chat_tutor',
        created_at: new Date().toISOString(), is_update: isUpdate,
      });
    } catch (e) {
      console.error('notifyTutorChat emit failed:', e.message);
    }
  }
}

module.exports = { notifyUser, notifyUserChat, notifyStaff, notifySalesUser, notifyStaffChat, notifyTutor, notifyTutorChat };
