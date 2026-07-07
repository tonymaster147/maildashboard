const db = require('../config/db');
const { getCalendarItems, _todayISO } = require('./salesDashboardController');
const salesTaskNotify = require('../services/salesTaskNotify');

/*
 * Admin — Sales Activity monitor. Read-only views of each sales person's
 * payment calendar, task status, productivity, and comments.
 */

// A sales person's own data window (sales_executive: last N days; lead: none).
async function targetCutoff(salesUserId) {
  const [[u]] = await db.query('SELECT id, name, role, data_window_days FROM sales_users WHERE id = ?', [salesUserId]);
  if (!u) return { user: null, cutoff: null };
  const cutoff = u.role === 'sales_executive'
    ? new Date(Date.now() - (u.data_window_days || 60) * 86400000)
    : null;
  return { user: u, cutoff };
}

// GET /admin/sales-activity/people  → roster with today's glance stats
exports.getPeople = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT su.id, su.name, su.role,
              COALESCE(a.assigned_today,0)  AS assigned_today,
              COALESCE(a.done_today,0)      AS done_today,
              COALESCE(a.in_progress,0)     AS in_progress,
              COALESCE(a.overdue,0)         AS overdue
         FROM sales_users su
         LEFT JOIN (
           SELECT sales_user_id,
                  SUM(due_date = CURDATE())                                   AS assigned_today,
                  SUM(status = 'done' AND DATE(completed_at) = CURDATE())     AS done_today,
                  SUM(status = 'in_progress')                                 AS in_progress,
                  SUM(status <> 'done' AND due_date < CURDATE())              AS overdue
             FROM sales_tasks GROUP BY sales_user_id
         ) a ON a.sales_user_id = su.id
        WHERE su.status = 'active'
        ORDER BY (su.role = 'sales_lead') DESC, su.name ASC`);
    res.json({ people: rows });
  } catch (e) {
    console.error('SalesActivity getPeople error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /admin/sales-activity/:id/summary  → KPIs + today breakdown + 7-day + comments
exports.getPersonSummary = async (req, res) => {
  try {
    const { user, cutoff } = await targetCutoff(req.params.id);
    if (!user) return res.status(404).json({ error: 'Sales person not found' });
    const T = _todayISO();

    const items = await getCalendarItems(user.id, cutoff, '2000-01-01', '2100-01-01');
    const todayItems = items.filter(i => i.due_date === T);
    const assignedToday = todayItems.length;
    const todayDone = todayItems.filter(i => i.status === 'done').length;
    const inProgress = items.filter(i => i.status === 'in_progress').length;
    const overdue = items.filter(i => i.status !== 'done' && i.due_date < T).length;
    const completion = assignedToday ? Math.round((todayDone / assignedToday) * 100) : 0;

    // "Done Today" = tasks actually completed today (any due date) — matches the
    // roster glance and the productivity chart.
    const [[completedToday]] = await db.query(
      `SELECT COUNT(*) c FROM sales_tasks WHERE sales_user_id=? AND status='done' AND DATE(completed_at)=CURDATE()`, [user.id]);
    const doneToday = completedToday.c;

    const breakdown = { done: 0, in_progress: 0, pending: 0, overdue: 0 };
    todayItems.forEach(i => { breakdown[i.status] = (breakdown[i.status] || 0) + 1; });

    // 7-day productivity — tasks completed per day (from stored rows).
    const [prod] = await db.query(
      `SELECT DATE_FORMAT(completed_at,'%Y-%m-%d') d, COUNT(*) c
         FROM sales_tasks
        WHERE sales_user_id = ? AND status='done' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY d`, [user.id]);
    const prodMap = {}; prod.forEach(r => { prodMap[r.d] = r.c; });
    const productivity = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const p = n => String(n).padStart(2, '0');
      const key = `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
      productivity.push({ date: key, label: dt.toLocaleDateString('en-US', { weekday: 'short' }), value: prodMap[key] || 0 });
    }

    const [comments] = await db.query(
      `SELECT c.id, c.comment, c.author_name, DATE_FORMAT(c.created_at,'%Y-%m-%d %H:%i') AS created_at,
              t.title, t.category
         FROM sales_task_comments c JOIN sales_tasks t ON c.task_id = t.id
        WHERE (t.sales_user_id = ? OR t.is_general = 1)
        ORDER BY c.created_at DESC LIMIT 15`, [user.id]);

    res.json({
      person: { id: user.id, name: user.name, role: user.role },
      kpis: { assigned_today: assignedToday, done_today: doneToday, in_progress: inProgress, overdue, completion },
      today_breakdown: breakdown,
      productivity,
      recent_comments: comments,
    });
  } catch (e) {
    console.error('SalesActivity getPersonSummary error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

// POST /admin/sales-activity/assign  body: { ref_type:'order'|'installment', ref_id, sales_user_id }
// Assign a payment reminder to ONE sales person → it moves to their calendar
// and leaves everyone else's team view.
exports.assignReminder = async (req, res) => {
  try {
    const { ref_type, ref_id, sales_user_id } = req.body;
    if (!['order', 'installment'].includes(ref_type) || !ref_id) return res.status(400).json({ error: 'ref_type (order|installment) and ref_id required' });
    const [[su]] = await db.query("SELECT id, name, email, role FROM sales_users WHERE id=? AND status='active'", [sales_user_id]);
    if (!su) return res.status(404).json({ error: 'Sales person not found' });

    // Build the task from the source (order or installment).
    let orderId, orderCode, username, amount, dueDate, category, title, createdAt;
    if (ref_type === 'installment') {
      const [[i]] = await db.query(
        `SELECT i.installment_number, i.amount, DATE_FORMAT(i.due_date,'%Y-%m-%d') due_date,
                o.id order_id, o.order_code, o.created_at, u.username
           FROM order_installments i JOIN orders o ON i.order_id=o.id JOIN users u ON o.user_id=u.id WHERE i.id=?`, [ref_id]);
      if (!i) return res.status(404).json({ error: 'Installment not found' });
      orderId = i.order_id; orderCode = i.order_code; username = i.username; amount = i.amount; dueDate = i.due_date; createdAt = i.created_at;
      category = 'installment'; title = `Installment ${i.installment_number} — ${i.order_code || '#' + i.order_id}`;
    } else {
      const [[o]] = await db.query(
        `SELECT o.id, o.order_code, o.total_price, o.amount_paid, o.amount_remaining, o.created_at, DATE_FORMAT(o.created_at,'%Y-%m-%d') placed,
                ast.code admin_code, u.username
           FROM orders o JOIN admin_statuses ast ON o.admin_status_id=ast.id JOIN users u ON o.user_id=u.id WHERE o.id=?`, [ref_id]);
      if (!o) return res.status(404).json({ error: 'Order not found' });
      orderId = o.id; orderCode = o.order_code; username = o.username; dueDate = o.placed; createdAt = o.created_at;
      category = o.admin_code === 'unpaid' ? 'unpaid' : 'partial';
      amount = category === 'unpaid' ? o.total_price : (Number(o.amount_remaining) > 0 ? o.amount_remaining : Number(o.total_price) - Number(o.amount_paid));
      title = `${category === 'unpaid' ? 'Unpaid' : 'Collect balance'} — ${o.order_code || '#' + o.id}`;
    }

    // Respect the executive's data-access window: they can only see orders from
    // the last N days, so an out-of-window order would be invisible even if
    // assigned. Block it with a clear reason.
    if (su.role === 'sales_executive') {
      const [[w]] = await db.query('SELECT data_window_days FROM sales_users WHERE id=?', [su.id]);
      const days = w?.data_window_days || 60;
      const cutoff = new Date(Date.now() - days * 86400000);
      if (createdAt && new Date(createdAt) < cutoff) {
        return res.status(400).json({ error: `Order ${orderCode || '#' + orderId} is outside ${su.name}'s ${days}-day access window, so they wouldn't see it. Assign it to a Sales Lead, or widen their window.` });
      }
    }

    // Upsert the assignment to that person (claim any existing self-materialized row).
    await db.query(
      `INSERT INTO sales_tasks (sales_user_id, is_assigned, order_id, ref_type, ref_id, category, title, student_name, amount, due_date, status, created_by_id, created_by_role, created_by_name)
       VALUES (?,1,?,?,?,?,?,?,?,?, 'pending', ?, 'admin', ?)
       ON DUPLICATE KEY UPDATE is_assigned=1, category=VALUES(category), title=VALUES(title), amount=VALUES(amount),
                               created_by_role='admin', created_by_name=VALUES(created_by_name)`,
      [su.id, orderId, ref_type, ref_id, category, title, username, amount, dueDate, req.user.id, req.user.name || 'Admin']);

    await salesTaskNotify.onTaskAssigned(req.app.get('io'), req.user,
      { salesUser: su, title, dueDate, orderRef: orderCode, amount, orderId });

    res.status(201).json({ ok: true, assigned_to: su.name });
  } catch (e) {
    console.error('SalesActivity assignReminder error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /admin/sales-activity/task  body: { title, due_date, category?, amount?, sales_user_id?, is_general? }
// Create a task assigned to one person, OR a general task for the whole team.
exports.createTask = async (req, res) => {
  try {
    const { title, due_date, category, amount, sales_user_id, is_general } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const due = isoDate(due_date) || _todayISO();
    const cat = ['installment', 'partial', 'unpaid', 'paid', 'todo'].includes(category) ? category : 'todo';
    const amt = amount != null && amount !== '' ? amount : null;
    const io = req.app.get('io');

    if (is_general) {
      await db.query(
        `INSERT INTO sales_tasks (sales_user_id, is_general, ref_type, category, title, amount, due_date, status, created_by_id, created_by_role, created_by_name)
         VALUES (NULL, 1, 'manual', ?, ?, ?, ?, 'pending', ?, 'admin', ?)`,
        [cat, title.trim(), amt, due, req.user.id, req.user.name || 'Admin']);
      await salesTaskNotify.onGeneralTask(io, req.user, { title: title.trim(), dueDate: due });
      return res.status(201).json({ ok: true, general: true });
    }

    const [[su]] = await db.query("SELECT id, name, email, role FROM sales_users WHERE id=? AND status='active'", [sales_user_id]);
    if (!su) return res.status(400).json({ error: 'Pick a sales person, or make it a general task' });
    await db.query(
      `INSERT INTO sales_tasks (sales_user_id, is_assigned, ref_type, category, title, amount, due_date, status, created_by_id, created_by_role, created_by_name)
       VALUES (?, 1, 'manual', ?, ?, ?, ?, 'pending', ?, 'admin', ?)`,
      [su.id, cat, title.trim(), amt, due, req.user.id, req.user.name || 'Admin']);
    await salesTaskNotify.onTaskAssigned(io, req.user, { salesUser: su, title: title.trim(), dueDate: due, amount: amt });
    res.status(201).json({ ok: true, assigned_to: su.name });
  } catch (e) {
    console.error('SalesActivity createTask error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /admin/sales-activity/:id/tasks?from&to  → that person's calendar (read-only)
exports.getPersonTasks = async (req, res) => {
  try {
    const { user, cutoff } = await targetCutoff(req.params.id);
    if (!user) return res.status(404).json({ error: 'Sales person not found' });
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : '2000-01-01';
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : '2100-01-01';
    const items = await getCalendarItems(user.id, cutoff, from, to);
    res.json({ items });
  } catch (e) {
    console.error('SalesActivity getPersonTasks error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
