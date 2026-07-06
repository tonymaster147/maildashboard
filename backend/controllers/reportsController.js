// Detailed reporting endpoints for the admin/sales Reports section.
//
//   GET /reports/overview  — KPI totals, monthly revenue, status / service /
//                            site breakdowns
//   GET /reports/tutors    — per-tutor workload + value aggregates;
//                            ?tutor_id=N adds that tutor's order list
//   GET /reports/users     — per-customer spend aggregates;
//                            ?user_id=N adds that customer's order list
//
// All three accept optional ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD which
// scope by orders.created_at (and payments.created_at for revenue numbers).
//
// Money definitions (kept consistent across tabs):
//   revenue        = SUM(payments.amount) WHERE status='completed'
//   outstanding    = SUM(orders.amount_remaining) on non-cancelled orders
//   completed work = SUM(orders.total_price) where the tutor finished
//                    (order completed OR tutor_status completed)

const db = require('../config/db');

// Build a created_at range condition + params for a given column.
function dateRange(col, start, end) {
  let sql = '';
  const params = [];
  if (start) { sql += ` AND ${col} >= ?`; params.push(start + ' 00:00:00'); }
  if (end)   { sql += ` AND ${col} <= ?`; params.push(end + ' 23:59:59'); }
  return { sql, params };
}

// A sales_executive may only report on data within their window. Clamp the
// effective start_date to no earlier than the cutoff (returns YYYY-MM-DD).
function clampStart(req, start) {
  if (!req.salesCutoff) return start;
  const cut = new Date(req.salesCutoff).toISOString().slice(0, 10);
  return (start && start > cut) ? start : cut;
}

// Server-side pagination + sort. `allowed` whitelists sort keys → safe SQL
// expressions (prevents injection). Reads page/limit/sort_by/sort_dir/all from
// the given query prefix (''=main table, 'd_'=drill-down). `all=1` skips LIMIT
// (used by "Export CSV — all matching rows").
function paging(query, allowed, defaultOrderBy, prefix = '') {
  const q = (k) => query[prefix + k];
  const all = ['1', 'true'].includes(String(q('all') || ''));
  const limit = Math.min(1000, Math.max(1, parseInt(q('limit')) || 100));
  const page = Math.max(1, parseInt(q('page')) || 1);
  const dir = String(q('sort_dir') || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const key = q('sort_by');
  const orderBy = (key && allowed[key]) ? `${allowed[key]} ${dir}` : defaultOrderBy;
  const limitSql = all ? '' : `LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
  return { all, limit, page, dir, orderBy, limitSql, sortKey: (key && allowed[key]) ? key : null };
}

exports.overview = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startEff = clampStart(req, start_date);
    const o = dateRange('o.created_at', startEff, end_date);
    const p = dateRange('p.created_at', startEff, end_date);

    // KPI totals
    const [[orderTotals]] = await db.query(
      `SELECT
        COUNT(*) AS total_orders,
        SUM(o.status = 'active')    AS active_orders,
        SUM(o.status = 'completed') AS completed_orders,
        SUM(o.status = 'cancelled') AS cancelled_orders,
        SUM(o.status = 'pending')   AS pending_orders,
        SUM(o.status = 'incomplete') AS incomplete_orders,
        IFNULL(SUM(CASE WHEN o.status NOT IN ('cancelled','incomplete') THEN o.total_price END), 0) AS booked_value,
        IFNULL(SUM(CASE WHEN o.status NOT IN ('cancelled') THEN o.amount_remaining END), 0) AS outstanding
       FROM orders o WHERE 1=1 ${o.sql}`,
      o.params
    );

    const [[paymentTotals]] = await db.query(
      `SELECT IFNULL(SUM(p.amount), 0) AS revenue, COUNT(*) AS payment_count
       FROM payments p WHERE p.status = 'completed' ${p.sql}`,
      p.params
    );

    // Monthly revenue, last 12 months (independent of the date filter so the
    // trend strip always has context) — but never earlier than a sales
    // executive's data window.
    const monthlyParams = [];
    let monthlyFloor = "p.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)";
    if (req.salesCutoff) { monthlyFloor = 'p.created_at >= ?'; monthlyParams.push(req.salesCutoff); }
    const [monthly] = await db.query(
      `SELECT DATE_FORMAT(p.created_at, '%Y-%m') AS month, IFNULL(SUM(p.amount), 0) AS revenue, COUNT(*) AS payments
       FROM payments p
       WHERE p.status = 'completed' AND ${monthlyFloor}
       GROUP BY month ORDER BY month`,
      monthlyParams
    );

    // Breakdown: orders + revenue by service type
    const [byType] = await db.query(
      `SELECT ot.name AS label, COUNT(*) AS orders,
              IFNULL(SUM(CASE WHEN o.status NOT IN ('cancelled','incomplete') THEN o.total_price END), 0) AS value
       FROM orders o JOIN order_types ot ON o.order_type_id = ot.id
       WHERE 1=1 ${o.sql}
       GROUP BY ot.id ORDER BY value DESC`,
      o.params
    );

    // Breakdown by site (multi-WordPress)
    const [bySite] = await db.query(
      `SELECT IFNULL(s.name, 'Unknown') AS label, COUNT(*) AS orders,
              IFNULL(SUM(CASE WHEN o.status NOT IN ('cancelled','incomplete') THEN o.total_price END), 0) AS value
       FROM orders o LEFT JOIN sites s ON o.site_id = s.id
       WHERE 1=1 ${o.sql}
       GROUP BY s.id ORDER BY value DESC`,
      o.params
    );

    // Breakdown by admin status (live pipeline view)
    const [byStatus] = await db.query(
      `SELECT IFNULL(astat.name, o.status) AS label, COUNT(*) AS orders
       FROM orders o LEFT JOIN admin_statuses astat ON o.admin_status_id = astat.id
       WHERE 1=1 ${o.sql}
       GROUP BY label ORDER BY orders DESC`,
      o.params
    );

    res.json({
      totals: {
        ...orderTotals,
        revenue: paymentTotals.revenue,
        payment_count: paymentTotals.payment_count,
        avg_order_value: orderTotals.total_orders > 0
          ? Number(orderTotals.booked_value) / Math.max(1, (orderTotals.total_orders - orderTotals.cancelled_orders - orderTotals.incomplete_orders))
          : 0,
      },
      monthly,
      byType,
      bySite,
      byStatus,
    });
  } catch (error) {
    console.error('Reports overview error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.tutorReport = async (req, res) => {
  try {
    const { start_date, end_date, tutor_id, detail_only } = req.query;
    const startEff = clampStart(req, start_date);
    const o = dateRange('o.created_at', startEff, end_date);

    const allowed = {
      name: 't.name', rating: 't.rating', total_assigned: 'total_assigned',
      in_progress: 'in_progress', work_stopped: 'work_stopped', completed: 'completed',
      cancelled: 'cancelled', completed_value: 'completed_value', active_value: 'active_value',
      last_assigned_at: 'last_assigned_at',
    };
    const pg = paging(req.query, allowed, 'total_assigned DESC, t.name');

    let rows = [], total = 0;
    if (!detail_only) {
      const [tutors] = await db.query(
        `SELECT
          t.id, t.name, t.email, t.photo_url, t.rating, t.status,
          COUNT(ot.order_id) AS total_assigned,
          IFNULL(SUM(ts.code = 'in_progress' AND o.status = 'active'), 0) AS in_progress,
          IFNULL(SUM(ts.code = 'work_stopped'), 0) AS work_stopped,
          IFNULL(SUM(o.status = 'completed' OR ts.code = 'completed'), 0) AS completed,
          IFNULL(SUM(o.status = 'cancelled'), 0) AS cancelled,
          IFNULL(SUM(CASE WHEN o.status = 'completed' OR ts.code = 'completed' THEN o.total_price ELSE 0 END), 0) AS completed_value,
          IFNULL(SUM(CASE WHEN o.status = 'active' AND IFNULL(ts.code, '') <> 'completed' THEN o.total_price ELSE 0 END), 0) AS active_value,
          MAX(ot.assigned_at) AS last_assigned_at
         FROM tutors t
         LEFT JOIN order_tutors ot ON ot.tutor_id = t.id
         LEFT JOIN orders o ON o.id = ot.order_id ${o.sql}
         LEFT JOIN tutor_statuses ts ON o.tutor_status_id = ts.id
         GROUP BY t.id
         ORDER BY ${pg.orderBy} ${pg.limitSql}`,
        o.params
      );
      rows = tutors.map(t => ({
        ...t,
        completion_rate: t.total_assigned > 0 ? Math.round((t.completed / t.total_assigned) * 100) : null,
      }));
      const [[c]] = await db.query('SELECT COUNT(*) AS total FROM tutors');
      total = c.total;
    }

    // Optional drill-down: one tutor's order list (own pagination via d_* params)
    let detail = null, detail_total = 0;
    if (tutor_id) {
      const d = dateRange('o.created_at', startEff, end_date);
      const allowedD = {
        order_code: 'o.order_code', course_name: 'o.course_name', total_price: 'o.total_price',
        status: 'o.status', created_at: 'o.created_at', end_date: 'o.end_date',
        assigned_at: 'ot2.assigned_at', user_name: 'u.username',
        tutor_status_name: 'tutor_status_name', admin_status_name: 'admin_status_name',
      };
      const pgD = paging(req.query, allowedD, 'ot2.assigned_at DESC', 'd_');
      const [orders] = await db.query(
        `SELECT o.id, o.order_code, o.course_name, o.total_price, o.status,
                o.created_at, o.end_date, ot2.assigned_at,
                u.username AS user_name,
                IFNULL(ts.name, '') AS tutor_status_name,
                IFNULL(astat.name, o.status) AS admin_status_name
         FROM order_tutors ot2
         JOIN orders o ON o.id = ot2.order_id
         JOIN users u ON o.user_id = u.id
         LEFT JOIN tutor_statuses ts ON o.tutor_status_id = ts.id
         LEFT JOIN admin_statuses astat ON o.admin_status_id = astat.id
         WHERE ot2.tutor_id = ? ${d.sql}
         ORDER BY ${pgD.orderBy} ${pgD.limitSql}`,
        [tutor_id, ...d.params]
      );
      detail = orders;
      const [[dc]] = await db.query(
        `SELECT COUNT(*) AS total FROM order_tutors ot2 JOIN orders o ON o.id = ot2.order_id WHERE ot2.tutor_id = ? ${d.sql}`,
        [tutor_id, ...d.params]
      );
      detail_total = dc.total;
    }

    res.json({ tutors: rows, total, page: pg.page, limit: pg.limit, detail, detail_total });
  } catch (error) {
    console.error('Tutor report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.userReport = async (req, res) => {
  try {
    const { start_date, end_date, user_id, detail_only } = req.query;
    const startEff = clampStart(req, start_date);
    const o = dateRange('o.created_at', startEff, end_date);

    const allowed = {
      username: 'u.username', total_orders: 'total_orders', active_orders: 'active_orders',
      completed_orders: 'completed_orders', unpaid_orders: 'unpaid_orders',
      cancelled_orders: 'cancelled_orders', booked_value: 'booked_value',
      outstanding: 'outstanding', total_paid: 'total_paid', issues_count: 'issues_count',
      last_order_at: 'last_order_at',
    };
    const pg = paging(req.query, allowed, 'total_paid DESC, total_orders DESC');

    let users = [], total = 0;
    if (!detail_only) {
      [users] = await db.query(
        `SELECT
          u.id, u.username, u.name, u.email, u.created_at AS joined_at,
          COUNT(o.id) AS total_orders,
          IFNULL(SUM(o.status = 'active'), 0) AS active_orders,
          IFNULL(SUM(o.status = 'completed'), 0) AS completed_orders,
          IFNULL(SUM(o.status = 'incomplete'), 0) AS unpaid_orders,
          IFNULL(SUM(o.status = 'cancelled'), 0) AS cancelled_orders,
          IFNULL(SUM(CASE WHEN o.status NOT IN ('cancelled','incomplete') THEN o.total_price END), 0) AS booked_value,
          IFNULL(SUM(CASE WHEN o.status NOT IN ('cancelled') THEN o.amount_remaining END), 0) AS outstanding,
          (SELECT IFNULL(SUM(p.amount), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'completed') AS total_paid,
          (SELECT COUNT(*) FROM issues i WHERE i.user_id = u.id) AS issues_count,
          MAX(o.created_at) AS last_order_at
         FROM users u
         LEFT JOIN orders o ON o.user_id = u.id ${o.sql}
         GROUP BY u.id
         HAVING total_orders > 0 OR total_paid > 0
         ORDER BY ${pg.orderBy} ${pg.limitSql}`,
        o.params
      );
      const [[c]] = await db.query(
        `SELECT COUNT(*) AS total FROM (
           SELECT u.id, COUNT(o.id) AS total_orders,
             (SELECT IFNULL(SUM(p.amount), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'completed') AS total_paid
           FROM users u LEFT JOIN orders o ON o.user_id = u.id ${o.sql}
           GROUP BY u.id HAVING total_orders > 0 OR total_paid > 0
         ) x`,
        o.params
      );
      total = c.total;
    }

    // Optional drill-down: one customer's order list (own pagination via d_* params)
    let detail = null, detail_total = 0;
    if (user_id) {
      const d = dateRange('o.created_at', startEff, end_date);
      const allowedD = {
        order_code: 'o.order_code', course_name: 'o.course_name', total_price: 'o.total_price',
        amount_paid: 'o.amount_paid', amount_remaining: 'o.amount_remaining', status: 'o.status',
        created_at: 'o.created_at', admin_status_name: 'admin_status_name', tutor_names: 'tutor_names',
      };
      const pgD = paging(req.query, allowedD, 'o.created_at DESC', 'd_');
      const [orders] = await db.query(
        `SELECT o.id, o.order_code, o.course_name, o.total_price, o.amount_paid,
                o.amount_remaining, o.status, o.created_at,
                IFNULL(astat.name, o.status) AS admin_status_name,
                GROUP_CONCAT(DISTINCT t.name) AS tutor_names
         FROM orders o
         LEFT JOIN admin_statuses astat ON o.admin_status_id = astat.id
         LEFT JOIN order_tutors otr ON otr.order_id = o.id
         LEFT JOIN tutors t ON t.id = otr.tutor_id
         WHERE o.user_id = ? ${d.sql}
         GROUP BY o.id
         ORDER BY ${pgD.orderBy} ${pgD.limitSql}`,
        [user_id, ...d.params]
      );
      detail = orders;
      const [[dc]] = await db.query(
        `SELECT COUNT(DISTINCT o.id) AS total FROM orders o WHERE o.user_id = ? ${d.sql}`,
        [user_id, ...d.params]
      );
      detail_total = dc.total;
    }

    res.json({ users, total, page: pg.page, limit: pg.limit, detail, detail_total });
  } catch (error) {
    console.error('User report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
