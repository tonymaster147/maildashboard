import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserOrders } from '../services/api';
import { FiEye, FiMessageSquare } from 'react-icons/fi';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getUserOrders(filter).then(res => {
      setOrders(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filter]);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>My Orders</h2>
        <p>View and manage all your orders</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['', 'active', 'in_progress', 'pending', 'completed', 'cancelled'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h3 style={{ marginBottom: 8 }}>No orders found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            {filter ? 'No orders with this status' : 'You haven\'t placed any orders yet'}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Course</th>
                <th>Type</th>
                <th>Subject</th>
                <th>Plan</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td style={{ fontWeight: 500 }}>{order.course_name}</td>
                  <td>{order.order_type_name}</td>
                  <td>{order.subject_name}</td>
                  <td>{order.plan_name}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>${parseFloat(order.total_price).toFixed(2)}</td>
                  <td><span className={`badge-status badge-${order.status}`}>{order.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(order.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/orders/${order.id}`} className="btn btn-sm btn-outline"><FiEye size={14} /></Link>
                      {order.chat_enabled && <Link to={`/chat/${order.id}`} className="btn btn-sm btn-secondary"><FiMessageSquare size={14} /></Link>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
