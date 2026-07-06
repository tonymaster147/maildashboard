// Reports — professional multi-tab reporting suite.
//
//   Overview  — KPI cards, 12-month revenue trend, breakdowns
//   Tutors    — per-tutor workload + value; drill into a tutor's orders
//   Customers — per-customer spend, outstanding, issues; drill into orders
//   Orders    — filterable order listing
//
// Tutors/Customers/Orders load 100 rows/page from the DB (server-side), every
// column is click-to-sort (server-side), and "Export CSV" pulls ALL matching
// rows. Drill-downs are paginated + sortable too.

import { useState, useEffect, useCallback } from 'react';
import {
  FiDownload, FiFilter, FiRefreshCw, FiDollarSign, FiShoppingBag,
  FiCheckCircle, FiXCircle, FiClock, FiTrendingUp, FiUsers, FiUserCheck,
  FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight, FiAlertCircle,
} from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const resolvePhoto = (u) => (!u ? null : (u.startsWith('http') ? u : `${API_ORIGIN}${u}`));

const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const PAGE_SIZE = 100;

// Sort helpers: clicking a new column starts asc; clicking the active one flips.
const nextSort = (s, col) => (s.by === col ? { by: col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by: col, dir: 'asc' });
const sortParams = (s, prefix = '') => (s.by ? { [prefix + 'sort_by']: s.by, [prefix + 'sort_dir']: s.dir } : {});

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

// Clickable sort header cell
function SortTh({ label, col, sort, onSort, style }) {
  const active = sort.by === col;
  return (
    <th onClick={() => onSort(col)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', ...style }} title="Click to sort">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <span style={{ opacity: active ? 1 : 0.3, fontSize: 10 }}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </span>
    </th>
  );
}

// Prev / Next pager (only shown when there's more than one page)
function Pager({ page, total, limit = PAGE_SIZE, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
      <span className="text-secondary" style={{ fontSize: 12 }}>
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><FiChevronLeft size={14} /></button>
      <span style={{ fontSize: 12 }}>Page {page} / {pages}</span>
      <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}><FiChevronRight size={14} /></button>
    </div>
  );
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
  const [range, setRange] = useState({ start_date: '', end_date: '' });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Platform Reports</h2>
          <p className="text-secondary">Detailed performance, workload, and revenue reporting.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} type="button"
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${k.color}22`, color: k.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <k.icon size={17} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{k.value}</div>
              <div className="text-secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>Revenue — last 12 months</h4>
        {data.monthly.length === 0 ? (
          <p className="text-secondary" style={{ margin: 0 }}>No completed payments yet.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, overflowX: 'auto', paddingBottom: 4 }}>
            {data.monthly.map(m => (
              <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 56 }}>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{money(m.revenue)}</div>
                <div title={`${m.month}: ${money(m.revenue)} (${m.payments} payments)`}
                  style={{ width: 30, height: `${Math.max(4, (Number(m.revenue) / maxMonthly) * 90)}px`, background: 'linear-gradient(180deg, #4ade80, #16a34a)', borderRadius: 6 }} />
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{m.month.slice(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                <span className="text-secondary">{r.orders} order{r.orders === 1 ? '' : 's'}{showValue ? ` · ${money(r.value)}` : ''}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(127,127,127,0.15)' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${(Number(r.orders) / max) * 100}%`, background: 'linear-gradient(90deg, #60a5fa, #a78bfa)' }} />
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ by: '', dir: 'desc' });
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailSort, setDetailSort] = useState({ by: '', dir: 'desc' });
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { setPage(1); setExpanded(null); }, [range.start_date, range.end_date]);

  useEffect(() => {
    setLoading(true);
    api.getTutorReport({ ...cleanRange(range), page, limit: PAGE_SIZE, ...sortParams(sort) })
      .then(r => { setTutors(r.data.tutors || []); setTotal(r.data.total || 0); })
      .catch(() => { setTutors([]); setTotal(0); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start_date, range.end_date, page, sort.by, sort.dir]);

  useEffect(() => {
    if (!expanded) return;
    setDetailLoading(true);
    api.getTutorReport({ ...cleanRange(range), tutor_id: expanded, detail_only: 1, d_page: detailPage, d_limit: PAGE_SIZE, ...sortParams(detailSort, 'd_') })
      .then(r => { setDetail(r.data.detail || []); setDetailTotal(r.data.detail_total || 0); })
      .catch(() => { setDetail([]); setDetailTotal(0); })
      .finally(() => setDetailLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, detailPage, detailSort.by, detailSort.dir]);

  const onSort = (col) => { setSort(s => nextSort(s, col)); setPage(1); };
  const toggle = (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setDetailPage(1); setDetailSort({ by: '', dir: 'desc' }); setDetail([]); setExpanded(id);
  };
  const onDetailSort = (col) => { setDetailSort(s => nextSort(s, col)); setDetailPage(1); };

  const doExport = async () => {
    try {
      const r = await api.getTutorReport({ ...cleanRange(range), all: 1, ...sortParams(sort) });
      exportCsv('tutor_report', [
        { label: 'Tutor', key: 'name' }, { label: 'Email', key: 'email' }, { label: 'Rating', key: 'rating' },
        { label: 'Status', key: 'status' }, { label: 'Tasks Assigned', key: 'total_assigned' },
        { label: 'In Progress', key: 'in_progress' }, { label: 'Work Stopped', key: 'work_stopped' },
        { label: 'Completed', key: 'completed' }, { label: 'Completion Rate %', key: 'completion_rate' },
        { label: 'Completed Value ($)', key: 'completed_value' }, { label: 'Active Value ($)', key: 'active_value' },
        { label: 'Last Assigned', value: r => dateFmt(r.last_assigned_at) },
      ], r.data.tutors || []);
    } catch { alert('Export failed'); }
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>Tutor Workload &amp; Performance</h4>
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={doExport}>
          <FiDownload size={13} /> Export CSV
        </button>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <SortTh label="Tutor" col="name" sort={sort} onSort={onSort} />
              <SortTh label="Rating" col="rating" sort={sort} onSort={onSort} />
              <SortTh label="Assigned" col="total_assigned" sort={sort} onSort={onSort} />
              <SortTh label="In Progress" col="in_progress" sort={sort} onSort={onSort} />
              <SortTh label="Stopped" col="work_stopped" sort={sort} onSort={onSort} />
              <SortTh label="Completed" col="completed" sort={sort} onSort={onSort} />
              <th>Rate</th>
              <SortTh label="Completed $" col="completed_value" sort={sort} onSort={onSort} />
              <SortTh label="Active $" col="active_value" sort={sort} onSort={onSort} />
              <SortTh label="Last Assigned" col="last_assigned_at" sort={sort} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tutors.map(t => (
              <TutorRows key={t.id} t={t} expanded={expanded === t.id} onToggle={() => toggle(t.id)}
                detail={detail} detailLoading={detailLoading} detailTotal={detailTotal}
                detailPage={detailPage} onDetailPage={setDetailPage} detailSort={detailSort} onDetailSort={onDetailSort} />
            ))}
            {tutors.length === 0 && <tr><td colSpan={11} className="text-secondary" style={{ textAlign: 'center', padding: 24 }}>No tutors.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} />
      <p className="text-secondary" style={{ fontSize: 11, marginTop: 10 }}>
        Note: when an order has multiple tutors its full value is counted for each assigned tutor.
      </p>
    </div>
  );
}

function TutorRows({ t, expanded, onToggle, detail, detailLoading, detailTotal, detailPage, onDetailPage, detailSort, onDetailSort }) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer', background: expanded ? 'rgba(96,165,250,0.06)' : undefined }}>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {resolvePhoto(t.photo_url) ? (
              <img src={resolvePhoto(t.photo_url)} alt={t.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'rgba(96,165,250,0.18)', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{(t.name || '?').charAt(0).toUpperCase()}</span>
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
              <>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <SortTh label="Order" col="order_code" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Course" col="course_name" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Student" col="user_name" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Assigned" col="assigned_at" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Work Status" col="tutor_status_name" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Order Status" col="admin_status_name" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Amount" col="total_price" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Due" col="end_date" sort={detailSort} onSort={onDetailSort} />
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
                <Pager page={detailPage} total={detailTotal} onPage={onDetailPage} />
              </>
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ by: '', dir: 'desc' });
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailSort, setDetailSort] = useState({ by: '', dir: 'desc' });
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { setPage(1); setExpanded(null); }, [range.start_date, range.end_date]);

  useEffect(() => {
    setLoading(true);
    api.getUserReport({ ...cleanRange(range), page, limit: PAGE_SIZE, ...sortParams(sort) })
      .then(r => { setUsers(r.data.users || []); setTotal(r.data.total || 0); })
      .catch(() => { setUsers([]); setTotal(0); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start_date, range.end_date, page, sort.by, sort.dir]);

  useEffect(() => {
    if (!expanded) return;
    setDetailLoading(true);
    api.getUserReport({ ...cleanRange(range), user_id: expanded, detail_only: 1, d_page: detailPage, d_limit: PAGE_SIZE, ...sortParams(detailSort, 'd_') })
      .then(r => { setDetail(r.data.detail || []); setDetailTotal(r.data.detail_total || 0); })
      .catch(() => { setDetail([]); setDetailTotal(0); })
      .finally(() => setDetailLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, detailPage, detailSort.by, detailSort.dir]);

  const onSort = (col) => { setSort(s => nextSort(s, col)); setPage(1); };
  const toggle = (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setDetailPage(1); setDetailSort({ by: '', dir: 'desc' }); setDetail([]); setExpanded(id);
  };
  const onDetailSort = (col) => { setDetailSort(s => nextSort(s, col)); setDetailPage(1); };

  const doExport = async () => {
    try {
      const r = await api.getUserReport({ ...cleanRange(range), all: 1, ...sortParams(sort) });
      exportCsv('customer_report', [
        { label: 'Username', key: 'username' }, { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' },
        { label: 'Joined', value: r => dateFmt(r.joined_at) }, { label: 'Total Orders', key: 'total_orders' },
        { label: 'Active', key: 'active_orders' }, { label: 'Completed', key: 'completed_orders' },
        { label: 'Unpaid', key: 'unpaid_orders' }, { label: 'Cancelled', key: 'cancelled_orders' },
        { label: 'Total Paid ($)', key: 'total_paid' }, { label: 'Booked Value ($)', key: 'booked_value' },
        { label: 'Outstanding ($)', key: 'outstanding' }, { label: 'Issues', key: 'issues_count' },
        { label: 'Last Order', value: r => dateFmt(r.last_order_at) },
      ], r.data.users || []);
    } catch { alert('Export failed'); }
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>Customer Value &amp; Activity</h4>
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={doExport}>
          <FiDownload size={13} /> Export CSV
        </button>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <SortTh label="Customer" col="username" sort={sort} onSort={onSort} />
              <SortTh label="Orders" col="total_orders" sort={sort} onSort={onSort} />
              <SortTh label="Active" col="active_orders" sort={sort} onSort={onSort} />
              <SortTh label="Completed" col="completed_orders" sort={sort} onSort={onSort} />
              <SortTh label="Unpaid" col="unpaid_orders" sort={sort} onSort={onSort} />
              <SortTh label="Total Paid" col="total_paid" sort={sort} onSort={onSort} />
              <SortTh label="Outstanding" col="outstanding" sort={sort} onSort={onSort} />
              <SortTh label="Issues" col="issues_count" sort={sort} onSort={onSort} />
              <SortTh label="Last Order" col="last_order_at" sort={sort} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <CustomerRows key={u.id} u={u} expanded={expanded === u.id} onToggle={() => toggle(u.id)}
                detail={detail} detailLoading={detailLoading} detailTotal={detailTotal}
                detailPage={detailPage} onDetailPage={setDetailPage} detailSort={detailSort} onDetailSort={onDetailSort} />
            ))}
            {users.length === 0 && <tr><td colSpan={10} className="text-secondary" style={{ textAlign: 'center', padding: 24 }}>No customers.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} />
    </div>
  );
}

function CustomerRows({ u, expanded, onToggle, detail, detailLoading, detailTotal, detailPage, onDetailPage, detailSort, onDetailSort }) {
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
        <td style={{ color: '#f59e0b', fontWeight: 600 }}>{u.unpaid_orders}</td>
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
          <td colSpan={10} style={{ background: 'rgba(0,0,0,0.15)', padding: '12px 16px' }}>
            {detailLoading ? (
              <div className="loading-spinner" style={{ margin: '1rem auto' }} />
            ) : detail.length === 0 ? (
              <p className="text-secondary" style={{ margin: 0 }}>No orders in this period.</p>
            ) : (
              <>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <SortTh label="Order" col="order_code" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Course" col="course_name" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Date" col="created_at" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Status" col="admin_status_name" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Tutor(s)" col="tutor_names" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Total" col="total_price" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Paid" col="amount_paid" sort={detailSort} onSort={onDetailSort} />
                      <SortTh label="Remaining" col="amount_remaining" sort={detailSort} onSort={onDetailSort} />
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
                <Pager page={detailPage} total={detailTotal} onPage={onDetailPage} />
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ════════════════════════ ORDERS ════════════════════════

function OrdersTab({ api }) {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ by: '', dir: 'desc' });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', order_status: '', user_id: '', tutor_id: '', start_date: '', end_date: '' });
  // The filters actually applied (separate from the form so typing doesn't refetch)
  const [applied, setApplied] = useState(filters);

  const cleanFilters = (f) => { const p = {}; Object.entries(f).forEach(([k, v]) => { if (v) p[k] = v; }); return p; };

  const fetchReports = useCallback(async (f, pg, sortState) => {
    try {
      setLoading(true);
      const response = await api.getReports({ ...cleanFilters(f), page: pg, limit: PAGE_SIZE, ...sortParams(sortState) });
      setReports(response.data.data);
      if (response.data.meta) {
        setUsers(response.data.meta.users);
        setTutors(response.data.meta.tutors);
        setTotal(response.data.meta.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchReports(applied, page, sort); }, [applied, page, sort.by, sort.dir]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (e) => { const { name, value } = e.target; setFilters(prev => ({ ...prev, [name]: value })); };
  const applyFilters = (e) => { e.preventDefault(); setPage(1); setApplied(filters); };
  const resetFilters = () => {
    const empty = { search: '', status: '', order_status: '', user_id: '', tutor_id: '', start_date: '', end_date: '' };
    setFilters(empty); setPage(1); setApplied(empty);
  };
  const onSort = (col) => { setSort(s => nextSort(s, col)); setPage(1); };

  const doExport = async () => {
    try {
      const r = await api.getReports({ ...cleanFilters(applied), all: 1, ...sortParams(sort) });
      exportCsv('orders_report', [
        { label: 'Order ID', value: r => r.order_code || `#${r.order_id}` }, { label: 'Project Name', key: 'project_name' },
        { label: 'Order Status', key: 'order_status' }, { label: 'Payment Status', key: 'payment_status' },
        { label: 'Amount ($)', key: 'amount' }, { label: 'Date', value: r => dateFmt(r.order_created_date) },
        { label: 'User', key: 'user_name' }, { label: 'User Email', key: 'user_email' },
        { label: 'Assigned Tutors', key: 'assigned_tutors' }, { label: 'Order Type', key: 'order_type' },
        { label: 'Subject', key: 'subject' }, { label: 'Plan', key: 'plan' },
      ], r.data.data || []);
    } catch { alert('Export failed'); }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={applyFilters} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Search Project / ID</label>
            <input type="text" className="form-input" name="search" placeholder="Search..." value={filters.search} onChange={handleFilterChange} />
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
            <button type="submit" className="btn btn-secondary" style={{ flex: 1 }}><FiFilter /> Filter</button>
            <button type="button" className="btn" onClick={resetFilters} title="Reset Filters" style={{ background: '#f1f5f9', color: '#64748b' }}><FiRefreshCw /></button>
            <button type="button" className="btn btn-primary" onClick={doExport} disabled={loading} title="Export CSV (all matching)"><FiDownload /></button>
          </div>
        </form>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}><p>No records found matching the criteria.</p></div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <SortTh label="ID" col="order_code" sort={sort} onSort={onSort} />
                    <SortTh label="Project Name" col="project_name" sort={sort} onSort={onSort} />
                    <SortTh label="Date" col="order_created_date" sort={sort} onSort={onSort} />
                    <SortTh label="User" col="user_name" sort={sort} onSort={onSort} />
                    <SortTh label="Payment" col="payment_status" sort={sort} onSort={onSort} />
                    <th>Tutor(s)</th>
                    <SortTh label="Amount" col="amount" sort={sort} onSort={onSort} />
                    <SortTh label="Status" col="order_status" sort={sort} onSort={onSort} />
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
                      <td><span className={`badge ${row.payment_status === 'completed' ? 'success' : 'warning'}`}>{row.payment_status}</span></td>
                      <td>{row.assigned_tutors || <span className="text-secondary">Unassigned</span>}</td>
                      <td>{money(row.amount)}</td>
                      <td><span className={`badge ${row.order_status === 'completed' ? 'success' : row.order_status === 'active' ? 'primary' : 'warning'}`}>{row.order_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={total} onPage={setPage} />
          </>
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
