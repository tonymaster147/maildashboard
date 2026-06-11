// NotificationPanel — professional dropdown feed for the topbar bell.
//
// Shows every non-chat notification (status changes from admin/sales/tutor,
// payment received + payment reminders, files uploaded, issue replies /
// closures). Chat has its own badge on the Chat nav item, so it's excluded
// here by design.
//
// Live behavior is owned by Layout: it listens for the 'notification' socket
// event, bumps the unread badge, and passes fresh items down via props.

import { useNavigate } from 'react-router-dom';
import {
  FiRefreshCw, FiCheckCircle, FiFileText, FiMessageSquare,
  FiDollarSign, FiAlertCircle, FiBell, FiCheck, FiUserCheck,
} from 'react-icons/fi';
import { C } from '../../theme/tokens';

// Per-type icon + color chip. Unknown types fall back to a neutral bell.
const TYPE_META = {
  order_update:     { icon: FiRefreshCw,     color: C.accent,     bg: C.accentSoft },
  tutor_assigned:   { icon: FiUserCheck,     color: C.indigo,     bg: C.indigoSoft },
  task_completed:   { icon: FiCheckCircle,   color: C.green,      bg: C.greenSoft },
  file_uploaded:    { icon: FiFileText,      color: C.indigo,     bg: C.indigoSoft },
  issue_reply:      { icon: FiMessageSquare, color: C.orangeText, bg: C.orangeSoft },
  issue_closed:     { icon: FiCheckCircle,   color: C.textMuted,  bg: '#eef2f7' },
  payment_received: { icon: FiDollarSign,    color: C.green,      bg: C.greenSoft },
  payment_reminder: { icon: FiAlertCircle,   color: C.red,        bg: C.redSoft },
  installment_plan: { icon: FiDollarSign,    color: C.orangeText, bg: C.orangeSoft },
  chat_message:     { icon: FiMessageSquare, color: C.accent,     bg: C.accentSoft },
};
const metaFor = (type) => TYPE_META[type] || { icon: FiBell, color: C.textSecondary, bg: '#eef2f7' };

// Compact relative time: "just now", "5m ago", "3h ago", "2d ago", then date.
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

// Where a click takes the student, based on what the notification refers to.
function targetFor(n) {
  if (n.reference_type === 'order' && n.reference_id) return `/orders/${n.reference_id}`;
  if (n.reference_type === 'issue' && n.reference_id) return `/issues/${n.reference_id}`;
  if (n.reference_type === 'chat_tutor' && n.reference_id) return `/chat/tutor/${n.reference_id}`;
  if (n.reference_type === 'chat_support' && n.reference_id) return `/chat/support/${n.reference_id}`;
  return null;
}

export default function NotificationPanel({
  notifications, loading, onItemRead, onMarkAllRead, onClose,
}) {
  const navigate = useNavigate();
  const unread = notifications.filter(n => !n.is_read).length;

  const handleClick = (n) => {
    if (!n.is_read) onItemRead?.(n.id);
    onClose?.();
    const to = targetFor(n);
    if (to) navigate(to);
  };

  return (
    <div className="v2-popover" style={{ width: 360, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
        background: C.surface, position: 'sticky', top: 0, zIndex: 1,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textPrimary }}>
          NOTIFICATIONS
        </span>
        {unread > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: C.redSoft, color: C.red,
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
              fontSize: 11, fontWeight: 700, color: C.accent, padding: '4px 6px',
              letterSpacing: 0.3,
            }}
          >
            <FiCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '34px 20px', textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: C.accentSoft, color: C.accent,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
            }}>
              <FiBell size={18} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>
              You're all caught up
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              Order updates, payments, and replies show up here.
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
                  background: isUnread ? C.accentSoft2 || '#eff6ff' : 'transparent',
                  border: 'none', borderBottom: `1px solid ${C.border}`,
                  transition: C.transitionFast, fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isUnread ? C.accentSoft : C.surfaceHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = isUnread ? (C.accentSoft2 || '#eff6ff') : 'transparent'; }}
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
                    color: C.textPrimary, fontWeight: isUnread ? 700 : 500,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'normal',
                  }}>
                    {n.message}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                    {timeAgo(n.created_at)}
                  </span>
                </span>
                {isUnread && (
                  <span aria-hidden style={{
                    width: 8, height: 8, borderRadius: '50%', background: C.accent,
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
