import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserOrders } from '../services/api';
import { FiTrendingUp, FiClock, FiCheckCircle, FiPlus, FiArrowRight } from 'react-icons/fi';

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserOrders().then(res => {
      setOrders(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const activeOrders = orders.filter(o => ['active', 'in_progress'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'completed');
  const pendingOrders = orders.filter(o => o.status === 'pending');

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back! Here's an overview of your projects.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--info)' }}>
            <FiTrendingUp />
          </div>
          <div className="stat-value">{activeOrders.length}</div>
          <div className="stat-label">Active Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
            <FiClock />
          </div>
          <div className="stat-value">{pendingOrders.length}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)' }}>
            <FiCheckCircle />
          </div>
          <div className="stat-value">{completedOrders.length}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/new-order'}>
          <div className="stat-icon" style={{ background: 'rgba(132, 194, 37, 0.15)', color: 'var(--accent)' }}>
            <FiPlus />
          </div>
          <div className="stat-value" style={{ fontSize: 20 }}>New Order</div>
          <div className="stat-label">Start a new project</div>
        </div>
      </div>

      {activeOrders.length > 0 && (
        <div className="card mb-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3>Active Projects</h3>
            <Link to="/orders" className="btn btn-sm btn-secondary">View All <FiArrowRight size={14} /></Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Course</th>
                  <th>Subject</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.slice(0, 5).map(order => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.course_name}</td>
                    <td>{order.subject_name}</td>
                    <td>{order.plan_name || order.order_type_name || '—'}</td>
                    <td><span className={`badge-status badge-${order.status}`}>{order.status}</span></td>
                    <td>
                      <Link to={`/orders/${order.id}`} className="btn btn-sm btn-outline">Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="card text-center" style={{ padding: '60px 40px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📝</div>
          <h3 style={{ marginBottom: 8 }}>No orders yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Start your first project today!</p>
          <Link to="/new-order" className="btn btn-primary btn-lg"><FiPlus size={18} /> Create First Order</Link>
        </div>
      )}
    </div>
  );
}
