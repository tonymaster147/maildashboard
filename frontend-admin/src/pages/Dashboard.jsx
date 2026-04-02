import { useState, useEffect } from 'react';
import { FiDollarSign, FiTrendingUp, FiCheckCircle, FiClock, FiUsers, FiUserCheck, FiAlertTriangle } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getDashboardStats } = useApi();

  useEffect(() => {
    getDashboardStats().then(res => { setStats(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;
  if (!stats) return null;

  const statCards = [
    { icon: <FiDollarSign />, label: 'Total Sales', value: `$${parseFloat(stats.total_sales).toFixed(2)}`, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    { icon: <FiTrendingUp />, label: 'Active Orders', value: stats.active_orders, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    { icon: <FiCheckCircle />, label: 'Completed', value: stats.completed_orders, color: '#84C225', bg: 'rgba(132,194,37,0.15)' },
    { icon: <FiClock />, label: 'Pending', value: stats.pending_orders, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    { icon: <FiUsers />, label: 'Total Users', value: stats.total_users, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
    { icon: <FiUserCheck />, label: 'Total Tutors', value: stats.total_tutors, color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
    { icon: <FiAlertTriangle />, label: 'Flagged Messages', value: stats.flagged_messages, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  ];

  return (
    <div>
      <div className="page-header"><h2>Admin Dashboard</h2><p>Overview of your platform</p></div>
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {stats.monthly_revenue?.length > 0 && (
        <div className="card mb-3">
          <h3 style={{ marginBottom: 20 }}>Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.monthly_revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Recent Orders</h3>
        <div className="table-container">
          <table>
            <thead><tr><th>ID</th><th>User</th><th>Course</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {stats.recent_orders?.map(o => (
                <tr key={o.id}>
                  <td>#{o.id}</td><td>{o.username}</td><td>{o.course_name}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>${parseFloat(o.total_price).toFixed(2)}</td>
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
