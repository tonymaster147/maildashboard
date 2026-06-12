// Reports — professional multi-tab reporting suite.
//
//   Overview  — KPI cards, 12-month revenue trend, breakdowns by service /
//               site / pipeline status
//   Tutors    — per-tutor workload + value; click a row to drill into that
//               tutor's orders
//   Customers — per-customer spend, outstanding balance, issues; click a row
//               to drill into their orders
//   Orders    — the original filterable order listing + CSV (unchanged)
//
// Every tab has its own CSV export. Overview/Tutors/Customers share a date
// range; Orders keeps its own filter form.

import { useState, useEffect, useCallback } from 'react';
import {
  FiDownload, FiFilter, FiRefreshCw, FiDollarSign, FiShoppingBag,
  FiCheckCircle, FiXCircle, FiClock, FiTrendingUp, FiUsers, FiUserCheck,
  FiChevronDown, FiChevronUp, FiAlertCircle,
} from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const resolvePhoto = (u) => (!u ? null : (u.startsWith('http') ? u : `${API_ORIGIN}${u}`));

const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString() : '—');

// Generic CSV download
function exportCsv(filename, headers, rows) {
  if (!rows.length) { alert('No data to export'); return; }
  const lines = [headers.map(h => `"${h.label}"`).join(',')];
  rows.forEach(row => {
    lines.push(headers.map(h => {
      let val = typeof h.value === 'function' ? h.value(row) : row[h.key];
      if (val === null || val === undefined) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','));
  });
  const uri = encodeURI('data:text/csv;charset=utf-8,' + lines.join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', uri);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: FiTrendingUp },
  { key: 'tutors', label: 'Tutors', icon: FiUserCheck },
  { key: 'customers', label: 'Customers', icon: FiUsers },
  { key: 'orders', label: 'Orders', icon: FiShoppingBag },
];

export default function Reports() {
  const api = useApi();
  const [tab, setTab] = useState('overview');

  // Shared date range for Overview / Tutors / Customers
  const [range, setRange] = useState({ start_date: '', end_date: '' });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Platform Reports</h2>
          <p className="text-secondary">Detailed performance, workload, and revenue reporting.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Shared date range (not for Orders — it has its own form) */}
      {tab !== 'orders' && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Start Date</label>
            <input type="date" className="form-input" value={range.start_date}
              onChange={e => setRange(r => ({ ...r, start_date: e.target.value }))} />
          </div>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>End Date</label>
            <input type="date" className="form-input" value={range.end_date}
              onChange={e => setRange(r => ({ ...r, end_date: e.target.value }))} />
          </div>
          {(range.start_date || range.end_date) && (
            <button type="button" className="btn btn-secondary" onClick={() => setRange({ start_date: '', end_date: '' })}>
              <FiRefreshCw size={14} /> All time
            </button>
          )}
        </div>
      )}

      {tab === 'overview' && <OverviewTab api={api} range={range} />}
      {tab === 'tutors' && <TutorsTab api={api} range={range} />}
      {tab === 'customers' && <CustomersTab api={api} range={range} />}
      {tab === 'orders' && <OrdersTab api={api} />}
    </div>
  );
}

// ════════════════════════ OVERVIEW ════════════════════════

function OverviewTab({ api, range }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportsOverview({ ...cleanRange(range) })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start_date, range.end_date]);

  if (loading) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;
  if (!data) return <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Failed to load overview.</div>;

  const t = data.totals;
  const kpis = [
    { label: 'Revenue (paid)', value: money(t.revenue), icon: FiDollarSign, color: '#4ade80' },
    { label: 'Outstanding', value: money(t.outstanding), icon: FiClock, color: '#fbbf24' },
    { label: 'Booked Value', value: money(t.booked_value), icon: FiTrendingUp, color: '#60a5fa' },
    { label: 'Avg Order Value', value: money(t.avg_order_value), icon: FiDollarSign, color: '#a78bfa' },
    { label: 'Total Orders', value: t.total_orders, icon: FiShoppingBag, color: '#60a5fa' },
    { label: 'Active', value: t.active_orders, icon: FiClock, color: '#4ade80' },
    { label: 'Completed', value: t.completed_orders, icon: FiCheckCircle, color: '#4ade80' },
    { label: 'Cancelled', value: t.cancelled_orders, icon: FiXCircle, color: '#f87171' },
  ];

  const maxMonthly = Math.max(1, ...data.monthly.map(m => Number(m.revenue)));

  return (
    <>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: `${k.color}22`, color: k.color,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <k.icon size={17} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{k.value}</div>
              <div className="text-secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly revenue trend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>
          Revenue — last 12 months
        </h4>
        {data.monthly.length === 0 ? (
          <p className="text-secondary" style={{ margin: 0 }}>No completed payments yet.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, overflowX: 'auto', paddingBottom: 4 }}>
            {data.monthly.map(m => (
              <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 56 }}>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{money(m.revenue)}</div>
                <div
                  title={`${m.month}: ${money(m.revenue)} (${m.payments} payments)`}
                  style={{
                    width: 30,
                    height: `${Math.max(4, (Number(m.revenue) / maxMonthly) * 90)}px`,
                    background: 'linear-gradient(180deg, #4ade80, #16a34a)',
                    borderRadius: 6,
                  }}
                />
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{m.month.slice(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <BreakdownCard title="By Service Type" rows={data.byType} showValue />
        <BreakdownCard title="By Site" rows={data.bySite} showValue />
        <BreakdownCard title="Order Pipeline (admin status)" rows={data.byStatus} />
      </div>
    </>
  );
}

function BreakdownCard({ title, rows, showValue }) {
  const max = Math.max(1, ...rows.map(r => Number(r.orders)));
  return (
    <div className="card">
      <h4 style={{ margin: '0 0 14px', fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>{title}</h4>
      {rows.length === 0 ? (
        <p className="text-secondary" style={{ margin: 0 }}>No data.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <span className="text-secondary">
                  {r.orders} order{r.orders === 1 ? '' : 's'}{showValue ? ` · ${money(r.value)}` : ''}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(127,127,127,0.15)' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${(Number(r.orders) / max) * 100}%`,
                  background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════ TUTORS ════════════════════════

function TutorsTab({ api, range }) {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);   // tutor id
  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setExpanded(null);
    api.getTutorReport({ ...cleanRange(range) })
      .then(r => setTutors(r.data.tutors || []))
      .catch(() => setTutors([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start_date, range.end_date]);

  const toggle = (tutorId) => {
    if (expanded === tutorId) { setExpanded(null); return; }
    setExpanded(tutorId);
    setDetailLoading(true);
    api.getTutorReport({ ...cleanRange(range), tutor_id: tutorId })
      .then(r => setDetail(r.data.detail || []))
      .catch(() => setDetail([]))
      .finally(() => setDetailLoading(false));
  };

  const totals = tutors.reduce((a, t) => ({
    assigned: a.assigned + Number(t.total_assigned),
    inProgress: a.inProgress + Number(t.in_progress),
    stopped: a.stopped + Number(t.work_stopped),
    completed: a.completed + Number(t.completed),
    completedValue: a.completedValue + Number(t.completed_value),
    activeValue: a.activeValue + Number(t.active_value),
  }), { assigned: 0, inProgress: 0, stopped: 0, completed: 0, completedValue: 0, activeValue: 0 });

  const doExport = () => exportCsv('tutor_report', [
    { label: 'Tutor', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Rating', key: 'rating' },
    { label: 'Status', key: 'status' },
    { label: 'Tasks Assigned', key: 'total_assigned' },
    { label: 'In Progress', key: 'in_progress' },
    { label: 'Work Stopped', key: 'work_stopped' },
    { label: 'Completed', key: 'completed' },
    { label: 'Completion Rate %', key: 'completion_rate' },
    { label: 'Completed Value ($)', key: 'completed_value' },
    { label: 'Active Value ($)', key: 'active_value' },
    { label: 'Last Assigned', value: r => dateFmt(r.last_assigned_at) },
  ], tutors);

  if (loading) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>
          Tutor Workload &amp; Performance
        </h4>
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={doExport}>
          <FiDownload size={13} /> Export CSV
        </button>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Tutor</th>
              <th>Rating</th>
              <th>Assigned</th>
              <th>In Progress</th>
              <th>Stopped</th>
              <th>Completed</th>
              <th>Rate</th>
              <th>Completed $</th>
              <th>Active $</th>
              <th>Last Assigned</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tutors.map(t => (
              <TutorRows
                key={t.id} t={t}
                expanded={expanded === t.id}
                onToggle={() => toggle(t.id)}
                detail={detail}
                detailLoading={detailLoading}
              />
            ))}
            {/* All-tutors totals */}
            <tr style={{ borderTop: '2px solid rgba(127,127,127,0.3)', fontWeight: 700 }}>
              <td>All tutors ({tutors.length})</td>
              <td>—</td>
              <td>{totals.assigned}</td>
              <td>{totals.inProgress}</td>
              <td>{totals.stopped}</td>
              <td>{totals.completed}</td>
              <td>{totals.assigned ? Math.round((totals.completed / totals.assigned) * 100) + '%' : '—'}</td>
              <td>{money(totals.completedValue)}</td>
              <td>{money(totals.activeValue)}</td>
              <td>—</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-secondary" style={{ fontSize: 11, marginTop: 10 }}>
        Note: when an order has multiple tutors its full value is counted for each assigned tutor.
      </p>
    </div>
  );
}

function TutorRows({ t, expanded, onToggle, detail, detailLoading }) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer', background: expanded ? 'rgba(96,165,250,0.06)' : undefined }}>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {resolvePhoto(t.photo_url) ? (
              <img src={resolvePhoto(t.photo_url)} alt={t.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(96,165,250,0.18)', color: '#60a5fa',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
              }}>{(t.name || '?').charAt(0).toUpperCase()}</span>
            )}
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div className="text-secondary" style={{ fontSize: 11 }}>{t.email}</div>
            </div>
          </div>
        </td>
        <td>{t.rating ? `★ ${Number(t.rating).toFixed(1)}` : '—'}</td>
        <td style={{ fontWeight: 600 }}>{t.total_assigned}</td>
        <td style={{ color: '#4ade80', fontWeight: 600 }}>{t.in_progress}</td>
        <td style={{ color: t.work_stopped > 0 ? '#f87171' : undefined, fontWeight: 600 }}>{t.work_stopped}</td>
        <td style={{ color: '#60a5fa', fontWeight: 600 }}>{t.completed}</td>
        <td>{t.completion_rate !== null ? `${t.completion_rate}%` : '—'}</td>
        <td>{money(t.completed_value)}</td>
        <td>{money(t.active_value)}</td>
        <td className="text-secondary" style={{ fontSize: 12 }}>{dateFmt(t.last_assigned_at)}</td>
        <td>{expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={11} style={{ background: 'rgba(0,0,0,0.15)', padding: '12px 16px' }}>
            {detailLoading ? (
              <div className="loading-spinner" style={{ margin: '1rem auto' }} />
            ) : detail.length === 0 ? (
              <p className="text-secondary" style={{ margin: 0 }}>No orders in this period.</p>
            ) : (
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Order</th><th>Course</th><th>Student</th><th>Assigned</th>
                    <th>Work Status</th><th>Order Status</th><th>Amount</th><th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map(o => (
                    <tr key={o.id}>
                      <td>{o.order_code || `#${o.id}`}</td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.course_name}</td>
                      <td>{o.user_name}</td>
                      <td className="text-secondary" style={{ fontSize: 12 }}>{dateFmt(o.assigned_at)}</td>
                      <td>{o.tutor_status_name || '—'}</td>
                      <td>{o.admin_status_name}</td>
                      <td>{money(o.total_price)}</td>
                      <td className="text-secondary" style={{ fontSize: 12 }}>{dateFmt(o.end_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ════════════════════════ CUSTOMERS ════════════════════════

function CustomersTab({ api, range }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setExpanded(null);
    api.getUserReport({ ...cleanRange(range) })
      .then(r => setUsers(r.data.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start_date, range.end_date]);

  const toggle = (userId) => {
    if (expanded === userId) { setExpanded(null); return; }
    setExpanded(userId);
    setDetailLoading(true);
    api.getUserReport({ ...cleanRange(range), user_id: userId })
      .then(r => setDetail(r.data.detail || []))
      .catch(() => setDetail([]))
      .finally(() => setDetailLoading(false));
  };

  const doExport = () => exportCsv('customer_report', [
    { label: 'Username', key: 'username' },
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Joined', value: r => dateFmt(r.joined_at) },
    { label: 'Total Orders', key: 'total_orders' },
    { label: 'Active', key: 'active_orders' },
    { label: 'Completed', key: 'completed_orders' },
    { label: 'Cancelled', key: 'cancelled_orders' },
    { label: 'Total Paid ($)', key: 'total_paid' },
    { label: 'Booked Value ($)', key: 'booked_value' },
    { label: 'Outstanding ($)', key: 'outstanding' },
    { label: 'Issues', key: 'issues_count' },
    { label: 'Last Order', value: r => dateFmt(r.last_order_at) },
  ], users);

  if (loading) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>
          Customer Value &amp; Activity
        </h4>
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={doExport}>
          <FiDownload size={13} /> Export CSV
        </button>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Orders</th>
              <th>Active</th>
              <th>Completed</th>
              <th>Total Paid</th>
              <th>Outstanding</th>
              <th>Issues</th>
              <th>Last Order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <CustomerRows
                key={u.id} u={u}
                expanded={expanded === u.id}
                onToggle={() => toggle(u.id)}
                detail={detail}
                detailLoading={detailLoading}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerRows({ u, expanded, onToggle, detail, detailLoading }) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer', background: expanded ? 'rgba(96,165,250,0.06)' : undefined }}>
        <td>
          <div style={{ fontWeight: 600 }}>{u.username}{u.name ? ` (${u.name})` : ''}</div>
          <div className="text-secondary" style={{ fontSize: 11 }}>{u.email}</div>
        </td>
        <td style={{ fontWeight: 600 }}>{u.total_orders}</td>
        <td style={{ color: '#4ade80', fontWeight: 600 }}>{u.active_orders}</td>
        <td style={{ color: '#60a5fa', fontWeight: 600 }}>{u.completed_orders}</td>
        <td style={{ fontWeight: 700 }}>{money(u.total_paid)}</td>
        <td style={{ color: Number(u.outstanding) > 0 ? '#fbbf24' : undefined }}>{money(u.outstanding)}</td>
        <td>
          {Number(u.issues_count) > 0
            ? <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiAlertCircle size={12} /> {u.issues_count}</span>
            : '0'}
        </td>
        <td className="text-secondary" style={{ fontSize: 12 }}>{dateFmt(u.last_order_at)}</td>
        <td>{expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} style={{ background: 'rgba(0,0,0,0.15)', padding: '12px 16px' }}>
            {detailLoading ? (
              <div className="loading-spinner" style={{ margin: '1rem auto' }} />
            ) : detail.length === 0 ? (
              <p className="text-secondary" style={{ margin: 0 }}>No orders in this period.</p>
            ) : (
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Order</th><th>Course</th><th>Date</th><th>Status</th>
                    <th>Tutor(s)</th><th>Total</th><th>Paid</th><th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map(o => (
                    <tr key={o.id}>
                      <td>{o.order_code || `#${o.id}`}</td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.course_name}</td>
                      <td className="text-secondary" style={{ fontSize: 12 }}>{dateFmt(o.created_at)}</td>
                      <td>{o.admin_status_name}</td>
                      <td>{o.tutor_names || <span className="text-secondary">Unassigned</span>}</td>
                      <td>{money(o.total_price)}</td>
                      <td style={{ color: '#4ade80' }}>{money(o.amount_paid)}</td>
                      <td style={{ color: Number(o.amount_remaining) > 0 ? '#fbbf24' : undefined }}>{money(o.amount_remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ════════════════════════ ORDERS (original report, unchanged) ════════════════════════

function OrdersTab({ api }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [filters, setFilters] = useState({
    search: '', status: '', order_status: '', user_id: '', tutor_id: '', start_date: '', end_date: '',
  });

  const fetchReports = useCallback(async (f) => {
    try {
      setLoading(true);
      const params = {};
      Object.entries(f).forEach(([k, v]) => { if (v) params[k] = v; });
      const response = await api.getReports(params);
      setReports(response.data.data);
      if (response.data.meta) {
        setUsers(response.data.meta.users);
        setTutors(response.data.meta.tutors);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchReports(filters); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = (e) => { e.preventDefault(); fetchReports(filters); };

  const resetFilters = () => {
    const empty = { search: '', status: '', order_status: '', user_id: '', tutor_id: '', start_date: '', end_date: '' };
    setFilters(empty);
    fetchReports(empty);
  };

  const doExport = () => exportCsv('orders_report', [
    { label: 'Order ID', value: r => r.order_code || `#${r.order_id}` },
    { label: 'Project Name', key: 'project_name' },
    { label: 'Order Status', key: 'order_status' },
    { label: 'Payment Status', key: 'payment_status' },
    { label: 'Amount ($)', key: 'amount' },
    { label: 'Date', value: r => dateFmt(r.order_created_date) },
    { label: 'User', key: 'user_name' },
    { label: 'User Email', key: 'user_email' },
    { label: 'Assigned Tutors', key: 'assigned_tutors' },
    { label: 'Order Type', key: 'order_type' },
    { label: 'Subject', key: 'subject' },
    { label: 'Plan', key: 'plan' },
  ], reports);

  return (
    <>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={applyFilters} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1.5rem',
          alignItems: 'end',
        }}>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Search Project / ID</label>
            <input type="text" className="form-input" name="search" placeholder="Search..."
              value={filters.search} onChange={handleFilterChange} />
          </div>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Project Status</label>
            <select className="form-select" name="order_status" value={filters.order_status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Payment Status</label>
            <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="unpaid">Unpaid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>User</label>
            <select className="form-select" name="user_id" value={filters.user_id} onChange={handleFilterChange}>
              <option value="">All Users</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Assigned Tutor</label>
            <select className="form-select" name="tutor_id" value={filters.tutor_id} onChange={handleFilterChange}>
              <option value="">All Tutors</option>
              {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Start Date</label>
            <input type="date" className="form-input" name="start_date" value={filters.start_date} onChange={handleFilterChange} />
          </div>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>End Date</label>
            <input type="date" className="form-input" name="end_date" value={filters.end_date} onChange={handleFilterChange} />
          </div>
          <div className="form-group mb-0" style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-secondary" style={{ flex: 1 }}>
              <FiFilter /> Filter
            </button>
            <button type="button" className="btn" onClick={resetFilters} title="Reset Filters" style={{ background: '#f1f5f9', color: '#64748b' }}>
              <FiRefreshCw />
            </button>
            <button type="button" className="btn btn-primary" onClick={doExport} disabled={reports.length === 0 || loading} title="Export CSV">
              <FiDownload />
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <p>No records found matching the criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Project Name</th><th>Date</th><th>User</th>
                  <th>Payment</th><th>Tutor(s)</th><th>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((row) => (
                  <tr key={row.order_id}>
                    <td>{row.order_code || `#${row.order_id}`}</td>
                    <td>{row.project_name}</td>
                    <td>{dateFmt(row.order_created_date)}</td>
                    <td>
                      <div>{row.user_name}</div>
                      <div className="text-secondary" style={{ fontSize: '0.8rem' }}>{row.user_email}</div>
                    </td>
                    <td>
                      <span className={`badge ${row.payment_status === 'completed' ? 'success' : 'warning'}`}>
                        {row.payment_status}
                      </span>
                    </td>
                    <td>{row.assigned_tutors || <span className="text-secondary">Unassigned</span>}</td>
                    <td>{money(row.amount)}</td>
                    <td>
                      <span className={`badge ${
                        row.order_status === 'completed' ? 'success' :
                        row.order_status === 'active' ? 'primary' : 'warning'
                      }`}>
                        {row.order_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// Strip empty values from the shared date range
function cleanRange(range) {
  const out = {};
  if (range.start_date) out.start_date = range.start_date;
  if (range.end_date) out.end_date = range.end_date;
  return out;
}
