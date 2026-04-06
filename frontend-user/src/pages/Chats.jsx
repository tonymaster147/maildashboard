import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserOrders, getUnreadPerOrder, markAllRead } from '../services/api';
import { FiUser, FiHeadphones } from 'react-icons/fi';

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
      markAllRead().catch(() => {});
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>💬 Chats</h2>
        <p className="subtitle">Message your tutor or support team about your orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <p style={{ color: 'var(--text-muted)' }}>No active orders with chat available yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {orders.map(order => {
            const unread = unreadMap[order.id] || {};
            const tutorUnread = unread.tutor || 0;
            const supportUnread = unread.support || 0;

            return (
              <div key={order.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                    Order #{order.id} — {order.course_name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {order.subject_name || 'N/A'} • <span style={{ textTransform: 'capitalize' }}>{order.status}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  {/* Tutor Chat Button */}
                  <Link
                    to={`/chat/tutor/${order.id}`}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8, textDecoration: 'none',
                      background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)',
                      color: 'var(--text-primary)', transition: 'all 0.2s', position: 'relative'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'; }}
                  >
                    <div style={{ background: 'rgba(99, 102, 241, 0.15)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FiUser size={16} style={{ color: '#6366f1' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Tutor Chat</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Talk to your tutor</div>
                    </div>
                    {tutorUnread > 0 && (
                      <span style={{ position: 'absolute', top: -6, right: -6, background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', animation: 'pulse 2s infinite' }}>{tutorUnread}</span>
                    )}
                  </Link>

                  {/* Support Chat Button */}
                  <Link
                    to={`/chat/support/${order.id}`}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8, textDecoration: 'none',
                      background: 'rgba(132, 194, 37, 0.08)', border: '1px solid rgba(132, 194, 37, 0.2)',
                      color: 'var(--text-primary)', transition: 'all 0.2s', position: 'relative'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#84c225'; e.currentTarget.style.background = 'rgba(132, 194, 37, 0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(132, 194, 37, 0.2)'; e.currentTarget.style.background = 'rgba(132, 194, 37, 0.08)'; }}
                  >
                    <div style={{ background: 'rgba(132, 194, 37, 0.15)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FiHeadphones size={16} style={{ color: '#84c225' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Support Chat</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Talk to support team</div>
                    </div>
                    {supportUnread > 0 && (
                      <span style={{ position: 'absolute', top: -6, right: -6, background: '#84c225', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', animation: 'pulse 2s infinite' }}>{supportUnread}</span>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
