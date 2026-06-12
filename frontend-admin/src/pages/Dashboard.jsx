// Admin Dashboard — redesigned in the Reports visual language: compact KPI
// cards with colored icon chips, a "Needs Attention" action strip that links
// straight to the problem pages, the gradient revenue trend, and a clickable
// Recent Orders table. Cards animate in with a small stagger (CSS .fade-up).

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiDollarSign, FiTrendingUp, FiCheckCircle, FiClock, FiUsers, FiUserCheck,
  FiAlertTriangle, FiUserPlus, FiPauseCircle, FiAlertCircle, FiCalendar,
  FiArrowRight, FiShoppingBag,
} from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getDashboardStats } = useApi();
  const navigate = useNavigate();

  useEffect(() => {
    getDashboardStats().then(res => { setStats(res.data); setLoading(false); }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;
  if (!stats) return null;

  const kpis = [
    { icon: FiDollarSign, label: 'Total Revenue', value: money(stats.total_sales), color: '#4ade80' },
    { icon: FiTrendingUp, label: 'This Month', value: money(stats.revenue_this_month), color: '#4ade80' },
    { icon: FiClock, label: 'Outstanding', value: money(stats.outstanding), color: '#fbbf24' },
    { icon: FiShoppingBag, label: 'Active Orders', value: stats.active_orders, color: '#60a5fa' },
    { icon: FiCheckCircle, label: 'Completed', value: stats.completed_orders, color: '#4ade80' },
    { icon: FiUsers, label: 'Students', value: stats.total_users, color: '#a78bfa' },
    { icon: FiUserCheck, label: 'Tutors', value: stats.total_tutors, color: '#06b6d4' },
    { icon: FiClock, label: 'Pending', value: stats.pending_orders, color: '#fbbf24' },
  ];

  // Actionable items — each links straight to where the work happens.
  const attention = [
    { count: stats.unassigned_paid, label: 'Paid orders waiting for a tutor', icon: FiUserPlus, color: '#fbbf24', to: '/orders' },
    { count: stats.work_stopped, label: 'Orders with work stopped', icon: FiPauseCircle, color: '#f87171', to: '/orders' },
    { count: stats.open_issues, label: 'Open support issues', icon: FiAlertCircle, color: '#f87171', to: '/issues' },
    { count: stats.overdue_installments, label: 'Overdue installments', icon: FiCalendar, color: '#fb923c', to: '/orders' },
    { count: stats.flagged_messages, label: 'Flagged chat messages', icon: FiAlertTriangle, color: '#f87171', to: '/chats' },
  ].filter(a => Number(a.count) > 0);

  const monthly = stats.monthly_revenue || [];
  const maxMonthly = Math.max(1, ...monthly.map(m => Number(m.revenue)));

  return (
    <div>
      <div className="page-header"><h2>Admin Dashboard</h2><p>Overview of your platform</p></div>

      {/* ── KPI cards ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 14, marginBottom: 20,
      }}>
        {kpis.map((k, i) => (
          <div key={i} className="card fade-up" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${i * 50}ms` }}>
            <span style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: `${k.color}22`, color: k.color,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <k.icon size={17} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap' }}>{k.value}</div>
              <div className="text-secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Needs attention ── */}
      {attention.length > 0 && (
        <div className="card fade-up" style={{ marginBottom: 20, animationDelay: '350ms' }}>
          <h4 style={{ margin: '0 0 14px', fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>
            Needs Attention
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {attention.map((a, i) => (
              <Link key={i} to={a.to} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10, textDecoration: 'none',
                background: `${a.color}14`, border: `1px solid ${a.color}40`,
                color: 'var(--text-primary)', transition: 'all 0.15s',
              }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: `${a.color}25`, color: a.color,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <a.icon size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800, fontSize: 17, color: a.color }}>{a.count}</span>
                  <span className="text-secondary" style={{ fontSize: 12 }}>{a.label}</span>
                </span>
                <FiArrowRight size={14} style={{ color: a.color, flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly revenue trend ── */}
      {monthly.length > 0 && (
        <div className="card fade-up" style={{ marginBottom: 20, animationDelay: '420ms' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>
            Revenue — last 12 months
          </h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160, overflowX: 'auto', paddingBottom: 4 }}>
            {monthly.map(m => (
              <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 60, flex: 1 }}>
                <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>{money(m.revenue)}</div>
                <div
                  title={`${m.month}: ${money(m.revenue)}${m.payments ? ` (${m.payments} payments)` : ''}`}
                  className="bar-grow"
                  style={{
                    width: '100%', maxWidth: 44,
                    height: `${Math.max(5, (Number(m.revenue) / maxMonthly) * 105)}px`,
                    background: 'linear-gradient(180deg, #4ade80, #16a34a)',
                    borderRadius: 6,
                  }}
                />
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{m.month.slice(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent orders ── */}
      <div className="card fade-up" style={{ animationDelay: '490ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>Recent Orders</h4>
          <Link to="/orders" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
            View all <FiArrowRight size={12} />
          </Link>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>ID</th><th>User</th><th>Course</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {stats.recent_orders?.map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{o.order_code || `#${o.id}`}</td>
                  <td>{o.username}</td>
                  <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.course_name}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{money(o.total_price)}</td>
                  <td><span className={`badge-status badge-${o.status}`}>{o.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
