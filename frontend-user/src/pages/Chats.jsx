import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserOrders, getUnreadPerOrder } from '../services/api';
import { FiMessageSquare } from 'react-icons/fi';

export default function Chats() {
  const [orders, setOrders] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getUserOrders(),
      getUnreadPerOrder()
    ]).then(([ordersRes, unreadRes]) => {
      const chatOrders = ordersRes.data.filter(o => o.status === 'active' || o.status === 'in_progress');
      setOrders(chatOrders);
      setUnreadMap(unreadRes.data || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>💬 Chats</h2>
        <p className="subtitle">Message your tutors about your active orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <p style={{ color: 'var(--text-muted)' }}>No active orders with chat available yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {orders.map(order => (
            <Link to={`/chat/${order.id}`} key={order.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', textDecoration: 'none', color: 'inherit', transition: 'all 0.2s', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = ''}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: 'rgba(132, 194, 37, 0.1)', borderRadius: '50%', width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <FiMessageSquare size={20} style={{ color: 'var(--accent)' }} />
                  {unreadMap[order.id] > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--error)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite', border: '2px solid #fff' }}>{unreadMap[order.id]}</span>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Order #{order.id} — {order.course_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{order.subject_name || 'N/A'} • <span style={{ textTransform: 'capitalize' }}>{order.status}</span></div>
                </div>
              </div>
              <div className="btn btn-sm btn-primary" style={{ pointerEvents: 'none' }}>Open Chat</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
