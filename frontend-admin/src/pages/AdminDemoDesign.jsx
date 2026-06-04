// Static design-preview page for the proposed user-dashboard redesign.
// Mounted at /admin-demo-design (outside the protected Layout). Pure mock
// data, no API calls. Inline styles so it doesn't fight the existing dark
// admin theme.

import { useState, useEffect, useRef } from 'react';
import {
  FiBriefcase, FiCheckCircle, FiStar, FiCalendar, FiSearch, FiBell, FiMessageSquare,
  FiBookOpen, FiFileText, FiCheckSquare, FiEdit3, FiRefreshCw, FiUpload, FiFolder, FiBarChart2,
  FiUsers, FiUserPlus, FiHeart, FiHeadphones,
  FiTrendingUp, FiPieChart, FiClock, FiCreditCard, FiDollarSign, FiUser, FiSettings, FiShield,
  FiPlus, FiArrowUpRight, FiAlertCircle, FiGift, FiAward, FiLifeBuoy,
  FiChevronDown, FiLogOut, FiHelpCircle, FiMoon
} from 'react-icons/fi';

// ──────────────────────────── Theme tokens ────────────────────────────
const C = {
  bg: '#f5f7fa',
  surface: '#ffffff',
  border: '#e5e9f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  accent: '#22c55e',
  accentDark: '#16a34a',
  accentSoft: '#dcfce7',
  warn: '#f59e0b',
  warnSoft: '#fef3c7',
  danger: '#ef4444',
  info: '#6366f1',
  purple: '#a855f7',
  pink: '#ec4899'
};

// ──────────────────────────── Reusable bits ────────────────────────────
const Card = ({ children, style }) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
    padding: 20, ...style
  }}>{children}</div>
);

const Pill = ({ children, color = C.accent, bg = C.accentSoft, style }) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
    background: bg, color, letterSpacing: 0.2, ...style
  }}>{children}</span>
);

const NavGroup = ({ title, items, defaultActive }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, padding: '0 14px', marginBottom: 8 }}>
      {title}
    </div>
    {items.map((it, idx) => {
      const active = defaultActive === it.label;
      return (
        <div key={idx} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 14px', margin: '2px 8px', borderRadius: 8,
          color: active ? C.textPrimary : C.textSecondary,
          background: active ? '#eef2f7' : 'transparent',
          fontSize: 14, fontWeight: active ? 600 : 500, cursor: 'default'
        }}>
          <it.icon size={16} />
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.count != null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, background: '#eef2f7', padding: '2px 7px', borderRadius: 10 }}>
              {it.count}
            </span>
          )}
        </div>
      );
    })}
  </div>
);

// ──────────────────────────── Sidebar ────────────────────────────
function Sidebar() {
  return (
    <aside style={{
      width: 260, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`,
      height: '100vh', position: 'sticky', top: 0, overflowY: 'auto', padding: '20px 0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #84c225 0%, #16a34a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FiBookOpen size={18} color="#fff" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>BuyOnlineClass</div>
      </div>

      <NavGroup title="DASHBOARD" defaultActive="Overview" items={[
        { label: 'Overview', icon: FiBarChart2 }
      ]} />
      <NavGroup title="ORDERS" items={[
        { label: 'Active Orders', icon: FiBriefcase, count: 3 },
        { label: 'Completed Orders', icon: FiCheckSquare },
        { label: 'Drafts', icon: FiFileText },
        { label: 'Revisions', icon: FiRefreshCw }
      ]} />
      <NavGroup title="ASSIGNMENTS" items={[
        { label: 'My Submissions', icon: FiFolder },
        { label: 'Feedback & Reports', icon: FiBarChart2 }
      ]} />
      <NavGroup title="TUTORS" items={[
        { label: 'My Tutors', icon: FiUsers },
        { label: 'Find New Tutor', icon: FiUserPlus },
        { label: 'Tutor Ratings', icon: FiStar }
      ]} />
      <NavGroup title="MESSAGES" items={[
        { label: 'Chat with Tutors', icon: FiMessageSquare },
        { label: 'Support Chat', icon: FiHeadphones, count: 1 },
        { label: 'Issues', icon: FiAlertCircle, count: 2 }
      ]} />
      <NavGroup title="PERFORMANCE" items={[
        { label: 'Progress Analytics', icon: FiBarChart2 },
        { label: 'Deadlines Tracker', icon: FiClock }
      ]} />
      <NavGroup title="BILLING" items={[
        { label: 'Payment History', icon: FiCreditCard },
        { label: 'Invoices', icon: FiFileText }
      ]} />
      <NavGroup title="SETTINGS" items={[
        { label: 'Profile', icon: FiUser },
        { label: 'Notifications', icon: FiBell }
      ]} />
    </aside>
  );
}

// ──────────────────────────── Topbar ────────────────────────────
function Topbar() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 20, padding: '16px 28px',
      background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 10
    }}>
      <div style={{ flex: 1, maxWidth: 520, position: 'relative' }}>
        <FiSearch size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
        <input
          placeholder="Search orders, tutors, subjects…"
          style={{
            width: '100%', padding: '11px 14px 11px 40px', borderRadius: 10,
            border: `1px solid ${C.border}`, background: '#f8fafc', fontSize: 14, outline: 'none', color: C.textPrimary
          }}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: C.textMuted, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 6px' }}>⌘K</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'linear-gradient(135deg, #84c225 0%, #16a34a 100%)',
          color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(22,163,74,0.25)'
        }}>
          <FiLifeBuoy size={15} /> Get Help 24/7
        </button>
        <IconButton icon={FiBell} badge={3} />
        <IconButton icon={FiMessageSquare} badge={2} />
        <ProfileMenu />
      </div>
    </header>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const items = [
    { icon: FiUser,       label: 'Profile',       sub: 'Personal details' },
    { icon: FiBell,       label: 'Notifications', sub: '3 unread',         badge: 3 },
    { icon: FiSettings,   label: 'Account Settings' },
    { icon: FiHelpCircle, label: 'Help Center' }
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: open ? '#f1f5f9' : 'transparent',
          border: 'none', padding: '6px 10px 6px 6px', borderRadius: 10,
          cursor: 'pointer'
        }}
      >
        <Avatar initials="AM" size={36} />
        <div style={{ lineHeight: 1.2, textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: C.textMuted }}>Welcome back,</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>Alex Morgan</div>
        </div>
        <FiChevronDown size={14} color={C.textMuted} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 280, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: '0 12px 36px rgba(15, 23, 42, 0.12)',
          padding: 8, zIndex: 100, overflow: 'hidden'
        }}>
          {/* Header card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: 12, marginBottom: 6, borderRadius: 10, background: '#f8fafc'
          }}>
            <Avatar initials="AM" size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Alex Morgan</div>
              <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>alex.morgan@example.com</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Member since Jan 2025</div>
            </div>
          </div>

          {items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, color: C.textPrimary
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <it.icon size={16} color={C.textSecondary} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{it.label}</div>
                {it.sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{it.sub}</div>}
              </div>
              {it.badge != null && (
                <span style={{ background: C.danger, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>{it.badge}</span>
              )}
              {it.toggle && (
                <span style={{ width: 30, height: 18, borderRadius: 999, background: '#e5e9f0', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
                </span>
              )}
            </div>
          ))}

          <div style={{ height: 1, background: C.border, margin: '6px 4px' }} />

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, color: C.danger, fontWeight: 600
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <FiLogOut size={16} />
            <span>Log Out</span>
          </div>
        </div>
      )}
    </div>
  );
}

const IconButton = ({ icon: Icon, badge }) => (
  <div style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
    <Icon size={17} color={C.textSecondary} />
    {badge != null && (
      <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: C.danger, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{badge}</span>
    )}
  </div>
);

const Avatar = ({ initials, size = 32, color = '#fff', bg }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: bg || 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color, fontSize: size * 0.38, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>{initials}</div>
);

// ──────────────────────────── Welcome banner ────────────────────────────
function Welcome() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #84c225 0%, #16a34a 100%)',
      borderRadius: 16, padding: '28px 32px', color: '#fff', marginBottom: 24,
      display: 'flex', alignItems: 'center', gap: 20
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Good morning, Alex! 👋</div>
        <div style={{ fontSize: 14, opacity: 0.92 }}>Here's what's happening with your academic journey today.</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.18)', padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, backdropFilter: 'blur(4px)' }}>
        <FiCalendar size={14} /> Monday, April 14, 2025
      </div>
    </div>
  );
}

// ──────────────────────────── KPI cards ────────────────────────────
function KpiRow() {
  // All four KPIs derive from data we already have in the DB
  const kpis = [
    { icon: FiBriefcase,   label: 'Active Orders',       value: 3,       link: 'View all active orders', iconBg: '#dbeafe', iconColor: '#2563eb' },
    { icon: FiAlertCircle, label: 'Open Issues',         value: 2,       link: 'View all issues',        iconBg: '#fee2e2', iconColor: '#dc2626' },
    { icon: FiCalendar,    label: 'Upcoming Deadlines',  value: 4,       link: 'View all deadlines',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
    { icon: FiDollarSign,  label: 'Outstanding Balance', value: '$380',  link: 'View installment plan',  iconBg: '#fef3c7', iconColor: '#d97706' }
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
      {kpis.map((k, i) => (
        <Card key={i} style={{ padding: 18 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: k.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <k.icon size={18} color={k.iconColor} />
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>{k.value}</div>
          <a style={{ fontSize: 11, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{k.link} <FiArrowUpRight size={11} /></a>
        </Card>
      ))}
    </div>
  );
}

// ──────────────────────────── Academic progress timeline ────────────────────────────
function AcademicProgress() {
  const milestones = [
    { date: 'Jan 15', label: 'Semester Start', state: 'done' },
    { date: 'Mar 10', label: 'Mid Term', state: 'done' },
    { date: 'Apr 28', label: 'Almost There', state: 'current' },
    { date: 'May 30', label: 'Semester End', state: 'upcoming' }
  ];
  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Academic Progress &mdash; Spring 2025</div>
        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: C.accentDark }}>75% Complete</div>
      </div>
      <div style={{ position: 'relative', height: 6, background: '#eef2f7', borderRadius: 3, marginBottom: 18 }}>
        <div style={{ position: 'absolute', inset: 0, width: '75%', background: 'linear-gradient(90deg, #84c225, #16a34a)', borderRadius: 3 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {milestones.map((m, i) => (
          <div key={i} style={{ textAlign: 'left' }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%', marginBottom: 8,
              background: m.state === 'done' ? '#0f172a' : m.state === 'current' ? '#fff' : '#e5e9f0',
              border: m.state === 'current' ? '4px solid #0f172a' : 'none'
            }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{m.date}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ──────────────────────────── Active orders ────────────────────────────
function ActiveOrders() {
  const orders = [
    { id: 'MMT1203', name: 'History Essay Draft', subject: 'History',     status: 'Paid - Full (Assigned)',    statusBg: '#dcfce7', statusColor: '#16a34a', deadline: 'Apr 12, 2025', time: '12:00 PM', tutor: 'Jonathan S.',  tutorInitials: 'JS', tutorBg: '#fee2e2', tutorColor: '#dc2626', cta: 'Message',  partial: false },
    { id: 'MMT1204', name: 'Math Exam + 2 Draft',   subject: 'Mathematics', status: 'Paid - Partial (Assigned)', statusBg: '#fef3c7', statusColor: '#b45309', deadline: 'Apr 18, 2025', time: '12:00 PM', tutor: 'Jonathan Bran', tutorInitials: 'JB', tutorBg: '#dcfce7', tutorColor: '#16a34a', cta: 'View Draft', partial: true, remaining: 380 },
    { id: 'MMT1205', name: 'History Essay Draft',   subject: 'History',     status: 'Paid - Full (Assigned)',    statusBg: '#dcfce7', statusColor: '#16a34a', deadline: 'Apr 25, 2025', time: '12:00 PM', tutor: 'Jonathan Bran', tutorInitials: 'JB', tutorBg: '#dcfce7', tutorColor: '#16a34a', cta: 'Message',  partial: false }
  ];
  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Active Orders</div>
        <a style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>View all orders <FiArrowUpRight size={11} /></a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select label="All Statuses" />
        <Select label="All Subjects" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
          {['All', 'Unpaid', 'Not Assigned', 'Assigned', 'Completed', 'Cancelled'].map(t => (
            <div key={t} style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, whiteSpace: 'nowrap',
              background: t === 'All' ? '#fff' : 'transparent', color: t === 'All' ? C.textPrimary : C.textSecondary,
              boxShadow: t === 'All' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.4fr 1fr', padding: '12px 4px', fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5 }}>
          <div>ORDER</div><div>SUBJECT</div><div>STATUS</div><div>DEADLINE</div><div>TUTOR</div><div>ACTION</div>
        </div>
        {orders.map((o, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.4fr 1fr', padding: '14px 4px', alignItems: 'center', borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FiFileText size={16} color="#b45309" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, fontFamily: 'ui-monospace, monospace' }}>{o.id}</span>
                  {o.partial && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: '#f59e0b', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3 }}>PARTIAL</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</div>
              </div>
            </div>
            <div style={{ fontSize: 13 }}>{o.subject}</div>
            <div><Pill bg={o.statusBg} color={o.statusColor}>{o.status}</Pill></div>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary }}>{o.deadline}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{o.time}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar initials={o.tutorInitials} size={30} bg={o.tutorBg} color={o.tutorColor} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.tutor}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>Tutor</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textPrimary, cursor: 'pointer' }}>{o.cta}</button>
              <button style={{ padding: '6px 8px', fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textMuted, cursor: 'pointer' }}>•••</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 4px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, color: C.textMuted }}>Showing 1 to 3 of 3 orders</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer' }}>&lsaquo;</button>
          <button style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.textPrimary}`, background: C.textPrimary, color: '#fff', cursor: 'pointer' }}>1</button>
          <button style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer' }}>&rsaquo;</button>
        </div>
      </div>
    </Card>
  );
}

const Select = ({ label, hint }) => (
  <div
    title={hint}
    style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 6, color: C.textSecondary }}
  >
    {label} <span style={{ fontSize: 9 }}>▾</span>
  </div>
);

// ──────────────────────────── Performance overview ────────────────────────────
function PerformanceOverview() {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Performance Overview</div>
        <div style={{ marginLeft: 'auto' }}><Select label="This Semester" /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 200px', gap: 24, alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: 16, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Overall Grade</div>
          <div style={{ fontSize: 60, fontWeight: 800, color: C.textPrimary, lineHeight: 1 }}>A-</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>3.7 / 4.0</div>
        </div>
        <LineChart />
        <div>
          <DonutChart />
          <div style={{ fontSize: 11, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <LegendItem dot="#0f172a" label="History" value="35%" />
            <LegendItem dot="#3b82f6" label="Math" value="30%" />
            <LegendItem dot="#f59e0b" label="Science" value="20%" />
            <LegendItem dot="#a855f7" label="Other" value="15%" />
          </div>
        </div>
      </div>
    </Card>
  );
}

const LegendItem = ({ dot, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
    <span style={{ flex: 1, color: C.textSecondary }}>{label}</span>
    <span style={{ fontWeight: 700, color: C.textPrimary }}>{value}</span>
  </div>
);

function LineChart() {
  // Hand-built SVG so we don't drag in a chart library for a demo.
  const points = [[0, 78], [80, 70], [160, 56], [240, 24], [320, 18]];
  const path = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
  const fill = `${path} L 320 100 L 0 100 Z`;
  return (
    <svg viewBox="-30 -10 360 130" style={{ width: '100%', height: 160 }}>
      <defs>
        <linearGradient id="lcg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#84c225" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#84c225" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map(y => (
        <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#eef2f7" strokeDasharray="2 4" />
      ))}
      <path d={fill} fill="url(#lcg)" />
      <path d={path} stroke="#16a34a" strokeWidth="2.5" fill="none" />
      {points.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#16a34a" />)}
      {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((m, i) => (
        <text key={m} x={i * 80} y="120" fontSize="9" textAnchor="middle" fill="#94a3b8" fontFamily="Inter">{m}</text>
      ))}
      {[1, 2, 3, 4].map((v, i) => (
        <text key={v} x="-6" y={100 - i * 25 + 3} fontSize="9" textAnchor="end" fill="#94a3b8" fontFamily="Inter">{v}.0</text>
      ))}
    </svg>
  );
}

function DonutChart() {
  // 35 / 30 / 20 / 15
  const data = [
    { v: 35, color: '#0f172a' }, { v: 30, color: '#3b82f6' },
    { v: 20, color: '#f59e0b' }, { v: 15, color: '#a855f7' }
  ];
  const R = 38, C2 = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" style={{ width: 120, height: 120, margin: '0 auto', display: 'block' }}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="#eef2f7" strokeWidth="12" />
      {data.map((d, i) => {
        const len = (d.v / 100) * C2;
        const seg = <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={d.color} strokeWidth="12" strokeDasharray={`${len} ${C2 - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />;
        acc += len;
        return seg;
      })}
    </svg>
  );
}

// ──────────────────────────── Right column ────────────────────────────
function RightColumn() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DeadlinesCard />
      <LoginDetailsCard />
      <QuickActionsCard />
      <RecommendedCard />
    </div>
  );
}

// Surfaces the login details a user shared for their most-recent active order.
// The data already exists on `orders.school_url / school_username / school_password
// + login_updated_at` after our earlier feature.
function LoginDetailsCard() {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiShield size={15} /> Login Details
        </div>
        <Pill bg={C.accentSoft} color={C.accentDark} style={{ marginLeft: 'auto' }}>Updated Apr 8</Pill>
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>For order <span style={{ fontFamily: 'ui-monospace, monospace', color: C.textSecondary, fontWeight: 600 }}>MMT1204</span> · Math Exam + 2</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
        <Row label="URL" value="canvas.school.edu" />
        <Row label="User" value="alex.m" />
        <Row label="Pass" value="••••••••" hint="(hidden)" />
      </div>
      <a style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textMuted, marginTop: 12 }}>Manage on order <FiArrowUpRight size={11} /></a>
    </Card>
  );
}

const Row = ({ label, value, hint }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 36, color: C.textMuted, fontSize: 11, fontWeight: 600 }}>{label}</span>
    <span style={{ flex: 1, fontFamily: 'ui-monospace, monospace', color: C.textPrimary }}>{value}</span>
    {hint && <span style={{ fontSize: 10, color: C.textMuted }}>{hint}</span>}
  </div>
);

function DeadlinesCard() {
  const items = [
    { color: '#0f172a', title: 'History Essay Draft', sub: 'Draft Due', date: 'Apr 12, 2025', time: '12:00 PM', pill: '2 Days Left', pillBg: C.accentSoft, pillColor: C.accentDark },
    { color: '#f59e0b', title: 'Math Exam', sub: 'Review Due', date: 'Apr 18, 2025', time: '12:00 PM', pill: '8 Days Left', pillBg: C.warnSoft, pillColor: '#b45309' },
    { color: '#f59e0b', title: 'Final Project Draft', sub: 'Submission Due', date: 'Apr 25, 2025', time: '12:00 PM', pill: '15 Days Left', pillBg: C.warnSoft, pillColor: '#b45309' },
    { color: '#ec4899', title: 'Final Project', sub: 'Final Due', date: 'Apr 30, 2025', time: '12:00 PM', pill: '20 Days Left', pillBg: '#fce7f3', pillColor: '#be185d' }
  ];
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Upcoming Deadlines</div>
        <a style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>View calendar <FiArrowUpRight size={11} /></a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, marginTop: 6 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{d.sub}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: C.textSecondary }}>{d.date}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{d.time}</div>
              <Pill bg={d.pillBg} color={d.pillColor}>{d.pill}</Pill>
            </div>
          </div>
        ))}
      </div>
      <a style={{ display: 'block', marginTop: 14, fontSize: 11, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>View all deadlines <FiArrowUpRight size={11} /></a>
    </Card>
  );
}

function QuickActionsCard() {
  const actions = [
    { label: 'New Order', sub: 'Start a request', icon: FiPlus, bg: 'linear-gradient(135deg, #84c225, #16a34a)' },
    { label: 'Message Tutor', sub: 'Get help fast', icon: FiMessageSquare, bg: 'linear-gradient(135deg, #1e293b, #0f172a)' },
    { label: 'View Reports', sub: 'Track grades', icon: FiBarChart2, bg: 'linear-gradient(135deg, #6366f1, #4338ca)' },
    { label: 'Message Support', sub: 'Talk to our team', icon: FiHeadphones, bg: 'linear-gradient(135deg, #f59e0b, #d97706)' }
  ];
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Quick Actions</div>
        <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.6 }}>SHORTCUTS</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {actions.map((a, i) => (
          <div key={i} style={{
            background: a.bg, color: '#fff', borderRadius: 12, padding: 14, cursor: 'pointer'
          }}>
            <a.icon size={20} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>{a.sub}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecommendedCard() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #84c225 0%, #16a34a 100%)',
      borderRadius: 14, padding: 18, color: '#fff', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, marginBottom: 12, opacity: 0.95 }}>
        <FiHeart size={14} /> Recommended for You
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Need help with your next assignment?</div>
      <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 14, maxWidth: '70%' }}>Find the best tutor based on your subject.</div>
      <button style={{
        background: '#fff', color: C.textPrimary, fontSize: 12, fontWeight: 700,
        padding: '8px 14px', borderRadius: 8, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer'
      }}>Find Tutor <FiArrowUpRight size={12} /></button>
      <div style={{ position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FiUser size={26} />
      </div>
    </div>
  );
}

// ──────────────────────────── Marketing footer row ────────────────────────────
function MarketingRow() {
  const testimonials = [
    { name: 'Priya R.', initials: 'PR', avatarBg: '#dbeafe', avatarColor: '#2563eb', stars: 5, quote: '"Got an A on my history paper. Fast and thorough."', meta: 'Spring 2025 · History' },
    { name: 'Marcus L.', initials: 'ML', avatarBg: '#fce7f3', avatarColor: '#be185d', stars: 5, quote: '"Tutor explained calculus better than my professor."', meta: 'Spring 2025 · Math' }
  ];
  const blogs = [
    { tag: 'Study Tips', title: 'How to write a strong thesis statement', read: '4 min read', date: 'Apr 8' },
    { tag: 'Math', title: 'Calculus survival kit for finals week', read: '6 min read', date: 'Apr 2' },
    { tag: 'Productivity', title: 'Beat procrastination with these 5 hacks', read: '5 min read', date: 'Mar 28' }
  ];
  const services = [
    { icon: FiFileText, label: 'Essay Writing',  desc: 'Plagiarism-free, on-time delivery', color: '#2563eb', bg: '#dbeafe' },
    { icon: FiBookOpen, label: 'Online Classes', desc: 'Full semester management',          color: '#16a34a', bg: '#dcfce7' },
    { icon: FiCheckSquare, label: 'Quiz & Exam', desc: 'Live help during your test',         color: '#d97706', bg: '#fef3c7' },
    { icon: FiBarChart2, label: 'Tutoring',      desc: '1-on-1 sessions, any subject',       color: '#7c3aed', bg: '#ede9fe' }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24 }}>
      {/* Testimonials */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Testimonials</div>
          <a style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>See all <FiArrowUpRight size={11} /></a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {testimonials.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              <Avatar initials={t.initials} size={36} bg={t.avatarBg} color={t.avatarColor} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: '#d97706' }}>{'★'.repeat(t.stars)}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5, marginBottom: 3 }}>{t.quote}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{t.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Blogs */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Blogs</div>
          <a style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Read all <FiArrowUpRight size={11} /></a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {blogs.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: i < blogs.length - 1 ? 12 : 0, borderBottom: i < blogs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiFileText size={18} color={C.textMuted} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Pill bg="#eef2f7" color={C.textSecondary} style={{ marginBottom: 6 }}>{b.tag}</Pill>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.35 }}>{b.title}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{b.date} · {b.read}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Our Other Services */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Our Other Services</div>
          <a style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Explore <FiArrowUpRight size={11} /></a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {services.map((s, i) => (
            <div key={i} style={{
              border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, cursor: 'pointer',
              transition: 'all 0.15s'
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <s.icon size={15} color={s.color} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ──────────────────────────── Smart alert footer ────────────────────────────
function SmartAlert() {
  return (
    <Card style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14, borderLeft: `4px solid ${C.warn}` }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: C.warnSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FiDollarSign size={18} color="#b45309" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Installment due soon</div>
        <div style={{ fontSize: 12, color: C.textSecondary }}>Order <strong style={{ fontFamily: 'ui-monospace, monospace' }}>MMT1204</strong> has $380 remaining across 2 installments. Next payment is due <strong>Apr 18, 2025</strong>.</div>
      </div>
      <a style={{ fontSize: 12, fontWeight: 600, color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 4 }}>View Plan <FiArrowUpRight size={12} /></a>
    </Card>
  );
}

// ──────────────────────────── Page ────────────────────────────
export default function AdminDemoDesign() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: C.textPrimary }}>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          <Topbar />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, padding: 28 }}>
            <div>
              <Welcome />
              <KpiRow />
              <ActiveOrders />
              <SmartAlert />
            </div>
            <RightColumn />
          </div>
          {/* Full-width marketing row from hand-drawn architecture */}
          <div style={{ padding: '0 28px 32px' }}>
            <MarketingRow />
          </div>
        </main>
      </div>
    </div>
  );
}
