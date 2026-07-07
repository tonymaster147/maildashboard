import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiUser, FiHeadphones, FiMessageSquare } from 'react-icons/fi';
import { getUserOrders, getUnreadPerOrder, markAllRead } from '../services/api';
import { C } from '../theme/tokens';
import { Card, Pill } from '../components/ui';

const PER_PAGE = 100;

export default function Chats() {
  const [orders, setOrders] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(PER_PAGE);
  const sentinelRef = useRef(null);

  useEffect(() => {
    Promise.all([getUserOrders(), getUnreadPerOrder()])
      .then(([ordersRes, unreadRes]) => {
        const chatOrders = (ordersRes.data || []).filter(o => o.status === 'active' || o.status === 'in_progress');
        // Unread conversations float to the top so nothing gets missed;
        // ties keep the API's normal (newest-first) order. Sort is stable.
        const umap = unreadRes.data || {};
        const unreadTotal = (o) => ((umap[o.id]?.tutor || 0) + (umap[o.id]?.support || 0));
        chatOrders.sort((a, b) => (unreadTotal(b) > 0 ? 1 : 0) - (unreadTotal(a) > 0 ? 1 : 0));
        setOrders(chatOrders);
        setUnreadMap(umap);
        setLoading(false);
        markAllRead().catch(() => {});
      })
      .catch(() => setLoading(false));
  }, []);

  // Infinite scroll — reveal 100 more conversations as the sentinel appears.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible(v => v + PER_PAGE);
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 0.3 }}>
          Chats
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>
          Message your tutor or support team for each active order.
        </p>
      </div>

      {orders.length === 0 ? (
        <Card style={{ padding: '50px 30px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: C.accentSoft, color: C.accent,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <FiMessageSquare size={24} />
          </div>
          <h3 style={{ color: C.textPrimary, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            No active orders with chat
          </h3>
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
            Place an order — a chat channel opens once it's assigned to a tutor.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {orders.slice(0, visible).map(order => {
            const unread = unreadMap[order.id] || {};
            const tutorUnread = unread.tutor || 0;
            const supportUnread = unread.support || 0;
            return (
              <Card key={order.id} style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Pill bg="#eef2f7" color={C.textSecondary}>
                    {order.order_code || `#${order.id}`}
                  </Pill>
                  <span style={{
                    fontWeight: 700, fontSize: 14, color: C.textPrimary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>
                    {order.course_name || order.subject_name || 'Untitled order'}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>
                    <Pill
                      bg={order.status === 'in_progress' ? C.greenSoft : C.accentSoft}
                      color={order.status === 'in_progress' ? C.green : C.accent}
                    >
                      {order.status === 'in_progress' ? 'In Progress' : 'Active'}
                    </Pill>
                  </span>
                </div>

                <div className="v2-chat-channel-row">
                  <ChannelChip
                    to={`/chat/tutor/${order.id}`}
                    icon={FiUser}
                    title="Tutor Chat"
                    sub={(order.tutor_names || '').trim() ? 'Talk to your tutor' : 'Tutor not assigned yet'}
                    color={C.indigo}
                    bg={C.indigoSoft}
                    badge={tutorUnread}
                    disabled={!(order.tutor_names || '').trim()}
                  />
                  <ChannelChip
                    to={`/chat/support/${order.id}`}
                    icon={FiHeadphones}
                    title="Support Chat"
                    sub="Talk to support team"
                    color={C.green}
                    bg={C.greenSoft}
                    badge={supportUnread}
                  />
                </div>
              </Card>
            );
          })}
          {visible < orders.length && <div ref={sentinelRef} style={{ height: 1 }} />}
        </div>
      )}
    </div>
  );
}

function ChannelChip({ to, icon: Icon, title, sub, color, bg, badge, disabled }) {
  // Disabled variant — grayed out, not clickable (e.g. tutor chat before a
  // tutor has been assigned to the order).
  if (disabled) {
    return (
      <div
        title="A tutor hasn't been assigned to this order yet"
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 10,
          background: '#eef2f7', border: '1px solid #eef2f7',
          color: C.textMuted, position: 'relative',
          cursor: 'not-allowed', opacity: 0.75,
        }}
      >
        <div style={{
          background: '#fff', borderRadius: '50%', width: 38, height: 38, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} style={{ color: C.textMuted }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.textMuted, letterSpacing: 0.3 }}>{title}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{sub}</div>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={to}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 10, textDecoration: 'none',
        background: bg, border: `1px solid ${bg}`,
        color: C.textPrimary, position: 'relative',
        transition: C.transitionFast,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = bg; }}
    >
      <div style={{
        background: '#fff', borderRadius: '50%', width: 38, height: 38, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} style={{ color }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.textPrimary, letterSpacing: 0.3 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{sub}</div>
      </div>
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: color, color: '#fff', fontSize: 10, fontWeight: 700,
          borderRadius: '50%', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #fff', animation: 'pulse 2s infinite',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
