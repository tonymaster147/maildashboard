const db = require('../config/db');

/*
 * Sales dashboard — payment-reminder calendar, to-dos, needs-attention and
 * recent orders for a sales_lead / sales_executive.
 *
 * Payment reminders are derived live from `order_installments` (they carry the
 * due dates). The first time a sales person acts on one (status / comment /
 * snooze) it is "materialized" into `sales_tasks` so their workflow state and
 * notes are stored per person. Manual to-dos live in `sales_tasks` directly.
 */

// ---- helpers ---------------------------------------------------------------

// Server-side cutoff → 'YYYY-MM-DD HH:MM:SS' (sales_executive window; null for lead/admin)
function fmtDateTime(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function todayISO() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Merged calendar items for a user across [from, to] (inclusive, YYYY-MM-DD).
// Returns: { key, id?, source:'task'|'reminder', ref_type, ref_id, order_id,
//            order_code, category, title, student_name, amount, due_date,
//            status, overdue, comments:[] }
async function getCalendarItems(userId, cutoff, from, to) {
  const cutSql = cutoff ? ' AND o.created_at >= ?' : '';
  const cutP = cutoff ? [fmtDateTime(cutoff)] : [];
  const T = todayISO();

  // 1) Live installment reminders (unpaid) in range, with this user's task state.
  const [inst] = await db.query(
    `SELECT i.id AS ref_id, i.installment_number, i.amount, DATE_FORMAT(i.due_date,'%Y-%m-%d') AS due_date,
            i.status AS pay_status, o.id AS order_id, o.order_code, u.username,
            st.id AS task_id, st.status AS task_status, st.is_assigned,
            DATE_FORMAT(COALESCE(st.due_date, i.due_date),'%Y-%m-%d') AS eff_due
       FROM order_installments i
       JOIN orders o ON i.order_id = o.id
       JOIN users u ON o.user_id = u.id
       LEFT JOIN sales_tasks st ON st.ref_type='installment' AND st.ref_id=i.id AND st.sales_user_id=?
      WHERE i.status <> 'paid' AND COALESCE(st.due_date, i.due_date) BETWEEN ? AND ?
        AND NOT EXISTS (SELECT 1 FROM sales_tasks a WHERE a.ref_type='installment' AND a.ref_id=i.id AND a.is_assigned=1 AND a.sales_user_id <> ?)${cutSql}`,
    [userId, from, to, userId, ...cutP]
  );

  // 2) Order-level payment follow-ups — unpaid / partial orders WITHOUT an
  //    installment plan. Dated on the day the order was placed, so a new unpaid
  //    order shows up on that day (usually today) and can be chased. Driven by
  //    the admin payment status, not the amount columns (which aren't reliable
  //    until a collection is recorded).
  const [ord] = await db.query(
    `SELECT o.id AS ref_id, o.order_code, u.username,
            o.total_price, o.amount_paid, o.amount_remaining, ast.code AS admin_code,
            st.id AS task_id, st.status AS task_status, st.is_assigned,
            DATE_FORMAT(COALESCE(st.due_date, DATE(o.created_at)),'%Y-%m-%d') AS eff_due
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN admin_statuses ast ON o.admin_status_id = ast.id
       LEFT JOIN sales_tasks st ON st.ref_type='order' AND st.ref_id=o.id AND st.sales_user_id=?
      WHERE ast.code IN ('unpaid','paid_partial_unassigned','paid_partial_assigned')
        AND o.has_installments = 0 AND o.status <> 'cancelled'
        AND COALESCE(st.due_date, DATE(o.created_at)) BETWEEN ? AND ?
        AND NOT EXISTS (SELECT 1 FROM sales_tasks a WHERE a.ref_type='order' AND a.ref_id=o.id AND a.is_assigned=1 AND a.sales_user_id <> ?)${cutSql}`,
    [userId, from, to, userId, ...cutP]
  );

  // 3) Manual tasks — this user's own PLUS general team tasks (visible to all).
  const [manual] = await db.query(
    `SELECT id AS task_id, order_id, category, title, student_name, amount,
            DATE_FORMAT(due_date,'%Y-%m-%d') AS due_date, status, is_general, is_assigned, created_by_role
       FROM sales_tasks
      WHERE ref_type='manual' AND (sales_user_id=? OR is_general=1) AND due_date BETWEEN ? AND ?`,
    [userId, from, to]
  );

  // Gather comments for every materialized task shown.
  const taskIds = [
    ...inst.filter(r => r.task_id).map(r => r.task_id),
    ...ord.filter(r => r.task_id).map(r => r.task_id),
    ...manual.map(r => r.task_id),
  ];
  const commentsByTask = {};
  if (taskIds.length) {
    const [cm] = await db.query(
      `SELECT id, task_id, author_name, author_role, comment, created_at
         FROM sales_task_comments WHERE task_id IN (${taskIds.map(() => '?').join(',')})
        ORDER BY created_at ASC`, taskIds);
    cm.forEach(c => { (commentsByTask[c.task_id] = commentsByTask[c.task_id] || []).push(c); });
  }

  const items = [];
  for (const r of inst) {
    const status = r.task_status || 'pending';
    const due = r.eff_due;
    items.push({
      key: `inst-${r.ref_id}`,
      id: r.task_id || null,
      source: r.task_id ? 'task' : 'reminder',
      ref_type: 'installment', ref_id: r.ref_id,
      order_id: r.order_id, order_code: r.order_code,
      category: 'installment',
      title: `Installment ${r.installment_number} — ${r.order_code || '#' + r.order_id}`,
      student_name: r.username,
      amount: r.amount != null ? Number(r.amount) : null,
      due_date: due,
      status,
      overdue: status !== 'done' && due < T,
      assigned: !!r.is_assigned,
      comments: commentsByTask[r.task_id] || [],
    });
  }
  for (const r of ord) {
    const status = r.task_status || 'pending';
    const due = r.eff_due;
    const category = r.admin_code === 'unpaid' ? 'unpaid' : 'partial';
    const amount = category === 'unpaid'
      ? (r.total_price != null ? Number(r.total_price) : null)
      : (Number(r.amount_remaining) > 0 ? Number(r.amount_remaining) : Number(r.total_price) - Number(r.amount_paid));
    items.push({
      key: `order-${r.ref_id}`,
      id: r.task_id || null,
      source: r.task_id ? 'task' : 'reminder',
      ref_type: 'order', ref_id: r.ref_id,
      order_id: r.ref_id, order_code: r.order_code,
      category,
      title: `${category === 'unpaid' ? 'Unpaid' : 'Collect balance'} — ${r.order_code || '#' + r.ref_id}`,
      student_name: r.username,
      amount: amount != null && !Number.isNaN(amount) ? amount : null,
      due_date: due,
      status,
      overdue: status !== 'done' && due < T,
      assigned: !!r.is_assigned,
      comments: commentsByTask[r.task_id] || [],
    });
  }
  for (const m of manual) {
    items.push({
      key: `task-${m.task_id}`,
      id: m.task_id, source: 'task',
      ref_type: 'manual', ref_id: null,
      order_id: m.order_id, order_code: null,
      category: m.category,
      title: m.title,
      student_name: m.student_name,
      amount: m.amount != null ? Number(m.amount) : null,
      due_date: m.due_date,
      status: m.status,
      overdue: m.status !== 'done' && m.due_date < T,
      general: !!m.is_general,
      assigned: !m.is_general && (!!m.is_assigned || m.created_by_role === 'admin'),
      comments: commentsByTask[m.task_id] || [],
    });
  }
  items.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
  return items;
}

// Resolve a mutation target to a concrete sales_tasks row id (materializing an
// installment reminder on first touch). Returns { id } or throws {status,msg}.
async function ensureTaskId(req) {
  const userId = req.user.id;
  const { task_id, ref_type, ref_id } = req.body;

  if (task_id) {
    // Own task OR a general (team) task — anyone can act on general tasks.
    const [[t]] = await db.query('SELECT id FROM sales_tasks WHERE id=? AND (sales_user_id=? OR is_general=1)', [task_id, userId]);
    if (!t) { const e = new Error('Task not found'); e.status = 404; throw e; }
    return t.id;
  }
  if ((ref_type === 'installment' || ref_type === 'order') && ref_id) {
    const [[existing]] = await db.query(
      'SELECT id FROM sales_tasks WHERE sales_user_id=? AND ref_type=? AND ref_id=?',
      [userId, ref_type, ref_id]);
    if (existing) return existing.id;

    if (ref_type === 'installment') {
      const [[i]] = await db.query(
        `SELECT i.id, i.installment_number, i.amount, i.due_date, o.id AS order_id, o.order_code, o.created_at, u.username
           FROM order_installments i JOIN orders o ON i.order_id=o.id JOIN users u ON o.user_id=u.id
          WHERE i.id=?`, [ref_id]);
      if (!i) { const e = new Error('Reminder not found'); e.status = 404; throw e; }
      if (req.salesCutoff && new Date(i.created_at) < req.salesCutoff) {
        const e = new Error('This order is outside your access window.'); e.status = 403; throw e;
      }
      const [ins] = await db.query(
        `INSERT INTO sales_tasks
           (sales_user_id, order_id, ref_type, ref_id, category, title, student_name, amount, due_date, status, created_by_id, created_by_role, created_by_name)
         VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?,?,?)`,
        [userId, i.order_id, 'installment', i.id, 'installment',
         `Installment ${i.installment_number} — ${i.order_code || '#' + i.order_id}`,
         i.username, i.amount, i.due_date, userId, req.user.role, req.user.name || null]);
      return ins.insertId;
    }

    // ref_type === 'order' — unpaid / partial order follow-up
    const [[o]] = await db.query(
      `SELECT o.id, o.order_code, o.total_price, o.amount_paid, o.amount_remaining, o.created_at, ast.code AS admin_code, u.username
         FROM orders o JOIN admin_statuses ast ON o.admin_status_id=ast.id JOIN users u ON o.user_id=u.id
        WHERE o.id=?`, [ref_id]);
    if (!o) { const e = new Error('Order not found'); e.status = 404; throw e; }
    if (req.salesCutoff && new Date(o.created_at) < req.salesCutoff) {
      const e = new Error('This order is outside your access window.'); e.status = 403; throw e;
    }
    const category = o.admin_code === 'unpaid' ? 'unpaid' : 'partial';
    const amt = category === 'unpaid'
      ? o.total_price
      : (Number(o.amount_remaining) > 0 ? o.amount_remaining : Number(o.total_price) - Number(o.amount_paid));
    const due = new Date(o.created_at); const p = n => String(n).padStart(2, '0');
    const dueStr = `${due.getFullYear()}-${p(due.getMonth() + 1)}-${p(due.getDate())}`;
    const [ins] = await db.query(
      `INSERT INTO sales_tasks
         (sales_user_id, order_id, ref_type, ref_id, category, title, student_name, amount, due_date, status, created_by_id, created_by_role, created_by_name)
       VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?,?,?)`,
      [userId, o.id, 'order', o.id, category,
       `${category === 'unpaid' ? 'Unpaid' : 'Collect balance'} — ${o.order_code || '#' + o.id}`,
       o.username, amt, dueStr, userId, req.user.role, req.user.name || null]);
    return ins.insertId;
  }
  const e = new Error('task_id or (ref_type, ref_id) required'); e.status = 400; throw e;
}

// Exposed for the admin Sales-Activity monitor (reads any sales person's calendar).
exports.getCalendarItems = getCalendarItems;
exports._fmtDateTime = fmtDateTime;
exports._todayISO = todayISO;

// ---- endpoints -------------------------------------------------------------

// GET /sales/dashboard-summary  → KPIs (no revenue) + needs-attention counts
exports.getSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const cutoff = req.salesCutoff;
    const T = todayISO();
    const cutSql = cutoff ? ' AND o.created_at >= ?' : '';
    const cutP = cutoff ? [fmtDateTime(cutoff)] : [];

    // Date-based task/reminder counts over a wide window.
    const items = await getCalendarItems(userId, cutoff, '2000-01-01', '2100-01-01');
    const inWeek = (d) => { const x = new Date(d + 'T00:00:00'), n = new Date(T + 'T00:00:00'); const diff = (x - n) / 86400000; return diff >= 0 && diff <= 7; };
    const open = items.filter(i => i.status !== 'done');
    const dueToday = open.filter(i => i.due_date === T).length;
    const overdue = open.filter(i => i.due_date < T).length;
    const dueThisWeek = open.filter(i => inWeek(i.due_date)).length;
    const installmentsDueToday = open.filter(i => i.category === 'installment' && i.due_date === T).length;

    const [[doneToday]] = await db.query(
      `SELECT COUNT(*) c FROM sales_tasks WHERE sales_user_id=? AND status='done' AND DATE(completed_at)=CURDATE()`, [userId]);
    const [[assignedToday]] = await db.query(
      `SELECT COUNT(*) c FROM sales_tasks WHERE sales_user_id=? AND due_date=CURDATE()`, [userId]);

    // Live business counts within window.
    const [[activeOrders]] = await db.query(
      `SELECT COUNT(*) c FROM orders o WHERE o.status IN ('active','in_progress')${cutSql}`, cutP);
    const [[partial]] = await db.query(
      `SELECT COUNT(*) c FROM orders o JOIN admin_statuses ast ON o.admin_status_id=ast.id
        WHERE ast.code IN ('paid_partial_unassigned','paid_partial_assigned') AND o.has_installments=0 AND o.status<>'cancelled'${cutSql}`, cutP);
    const [[unpaidOrders]] = await db.query(
      `SELECT COUNT(*) c FROM orders o JOIN admin_statuses ast ON o.admin_status_id=ast.id
        WHERE ast.code='unpaid' AND o.has_installments=0 AND o.status<>'cancelled'${cutSql}`, cutP);
    const [[pendingChats]] = await db.query(
      `SELECT COUNT(*) c FROM (
         SELECT c.order_id, SUBSTRING_INDEX(GROUP_CONCAT(c.sender_role ORDER BY c.id DESC), ',', 1) AS last_role
           FROM chats c JOIN orders o ON c.order_id=o.id
          WHERE c.channel='support'${cutSql}
          GROUP BY c.order_id
       ) x WHERE x.last_role='user'`, cutP);

    res.json({
      kpis: {
        due_today: dueToday,
        overdue,
        due_this_week: dueThisWeek,
        tasks_done_today: doneToday.c,
        tasks_assigned_today: assignedToday.c,
        pending_chats: pendingChats.c,
        active_orders: activeOrders.c,
      },
      needs_attention: {
        partial_to_collect: partial.c,
        installments_due_today: installmentsDueToday,
        unpaid_orders: unpaidOrders.c,
        pending_chats: pendingChats.c,
      },
    });
  } catch (e) {
    console.error('Sales getSummary error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /sales/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD  → calendar items
exports.getCalendar = async (req, res) => {
  try {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : '2000-01-01';
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : '2100-01-01';
    const items = await getCalendarItems(req.user.id, req.salesCutoff, from, to);
    res.json({ items });
  } catch (e) {
    console.error('Sales getCalendar error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /sales/tasks  → create a manual to-do / scheduled follow-up
exports.createTask = async (req, res) => {
  try {
    const { title, due_date, category, amount, order_id, student_name } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const due = /^\d{4}-\d{2}-\d{2}$/.test(due_date || '') ? due_date : todayISO();
    const cat = ['installment', 'partial', 'unpaid', 'paid', 'todo'].includes(category) ? category : 'todo';
    const [ins] = await db.query(
      `INSERT INTO sales_tasks
         (sales_user_id, order_id, ref_type, ref_id, category, title, student_name, amount, due_date, status, created_by_id, created_by_role, created_by_name)
       VALUES (?,?, 'manual', NULL, ?,?,?,?,?, 'pending', ?,?,?)`,
      [req.user.id, order_id || null, cat, title.trim(), student_name || null,
       amount != null && amount !== '' ? amount : null, due, req.user.id, req.user.role, req.user.name || null]);
    res.status(201).json({ id: ins.insertId });
  } catch (e) {
    console.error('Sales createTask error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// Notify Sales Lead(s) + Admin that a task was completed (bell + email).
async function notifyTaskCompleted(req, task) {
  try {
    let orderRef = null;
    if (task.order_id) {
      const [[o]] = await db.query('SELECT order_code FROM orders WHERE id=?', [task.order_id]);
      orderRef = o ? o.order_code : null;
    }
    await require('../services/salesTaskNotify').onTaskCompleted(
      req.app.get('io'), req.user,
      { title: task.title, category: task.category, orderRef, orderId: task.order_id });
  } catch (e) { console.error('notifyTaskCompleted failed:', e.message); }
}

// POST /sales/tasks/status  body: { task_id | ref_type+ref_id, status }
exports.setStatus = async (req, res) => {
  try {
    const status = ['pending', 'in_progress', 'done'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ error: 'Invalid status' });
    const id = await ensureTaskId(req);
    const [[task]] = await db.query('SELECT * FROM sales_tasks WHERE id=?', [id]);

    // Completing an unpaid / partial ORDER task must record a real payment —
    // send the client to the collect-payment flow instead of a plain "done".
    if (status === 'done' && task.ref_type === 'order' && ['unpaid', 'partial'].includes(task.category) && task.order_id) {
      const [[o]] = await db.query(
        'SELECT ast.code FROM orders o JOIN admin_statuses ast ON o.admin_status_id=ast.id WHERE o.id=?', [task.order_id]);
      if (o && (o.code === 'unpaid' || /^paid_partial/.test(o.code))) {
        return res.status(409).json({ error: 'PAYMENT_REQUIRED', message: 'Record the payment to complete this task.', order_id: task.order_id });
      }
    }

    await db.query(
      `UPDATE sales_tasks SET status=?, completed_at=${status === 'done' ? 'NOW()' : 'NULL'} WHERE id=? AND (sales_user_id=? OR is_general=1)`,
      [status, id, req.user.id]);
    if (status === 'done') await notifyTaskCompleted(req, task);
    res.json({ id, status });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('Sales setStatus error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /sales/tasks/collect-payment  body: { task_id | ref_type+ref_id | order_id, payment }
// Records an offline collection against the order, flips it off "Unpaid", and
// marks the task done. Any sales person may do it.
exports.collectPayment = async (req, res) => {
  try {
    // Only a Sales Lead or Admin may move an order from Unpaid → Paid
    // (matches the panel's order-status rule). Executives can still chase the
    // task — comment / snooze — but not record the payment themselves.
    if (!['admin', 'sales_lead'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only a Sales Lead or Admin can mark an order as paid.' });
    }
    let orderId = req.body.order_id;
    if (!orderId && req.body.ref_type === 'order') orderId = req.body.ref_id;
    if (!orderId && req.body.task_id) {
      const [[t]] = await db.query('SELECT order_id FROM sales_tasks WHERE id=? AND (sales_user_id=? OR is_general=1)', [req.body.task_id, req.user.id]);
      orderId = t ? t.order_id : null;
    }
    if (!orderId) return res.status(400).json({ error: 'order reference required' });

    const io = req.app.get('io');
    const result = await require('../services/orderPayment').collectOrderPayment(req, io, { orderId, payment: req.body.payment });

    // Materialize + mark the order task done.
    const id = await ensureTaskId({ user: req.user, salesCutoff: req.salesCutoff, app: req.app, body: { ref_type: 'order', ref_id: orderId } });
    await db.query("UPDATE sales_tasks SET status='done', completed_at=NOW() WHERE id=?", [id]);
    const [[task]] = await db.query('SELECT * FROM sales_tasks WHERE id=?', [id]);
    await notifyTaskCompleted(req, task);

    res.json({ ok: true, payment: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('Sales collectPayment error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /sales/tasks/comment  body: { task_id | ref_type+ref_id, comment }
exports.addComment = async (req, res) => {
  try {
    const comment = (req.body.comment || '').trim();
    if (!comment) return res.status(400).json({ error: 'Comment is required' });
    const id = await ensureTaskId(req);
    const [ins] = await db.query(
      `INSERT INTO sales_task_comments (task_id, author_id, author_role, author_name, comment)
       VALUES (?,?,?,?,?)`,
      [id, req.user.id, req.user.role, req.user.name || null, comment]);
    res.status(201).json({ id: ins.insertId, task_id: id, author_name: req.user.name || 'You', comment, created_at: new Date() });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('Sales addComment error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /sales/tasks/snooze  body: { task_id | ref_type+ref_id }  → due +1 day
exports.snooze = async (req, res) => {
  try {
    const id = await ensureTaskId(req);
    await db.query('UPDATE sales_tasks SET due_date = DATE_ADD(due_date, INTERVAL 1 DAY) WHERE id=? AND (sales_user_id=? OR is_general=1)', [id, req.user.id]);
    const [[t]] = await db.query("SELECT DATE_FORMAT(due_date,'%Y-%m-%d') AS due_date FROM sales_tasks WHERE id=?", [id]);
    res.json({ id, due_date: t.due_date });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('Sales snooze error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /sales/tasks/:id  → remove a manual task (own only)
exports.deleteTask = async (req, res) => {
  try {
    await db.query("DELETE FROM sales_tasks WHERE id=? AND sales_user_id=? AND ref_type='manual'", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('Sales deleteTask error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /sales/recent-orders  → latest orders within window (no revenue totals aggregated)
exports.getRecentOrders = async (req, res) => {
  try {
    const cutSql = req.salesCutoff ? ' AND o.created_at >= ?' : '';
    const cutP = req.salesCutoff ? [fmtDateTime(req.salesCutoff)] : [];
    const [rows] = await db.query(
      `SELECT o.id, o.order_code, o.course_name, o.status, o.total_price, o.payment_type,
              o.amount_paid, o.amount_remaining, o.has_installments,
              DATE_FORMAT(o.created_at,'%Y-%m-%d') AS created_at,
              u.username, s.name AS subject_name
         FROM orders o
         JOIN users u ON o.user_id = u.id
         LEFT JOIN subjects s ON o.subject_id = s.id
        WHERE 1=1${cutSql}
        ORDER BY o.created_at DESC LIMIT 8`, cutP);
    res.json({ orders: rows });
  } catch (e) {
    console.error('Sales getRecentOrders error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
