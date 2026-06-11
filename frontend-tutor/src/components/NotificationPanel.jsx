// NotificationPanel (tutor) — light-themed dropdown feed for the floating
// bell. Covers task assignments, student file uploads, credential updates,
// and chat messages. Live items arrive on the 'notification' socket event
// (tutor personal room); Layout owns socket + state.

import { useNavigate } from 'react-router-dom';
import {
  FiBookOpen, FiFileText, FiKey, FiMessageSquare, FiBell, FiCheck,
} from 'react-icons/fi';

const TYPE_META = {
  task_assigned: { icon: FiBookOpen,      color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
  file_uploaded: { icon: FiFileText,      color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)' },
  login_updated: { icon: FiKey,           color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)' },
  chat_message:  { icon: FiMessageSquare, color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
};
const metaFor = (type) => TYPE_META[type] || { icon: FiBell, color: 'var(--text-muted)', bg: 'rgba(127,127,127,0.12)' };

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
  if (n.reference_type === 'order' && n.reference_id) return `/tasks/${n.reference_id}`;
  if (n.reference_type === 'chat_tutor' && n.reference_id) return `/chat/${n.reference_id}`;
  return null;
}

export default function NotificationPanel({
  notifications, loading, onItemRead, onMarkAllRead, onClose, anchorRect,
}) {
  const navigate = useNavigate();
  const unread = notifications.filter(n => !n.is_read).length;

  const handleClick = (n) => {
    if (!n.is_read) onItemRead?.(n.id);
    onClose?.();
    const to = targetFor(n);
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
      width: 360, maxWidth: 'calc(100vw - 32px)',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, boxShadow: '0 14px 40px rgba(15, 23, 42, 0.16)',
      zIndex: 300, overflow: 'hidden',
    }}>
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
            background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444',
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
              fontSize: 11, fontWeight: 700, color: '#6366f1', padding: '4px 6px',
              letterSpacing: 0.3,
            }}
          >
            <FiCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '34px 20px', textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
            }}>
              <FiBell size={18} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              You're all caught up
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              New tasks, files, and messages show up here.
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
                  background: isUnread ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isUnread ? 'rgba(99, 102, 241, 0.06)' : 'transparent'; }}
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
                    width: 8, height: 8, borderRadius: '50%', background: '#6366f1',
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
