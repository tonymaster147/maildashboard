// Simpler v2 demo based on Ma'am's mockup. Reduced sidebar, card-based
// active orders (instead of table), upcoming milestones rail on the right.
// Static data — mounted at /admin-demo-design-two, public, no auth.

import { useState, useEffect, useRef } from 'react';
import {
  FiShoppingCart, FiFileText, FiMessageCircle, FiSettings, FiPlusCircle, FiLifeBuoy,
  FiAlertCircle, FiCreditCard, FiHeadphones, FiUser, FiChevronRight, FiArrowUpRight,
  FiClock, FiCheckCircle, FiHelpCircle, FiBookOpen, FiBell, FiDollarSign
} from 'react-icons/fi';

// ──────────────────────────── Theme tokens ────────────────────────────
const C = {
  bg: '#f6f7fb',
  surface: '#ffffff',
  border: '#e3e7ed',
  textPrimary: '#1f2937',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  accent: '#2563eb',
  accentSoft: '#dbeafe',
  green: '#16a34a',
  greenSoft: '#dcfce7',
  orange: '#f59e0b',
  orangeSoft: '#fef3c7',
  red: '#dc2626',
  redSoft: '#fee2e2'
};

// ──────────────────────────── Helpers ────────────────────────────
const Card = ({ children, style }) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: 18, ...style
  }}>{children}</div>
);

const Pill = ({ children, bg, color }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
    background: bg, color, textTransform: 'uppercase', letterSpacing: 0.4
  }}>{children}</span>
);

const Avatar = ({ initials, size = 36, bg = '#dbeafe', color = '#2563eb', photo, ring }) => (
  photo ? (
    <img
      src={photo}
      alt={initials || 'avatar'}
      style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        flexShrink: 0,
        border: ring ? `2px solid ${ring}` : 'none',
        background: bg
      }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color,
      fontSize: size * 0.38, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      border: ring ? `2px solid ${ring}` : 'none'
    }}>{initials}</div>
  )
);

// ──────────────────────────── Sidebar (simpler) ────────────────────────────
function Sidebar() {
  // Everything in this list maps to a feature we already have.
  const items = [
    { label: 'My Active Orders', icon: FiShoppingCart, count: 3, active: true },
    { label: 'Past Assignments',  icon: FiFileText },
    { label: 'Tutor Messages',    icon: FiMessageCircle, count: 2 },
    { label: 'Support Chat',      icon: FiHeadphones, count: 1 },
    { label: 'Issues',            icon: FiAlertCircle, count: 2 },
    { label: 'Payment History',   icon: FiCreditCard },
    { label: 'Account Settings',  icon: FiSettings }
  ];

  return (
    <aside style={{
      width: 240, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`,
      minHeight: '100vh', position: 'sticky', top: 0, padding: '20px 14px',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 14px', borderRadius: 10, fontSize: 14, fontWeight: it.active ? 700 : 500,
            color: it.active ? '#fff' : C.textSecondary,
            background: it.active ? C.accent : 'transparent',
            cursor: 'default'
          }}>
            <it.icon size={17} />
            <span style={{ flex: 1, letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 12 }}>{it.label}</span>
            {it.count != null && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: it.active ? 'rgba(255,255,255,0.25)' : '#eef2f7',
                color: it.active ? '#fff' : C.textMuted
              }}>{it.count}</span>
            )}
          </div>
        ))}

        {/* Anchored right under the menu — always visible without scrolling */}
        <button style={{
          marginTop: 16, padding: '14px 16px', border: 'none', borderRadius: 10,
          background: C.red, color: '#fff', fontWeight: 700, fontSize: 13,
          letterSpacing: 0.6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 6px 14px rgba(220, 38, 38, 0.25)'
        }}>
          <FiPlusCircle size={16} /> PLACE NEW ORDER
        </button>
      </div>
    </aside>
  );
}

// ──────────────────────────── Topbar ────────────────────────────
function Topbar() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px',
      background: C.surface, borderBottom: `1px solid ${C.border}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'linear-gradient(135deg, #1f2937, #374151)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <FiBookOpen size={18} color="#fff" />
        </div>
        <span style={{ fontSize: 17, fontWeight: 600, color: C.textPrimary }}>buyonlineclass.com</span>
      </div>

      <div style={{ width: 1, height: 28, background: C.border, margin: '0 8px' }} />
      <h1 style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: 1 }}>
        STUDENT DASHBOARD
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
        {/* Notification bell — uses existing notifications table */}
        <button title="Notifications" style={{
          position: 'relative', width: 38, height: 38, borderRadius: 10,
          background: '#f1f5f9', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <FiBell size={17} color={C.textSecondary} />
          <span style={{
            position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
            background: C.red, color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
          }}>3</span>
        </button>
        <ProfileChip />
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: C.accentSoft, border: 'none', borderRadius: 10,
          padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.accent,
          cursor: 'pointer', lineHeight: 1.3, textAlign: 'left'
        }}>
          <FiLifeBuoy size={16} />
          <div>
            <div>GET HELP</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>24/7</div>
          </div>
        </button>
      </div>
    </header>
  );
}

function ProfileChip() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const items = [
    { icon: FiUser,       label: 'Profile' },
    { icon: FiAlertCircle, label: 'Notifications' },
    { icon: FiSettings,   label: 'Account Settings' },
    { icon: FiHelpCircle, label: 'Help Center' }
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: open ? '#eef2f7' : 'transparent',
          border: 'none', padding: 6, borderRadius: 8, cursor: 'pointer'
        }}
      >
        <Avatar initials="JS" size={36} />
        <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5 }}>WELCOME,</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, letterSpacing: 0.5 }}>JONATHAN S.</div>
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 240, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: '0 12px 36px rgba(15, 23, 42, 0.12)',
          padding: 6, zIndex: 100
        }}>
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
              <span style={{ flex: 1, fontWeight: 500 }}>{it.label}</span>
            </div>
          ))}
          <div style={{ height: 1, background: C.border, margin: '4px 4px' }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, color: C.red, fontWeight: 600
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >Log Out</div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── Current order progress (replaces semester) ────────────────────────────
function CurrentOrderProgress() {
  // Calendar-based timeline of the nearest active order. Driven by
  // orders.start_date and orders.end_date — fully derivable from real data.
  // Frames it as a deadline countdown, not a "work-done" meter.
  const data = {
    code: 'MMT1204',
    title: 'Math Exam + 2 Draft',
    start: 'Apr 1, 2025',
    end: 'Apr 18, 2025',
    today: 'Apr 14',
    daysRemaining: 4,
    pct: 76
  };
  const urgent = data.daysRemaining <= 3;
  return (
    <Card style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <FiClock size={13} color={C.textMuted} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1 }}>
          ORDER TIMELINE
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, letterSpacing: 0.3,
          background: urgent ? C.redSoft : C.greenSoft,
          color: urgent ? C.red : C.green
        }}>
          {data.daysRemaining} days remaining
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, letterSpacing: 0.4 }}>
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{data.code}</span>
          <span style={{ color: C.textSecondary, fontSize: 16, fontWeight: 600, marginLeft: 10 }}>{data.title}</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 12, background: '#eef2f7', borderRadius: 6, marginBottom: 10 }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: `${data.pct}%`,
          background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: 6
        }} />
        <div style={{
          position: 'absolute', top: -6, left: `calc(${data.pct}% - 12px)`,
          width: 24, height: 24, borderRadius: '50%',
          background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.12)'
        }}>
          <FiCheckCircle size={12} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 0.5 }}>
        <span>Started {data.start}</span>
        <span style={{ color: C.green }}>TODAY · {data.today.toUpperCase()}</span>
        <span>Deadline {data.end}</span>
      </div>
    </Card>
  );
}

// ──────────────────────────── Active orders (card list) ────────────────────────────
function ActiveOrders() {
  const orders = [
    {
      id: 'MMT1203', title: 'History Essay Draft',
      adminStatus: 'Paid - Full (Assigned)', tutorStatus: 'In Progress', tutorStatusColor: C.green, tutorStatusBg: C.greenSoft,
      deadline: 'Apr 12, 2025', time: '12:00 PM',
      tutor: 'Jonathan S.', initials: 'JS', avBg: '#fee2e2', avColor: '#dc2626',
      photo: 'https://i.pravatar.cc/80?img=12',
      cta: 'MESSAGE TUTOR'
    },
    {
      id: 'MMT1204', title: 'Math Exam + 2 Draft',
      adminStatus: 'Paid - Partial (Assigned)', tutorStatus: 'In Progress', tutorStatusColor: '#b45309', tutorStatusBg: C.orangeSoft,
      deadline: 'Apr 18, 2025', time: '12:00 PM',
      tutor: 'Jonathan Bran', initials: 'JB', avBg: '#dcfce7', avColor: '#16a34a',
      photo: 'https://i.pravatar.cc/80?img=33',
      cta: 'VIEW DRAFT', partial: true
    },
    {
      id: 'MMT1205', title: 'History Essay Draft',
      adminStatus: 'Paid - Full (Assigned)', tutorStatus: 'In Progress', tutorStatusColor: C.green, tutorStatusBg: C.greenSoft,
      deadline: 'Apr 25, 2025', time: '12:00 PM',
      tutor: 'Jonathan Bran', initials: 'JB', avBg: '#dcfce7', avColor: '#16a34a',
      photo: 'https://i.pravatar.cc/80?img=33',
      cta: 'MESSAGE TUTOR'
    }
  ];

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary, margin: '0 0 14px', letterSpacing: 0.5 }}>
        MY ACTIVE ORDERS
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map((o, i) => (
          <Card key={i} style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 160px minmax(0, 1.3fr) 160px', gap: 18, alignItems: 'center' }}>
              {/* Order info */}
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3 }}>
                  ORDER ID: <span style={{ fontFamily: 'ui-monospace, monospace', color: C.textSecondary, fontWeight: 700 }}>{o.id}</span>
                  {o.partial && (
                    <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, color: '#fff', background: C.orange, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3 }}>PARTIAL</span>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>{o.title}</div>
              </div>

              {/* Status — uses our real admin + tutor codes */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>STATUS</div>
                <Pill bg={o.tutorStatusBg} color={o.tutorStatusColor}>{o.tutorStatus}</Pill>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6, letterSpacing: 0.3 }}>
                  <FiClock size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  Due {o.deadline}
                </div>
              </div>

              {/* Tutor — stacked layout (label on top, name below) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Avatar initials={o.initials} size={36} bg={o.avBg} color={o.avColor} photo={o.photo} ring={o.avBg} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5 }}>ASSIGNED TUTOR</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.tutor}</div>
                </div>
              </div>

              {/* CTA */}
              <button style={{
                background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
                padding: '11px 18px', fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}>{o.cta}</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────── Upcoming Milestones (deadlines) ────────────────────────────
function UpcomingMilestones() {
  const items = [
    { color: C.green,  title: 'HISTORY ESSAY DRAFT', date: 'APRIL 12' },
    { color: C.orange, title: 'MATH EXAM',           date: 'APRIL 18' },
    { color: C.orange, title: 'FINAL PROJECT DRAFT', date: 'APRIL 25' },
    { color: C.red,    title: 'FINAL PROJECT DUE',   date: 'APRIL 30' }
  ];
  return (
    <Card>
      <h3 style={{ fontSize: 12, fontWeight: 800, color: C.textPrimary, margin: '0 0 14px', letterSpacing: 1 }}>
        UPCOMING MILESTONES
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, paddingLeft: 6, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 0, top: 4, bottom: 4, width: 4, borderRadius: 2, background: m.color
            }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.textPrimary, letterSpacing: 0.4 }}>{m.title}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: 600 }}>{m.date}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ──────────────────────────── Login Details (real, already shipped) ────────────────────────────
function LoginDetailsCard() {
  return (
    <Card style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 1 }}>LOGIN DETAILS</h3>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: C.greenSoft, color: C.green, letterSpacing: 0.3 }}>UPDATED APR 8</span>
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, letterSpacing: 0.3 }}>For <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: C.textSecondary }}>MMT1204</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <Row label="URL" value="canvas.school.edu" />
        <Row label="User" value="alex.m" />
        <Row label="Pass" value="••••••••" />
      </div>
    </Card>
  );
}

const Row = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 36, color: C.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>{label}</span>
    <span style={{ flex: 1, fontFamily: 'ui-monospace, monospace', color: C.textPrimary, fontWeight: 600 }}>{value}</span>
  </div>
);

// ──────────────────────────── Marketing row — magazine-style ────────────────────────────
function MarketingRow() {
  const featured = {
    tag: 'STUDY TIPS', title: 'How to write a thesis statement that lands an A',
    excerpt: 'A practical, three-step framework that works for any subject — with worked examples from real student papers.',
    date: 'Apr 8', read: '4 min read'
  };
  const otherPosts = [
    { tag: 'Math',   title: 'Calculus survival kit for finals week',    date: 'Apr 2',  read: '6 min' },
    { tag: 'Habits', title: 'Beat procrastination with 5 simple hacks', date: 'Mar 28', read: '5 min' }
  ];

  const testimonials = [
    {
      name: 'Priya R.', initials: 'PR', school: 'University of Texas · Spring 2025',
      stars: 5,
      photo: 'https://i.pravatar.cc/120?img=47',
      quote: 'Got an A on my history paper. The tutor was quick, thorough, and explained every revision in plain English.'
    },
    {
      name: 'Marcus L.', initials: 'ML', school: 'NYU · Fall 2024',
      stars: 5,
      photo: 'https://i.pravatar.cc/120?img=14',
      quote: 'Saved my finals week. Calculus tutor walked me through every concept until it actually clicked. Felt like 1-on-1 mentoring.'
    },
    {
      name: 'Aisha K.', initials: 'AK', school: 'UCLA · Spring 2025',
      stars: 5,
      photo: 'https://i.pravatar.cc/120?img=45',
      quote: 'Used the writing service for my thesis statement. The revisions were detailed and the turnaround was under 24 hours.'
    }
  ];
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSlide(s => (s + 1) % testimonials.length), 5000);
    return () => clearInterval(id);
  }, [testimonials.length]);
  const testimonial = testimonials[slide];

  const services = [
    { icon: FiFileText,      label: 'Essay Writing',  hue: C.accent,     bg: '#dbeafe' },
    { icon: FiBookOpen,      label: 'Online Classes', hue: C.green,      bg: C.greenSoft },
    { icon: FiCheckCircle,   label: 'Quiz & Exam',    hue: '#b45309',    bg: C.orangeSoft },
    { icon: FiMessageCircle, label: 'Tutoring',       hue: '#7c3aed',    bg: '#ede9fe' }
  ];

  return (
    <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 14 }}>
      {/* ── LEFT: Blog magazine ── */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Hero banner with gradient (placeholder for cover image) */}
        <div style={{
          position: 'relative', minHeight: 180, padding: 22,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #6366f1 55%, #ec4899 100%)',
          color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
        }}>
          <div style={{
            position: 'absolute', top: 16, left: 16,
            fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.2)', letterSpacing: 0.6, backdropFilter: 'blur(6px)'
          }}>FEATURED · {featured.tag}</div>
          <div style={{
            position: 'absolute', top: 16, right: 16,
            fontSize: 10, fontWeight: 600, opacity: 0.85, letterSpacing: 0.3
          }}>FROM THE BLOG</div>

          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.25, marginBottom: 8, maxWidth: '85%' }}>
            {featured.title}
          </div>
          <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.55, maxWidth: '85%', marginBottom: 14 }}>
            {featured.excerpt}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, fontWeight: 600 }}>
            <span style={{ opacity: 0.9 }}>{featured.date} · {featured.read}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'rgba(255,255,255,0.18)', borderRadius: 999, backdropFilter: 'blur(6px)' }}>
              Read article <FiArrowUpRight size={12} />
            </span>
          </div>
        </div>

        {/* More posts list */}
        <div style={{ padding: '6px 18px 16px' }}>
          {otherPosts.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', borderBottom: i < otherPosts.length - 1 ? `1px solid ${C.border}` : 'none'
            }}>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 4,
                background: '#eef2f7', color: C.textSecondary, letterSpacing: 0.4, flexShrink: 0
              }}>{p.tag.toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{p.title}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{p.date} · {p.read}</div>
              </div>
              <FiArrowUpRight size={14} color={C.textMuted} />
            </div>
          ))}
        </div>
      </Card>

      {/* ── RIGHT column: Featured testimonial (dark) + Services strip ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Dark featured testimonial */}
        <div style={{
          position: 'relative', background: '#0f172a', color: '#fff',
          borderRadius: 12, padding: '22px 20px', overflow: 'hidden'
        }}>
          {/* Decorative quote mark */}
          <div style={{
            position: 'absolute', top: -8, right: 14,
            fontSize: 100, lineHeight: 1, color: 'rgba(255,255,255,0.06)', fontFamily: 'serif', fontWeight: 800
          }}>"</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: '#a5b4fc' }}>
              STUDENT VOICE
            </div>
            {/* Slider dots */}
            <div style={{ display: 'flex', gap: 5 }}>
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Show review ${i + 1}`}
                  style={{
                    width: i === slide ? 18 : 6, height: 6, borderRadius: 999,
                    background: i === slide ? '#a5b4fc' : 'rgba(255,255,255,0.25)',
                    border: 'none', padding: 0, cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          </div>
          {/* Slide content — keyed so fade-in re-runs each change */}
          <div key={slide} style={{ animation: 'fadeSlide 0.4s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55, marginBottom: 14, position: 'relative', zIndex: 1, minHeight: 70 }}>
              "{testimonial.quote}"
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={testimonial.initials} size={36} bg="#6366f1" color="#fff" photo={testimonial.photo} ring="rgba(255,255,255,0.2)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{testimonial.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{testimonial.school}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 14, color: '#fbbf24', letterSpacing: 2 }}>
                {'★'.repeat(testimonial.stars)}
              </div>
            </div>
          </div>
          <style>{`@keyframes fadeSlide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>

        {/* Services strip */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 1 }}>EXPLORE MORE SERVICES</h3>
            <a style={{ marginLeft: 'auto', fontSize: 10, color: C.textMuted, fontWeight: 600 }}>View all</a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {services.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 11px', borderRadius: 9,
                background: s.bg, cursor: 'pointer'
              }}>
                <s.icon size={14} color={s.hue} />
                <span style={{ fontSize: 11, fontWeight: 700, color: s.hue, letterSpacing: 0.2 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ──────────────────────────── Page ────────────────────────────
export default function AdminDemoDesignTwo() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: C.textPrimary }}>
      <Topbar />
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0, padding: '24px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 22 }}>
            <div>
              <CurrentOrderProgress />
              <ActiveOrders />
            </div>
            <div>
              <UpcomingMilestones />
              <LoginDetailsCard />
            </div>
          </div>
          <MarketingRow />
        </main>
      </div>
    </div>
  );
}
