import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiClock, FiChevronDown, FiUser, FiHeadphones, FiArrowRight } from 'react-icons/fi';
import { C } from '../../theme/tokens';
import Card from './Card';
import Pill from './Pill';
import Avatar, { initialsFrom } from './Avatar';
import Stars from './Stars';

// Resolve a relative `/uploads/...` URL against the API origin so the <img>
// loads from the backend. Absolute URLs pass through unchanged.
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const resolvePhoto = (u) => (!u ? null : (u.startsWith('http') ? u : `${API_ORIGIN}${u}`));

// Map status code → pill color (default green for In Progress).
// Falls back to a neutral gray if unknown — admins control codes in the DB.
const STATUS_STYLE = {
  in_progress:     { bg: C.greenSoft,  color: C.green },
  active:          { bg: C.greenSoft,  color: C.green },
  work_stopped:    { bg: C.redSoft,    color: C.red },
  pending:         { bg: C.orangeSoft, color: C.orangeText },
  completed:       { bg: C.accentSoft, color: C.accent },
  cancelled:       { bg: '#eef2f7',    color: C.textMuted },
  incomplete:      { bg: C.orangeSoft, color: C.orangeText },
};
const statusStyleFor = (code) => STATUS_STYLE[code] || { bg: '#eef2f7', color: C.textSecondary };

// Single active order row used on Dashboard + Orders list.
// Props:
//   order      — backend order object (includes admin_status_*, tutor_status_*, tutor_names…)
//   detailHref — optional URL; when set, order ID + title wrap in a Link so the
//                whole left column navigates to the order detail page.
export default function ActiveOrderCard({ order, detailHref }) {
  const id = order.order_code || `#${order.id}`;
  const title = (order.course_name || order.subject_name || order.order_type_name || 'Order').toUpperCase();
  const partial = order.payment_type === 'partial' && parseFloat(order.amount_remaining || 0) > 0;

  // Prefer tutor status (in-progress / work-stopped / completed) since that's
  // what the student cares about. Fall back to admin status.
  const statusCode = order.tutor_status_code || order.admin_status_code || order.status;
  const statusName = order.tutor_status_name || order.admin_status_name || order.status || '—';
  const statusStyle = statusStyleFor(statusCode);

  const dueDate = order.end_date ? new Date(order.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  // Parallel arrays (split with same comma separator backend used for both
  // GROUP_CONCAT results). Filter Boolean on names for count; photo can be
  // empty for tutors that haven't uploaded one — that's fine, Avatar falls
  // back to initials in that case.
  const tutorNames   = (order.tutor_names   || '').split(',').map(s => s.trim()).filter(Boolean);
  const tutorPhotos  = (order.tutor_photos  || '').split(',').map(s => s.trim());
  const tutorRatings = (order.tutor_ratings || '').split(',').map(s => s.trim());
  const firstTutor   = tutorNames[0] || null;
  const tutorCount   = tutorNames.length;
  const firstPhoto   = resolvePhoto(tutorPhotos[0]);
  const firstRating  = tutorRatings.find(r => r) || null;

  // CTA — when chat is enabled and there's a tutor, show a dropdown so the
  // student can pick Tutor vs Support. Otherwise it's a plain View Details.
  const chatEnabled = !!order.chat_enabled;
  const hasTutor = tutorCount > 0;
  const showChatDropdown = chatEnabled && hasTutor;

  // The order-info column is optionally wrapped in a Link so the whole
  // left column navigates to the detail page (used on the Orders list).
  const InfoWrap = detailHref ? Link : 'div';
  const infoWrapProps = detailHref
    ? { to: detailHref, style: { textDecoration: 'none', color: 'inherit', minWidth: 0 } }
    : { style: { minWidth: 0 } };

  return (
    <Card style={{ padding: 16 }}>
      <div className="v2-order-grid">
        {/* Order info */}
        <InfoWrap {...infoWrapProps}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3 }}>
            ORDER ID:{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace', color: C.textSecondary, fontWeight: 700 }}>{id}</span>
            {partial && (
              <span style={{
                marginLeft: 8, fontSize: 9, fontWeight: 700, color: '#fff',
                background: C.orange, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3,
              }}>
                PARTIAL
              </span>
            )}
          </div>
          <div style={{
            fontSize: 16, fontWeight: 800, color: C.textPrimary, marginTop: 4,
            textTransform: 'uppercase', letterSpacing: 0.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </div>
        </InfoWrap>

        {/* Status — truncate inside the column when admin uses a long status
            name like "Paid - Full (Not Assigned)". Full text in tooltip. */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>STATUS</div>
          <Pill bg={statusStyle.bg} color={statusStyle.color} truncate title={statusName}>{statusName}</Pill>
          {dueDate && (
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6, letterSpacing: 0.3 }}>
              <FiClock size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              Due {dueDate}
            </div>
          )}
        </div>

        {/* Tutor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {firstTutor ? (
            <>
              <Avatar initials={initialsFrom(firstTutor)} size={36} bg={C.indigoSoft} color={C.indigo} photo={firstPhoto} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5 }}>
                  ASSIGNED TUTOR{tutorCount > 1 ? ` (+${tutorCount - 1})` : ''}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: C.textPrimary,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {firstTutor}
                </div>
                <Stars value={firstRating} size={11} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: C.textMuted }}>Tutor not assigned yet</div>
          )}
        </div>

        {/* CTA — message dropdown + arrow shortcut to the order detail page */}
        {showChatDropdown ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MessageDropdown orderId={order.id} />
            </div>
            <Link
              to={`/orders/${order.id}`}
              title="View order details"
              aria-label="View order details"
              className="v2-order-arrow"
              style={{
                width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                background: C.accentSoft, color: C.accent,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none', transition: C.transitionFast,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.accentSoft; e.currentTarget.style.color = C.accent; }}
            >
              <FiArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <Link to={`/orders/${order.id}`} className="v2-order-cta" style={{
            background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
            padding: '11px 18px', fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
            cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'center', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            VIEW DETAILS
          </Link>
        )}
      </div>
    </Card>
  );
}

// Button-styled dropdown with two routes (tutor + support chat). Keeps the
// same v2 accent-blue look as the legacy single-button CTA, just adds a
// chevron and a small menu below.
function MessageDropdown({ orderId }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="v2-order-cta"
        style={{
          background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
          padding: '11px 14px 11px 18px', fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
          cursor: 'pointer', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%',
        }}
      >
        MESSAGE <FiChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            minWidth: '100%',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: C.shadowLg,
            padding: 6,
            zIndex: 50,
          }}
        >
          <MenuItem
            to={`/chat/tutor/${orderId}`}
            icon={FiUser}
            color={C.indigo}
            bg={C.indigoSoft}
            onClick={() => setOpen(false)}
          >
            Message Tutor
          </MenuItem>
          <MenuItem
            to={`/chat/support/${orderId}`}
            icon={FiHeadphones}
            color={C.green}
            bg={C.greenSoft}
            onClick={() => setOpen(false)}
          >
            Message Support
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ to, icon: Icon, color, bg, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 7,
        textDecoration: 'none', color: C.textPrimary,
        fontSize: 12, fontWeight: 600,
        transition: C.transitionFast,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        width: 26, height: 26, borderRadius: 6,
        background: bg, color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={13} />
      </span>
      {children}
    </Link>
  );
}
