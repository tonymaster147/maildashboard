// NotificationPanel (staff) — dark-themed dropdown feed for the floating
// bell. Covers new orders, payments, issues, flagged messages, credential
// updates, student file uploads, tutor status changes, and support chat.
// Live items arrive via the 'staffNotification' socket event (Layout owns
// the socket + state; this component just renders).

import { useNavigate } from 'react-router-dom';
import {
  FiShoppingBag, FiDollarSign, FiAlertCircle, FiMessageSquare, FiFlag,
  FiKey, FiFileText, FiRefreshCw, FiBell, FiCheck, FiCheckCircle,
} from 'react-icons/fi';

const TYPE_META = {
  new_order:        { icon: FiShoppingBag,   color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)' },
  payment_received: { icon: FiDollarSign,    color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)' },
  issue_created:    { icon: FiAlertCircle,   color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)' },
  issue_reply:      { icon: FiMessageSquare, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  flagged_message:  { icon: FiFlag,          color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)' },
  login_updated:    { icon: FiKey,           color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
  file_uploaded:    { icon: FiFileText,      color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
  order_update:     { icon: FiRefreshCw,     color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
  task_completed:   { icon: FiCheckCircle,   color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)' },
  chat_message:     { icon: FiMessageSquare, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
};
const metaFor = (type) => TYPE_META[type] || { icon: FiBell, color: 'var(--text-muted)', bg: 'rgba(127,127,127,0.15)' };

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 7 * 86400) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function targetFor(n) {
  if (n.reference_type === 'order' && n.reference_id) return `/orders/${n.reference_id}`;
  if (n.reference_type === 'issue' && n.reference_id) return `/issues/${n.reference_id}`;
  if (n.reference_type === 'chat_monitor' && n.reference_id) return `/chats/${n.reference_id}`;
  if (n.reference_type === 'chat_support' && n.reference_id) return `/chats/${n.reference_id}`;
  return null;
}

export default function NotificationPanel({
  notifications, loading, onItemRead, onMarkAllRead, onClose, isSalesUser, anchorRect,
}) {
  const navigate = useNavigate();
  const unread = notifications.filter(n => !n.is_read).length;

  const handleClick = (n) => {
    if (!n.is_read) onItemRead?.(n.id);
    onClose?.();
    let to = targetFor(n);
    // Sales users chat from /sales-chat instead of the monitor view
    if (isSalesUser && (n.reference_type === 'chat_support')) to = '/sales-chat';
    if (to) navigate(to);
  };

  // Anchored to the sidebar bell: fly out to the right of it (fixed, so the
  // sidebar's own overflow can't clip it). Fallback: dropdown below-right.
  const posStyle = anchorRect
    ? { position: 'fixed', top: Math.max(10, anchorRect.top - 6), left: anchorRect.right + 14 }
    : { position: 'absolute', top: 'calc(100% + 10px)', right: 0 };

  return (
    <div style={{
      ...posStyle,
      width: 380, maxWidth: 'calc(100vw - 32px)',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, boxShadow: '0 18px 48px rgba(0, 0, 0, 0.5)',
      zIndex: 300, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--text-primary)' }}>
          NOTIFICATIONS
        </span>
        {unread > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(248, 113, 113, 0.18)', color: '#f87171',
          }}>
            {unread} new
          </span>
        )}
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, color: 'var(--accent)', padding: '4px 6px',
              letterSpacing: 0.3,
            }}
          >
            <FiCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ maxHeight: 440, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '34px 20px', textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
            }}>
              <FiBell size={18} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              You're all caught up
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Orders, payments, issues, and chats show up here.
            </div>
          </div>
        ) : (
          notifications.map(n => {
            const meta = metaFor(n.type);
            const isUnread = !n.is_read;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 11,
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '11px 14px',
                  background: isUnread ? 'rgba(96, 165, 250, 0.07)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isUnread ? 'rgba(96, 165, 250, 0.07)' : 'transparent'; }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: meta.bg, color: meta.color,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>
                  <meta.icon size={14} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 13, lineHeight: 1.45,
                    color: 'var(--text-primary)', fontWeight: isUnread ? 700 : 500,
                    whiteSpace: 'normal',
                  }}>
                    {n.message}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {timeAgo(n.created_at)}
                  </span>
                </span>
                {isUnread && (
                  <span aria-hidden style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#60a5fa',
                    flexShrink: 0, marginTop: 6,
                  }} />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
