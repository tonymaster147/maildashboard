// v2 shell — sidebar fixed left with logo at top, topbar with notification
// bell + profile chip + GET HELP, mobile drawer with hamburger.
//
// All socket/polling/sound logic is preserved verbatim from the legacy shell —
// only the visual chrome changed. CSS for media queries lives in index.css
// under the "v2 shell" section.

import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteBranding, FALLBACK_SUPPORT_EMAIL } from '../context/SiteBrandingContext';
import {
  getUnreadCount, getPublicSite, getIssuesUnreadCount,
  getNotifications, getNotificationsUnreadCount,
  markNotificationRead, markAllNotificationsRead
} from '../services/api';
import { connectSocket } from '../services/socket';
import {
  FiHome, FiPlusCircle, FiList, FiMessageSquare, FiUser, FiLogOut,
  FiMenu, FiX, FiAlertCircle, FiBell, FiLifeBuoy, FiCreditCard,
  FiChevronDown, FiSettings, FiHelpCircle, FiBookOpen
} from 'react-icons/fi';
import { C } from '../theme/tokens';
import { Avatar, initialsFrom, NotificationPanel } from './ui';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

export default function Layout() {
  const { user, token, logoutUser } = useAuth();
  const ctxBrand = useSiteBranding();
  const [localBrand, setLocalBrand] = useState(null);
  const brand = localBrand || ctxBrand;

  // Defensive direct-fetch if the context didn't resolve in time
  useEffect(() => {
    if (!ctxBrand.resolved) {
      getPublicSite().then(res => {
        const s = res.data?.site;
        if (s) {
          setLocalBrand({
            name: s.name,
            logoUrl: s.logo_url ? (s.logo_url.startsWith('http') ? s.logo_url : `${API_ORIGIN}${s.logo_url}`) : null,
            contactEmail: s.contact_email || null,
            resolved: true
          });
        }
      }).catch(() => {});
    }
  }, [ctxBrand.resolved]);

  const navigate = useNavigate();
  const location = useLocation();
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadIssues, setUnreadIssues] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const bellRef = useRef(null);
  const profileRef = useRef(null);
  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

  // Close drawer + dropdowns on route change
  useEffect(() => {
    setSidebarOpen(false);
    setBellOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open (mobile)
  useEffect(() => {
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [sidebarOpen]);

  // Close dropdowns on outside-click
  useEffect(() => {
    if (!bellOpen && !profileOpen) return;
    const onDown = (e) => {
      if (bellOpen && bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [bellOpen, profileOpen]);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      setTimeout(() => ctx.close(), 500);
    } catch (e) {
      console.log('Sound not supported');
    }
  }, []);

  const isOnChatPage = (path) => path.startsWith('/chat/') || path === '/chats';

  // Total unread across both channels
  const fetchUnreadTotal = () => {
    if (isOnChatPage(locationRef.current)) return;
    getUnreadCount().then(res => {
      const d = res.data;
      setUnreadChat((d.tutor || 0) + (d.support || 0) || d.unread || 0);
    }).catch(() => {});
  };

  // Poll unread count every 30s (skip on chat pages)
  useEffect(() => {
    fetchUnreadTotal();
    const interval = setInterval(fetchUnreadTotal, 30000);
    return () => clearInterval(interval);
  }, []);

  // Issues unread — bumps when staff replies; clears when user opens the thread
  useEffect(() => {
    const fetchIssues = () => {
      if (locationRef.current.startsWith('/issues')) { setUnreadIssues(0); return; }
      getIssuesUnreadCount().then(r => setUnreadIssues(r.data?.unread || 0)).catch(() => {});
    };
    fetchIssues();
    const interval = setInterval(fetchIssues, 30000);
    return () => clearInterval(interval);
  }, []);

  // Clear badge immediately when navigating to the issues area
  useEffect(() => {
    if (location.pathname.startsWith('/issues')) setUnreadIssues(0);
  }, [location.pathname]);

  // Real-time chat notifications via socket
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    const handleChatNotif = (data) => {
      // Only skip when the student is viewing THIS exact conversation —
      // messages for other orders/channels should still light the badge.
      const path = locationRef.current;
      const inThisRoom = data?.order_id != null
        && path === `/chat/${data.channel}/${data.order_id}`;
      if (!inThisRoom) {
        setUnreadChat(prev => prev + 1);
        playNotificationSound();
      }
    };

    socket.on('chatNotification', handleChatNotif);
    return () => { socket.off('chatNotification', handleChatNotif); };
  }, [token, playNotificationSound]);

  // Entering the Chats list marks everything read server-side → clear.
  // Entering a single room only reads THAT thread — re-fetch the real total
  // once the room's getMessages has advanced the read cursor, so unread
  // counts from OTHER orders aren't wiped out.
  useEffect(() => {
    if (location.pathname === '/chats') {
      setUnreadChat(0);
    } else if (location.pathname.startsWith('/chat/')) {
      const t = setTimeout(() => {
        getUnreadCount().then(res => {
          const d = res.data;
          setUnreadChat((d.tutor || 0) + (d.support || 0) || d.unread || 0);
        }).catch(() => {});
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [location.pathname]);

  // ── Notification feed (bell) ────────────────────────────────
  // Poll the unread count every 30s; the socket listener below makes new
  // notifications appear instantly without waiting for the next poll.
  useEffect(() => {
    const fetchCount = () => {
      getNotificationsUnreadCount()
        .then(r => setUnreadNotifs(r.data?.unread || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Live push — backend emits 'notification' to the user_<id> room whenever
  // a status changes, payment lands, files arrive, or support replies.
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    const handleNotification = (n) => {
      // is_update = an existing unread chat row was refreshed, not a new one;
      // the badge already counts it, so don't bump twice.
      if (!n.is_update) setUnreadNotifs(prev => prev + 1);
      setNotifications(prev => [n, ...prev.filter(x => x.id !== n.id)]);
      // Light up the ISSUES nav badge instantly on staff replies (the 30s
      // poll would catch it eventually, but live matches the chat behavior).
      if (n.type === 'issue_reply' && !locationRef.current.startsWith('/issues')) {
        setUnreadIssues(prev => prev + 1);
      }
      // Chat messages already chime via the chatNotification handler above —
      // skip the second chime for those.
      if (n.type !== 'chat_message') playNotificationSound();
    };
    socket.on('notification', handleNotification);
    return () => { socket.off('notification', handleNotification); };
  }, [token, playNotificationSound]);

  const openBell = () => {
    setProfileOpen(false);
    setBellOpen(o => !o);
    if (bellOpen) return; // closing
    setNotifLoading(true);
    getNotifications()
      .then(r => setNotifications(r.data?.notifications || []))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  };

  const handleNotifRead = (id) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n)));
    setUnreadNotifs(prev => Math.max(0, prev - 1));
    markNotificationRead(id).catch(() => {});
  };

  const handleMarkAllNotifsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadNotifs(0);
    markAllNotificationsRead().catch(() => {});
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  // GET HELP — mailto site contact email, fallback to system default
  const helpEmail = brand.contactEmail || FALLBACK_SUPPORT_EMAIL;

  const displayName = user?.name || user?.username || 'Student';
  const initials = initialsFrom(displayName) || 'U';

  return (
    <div className="v2-app">
      {/* ── Sidebar (fixed left, drawer on mobile/tablet) ── */}
      <aside className={`v2-sidebar ${sidebarOpen ? 'v2-open' : ''}`}>
        {/* Close button — mobile/tablet only */}
        <div className="v2-sidebar-close-row">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="v2-icon-btn"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Brand / logo at the top */}
        <div className="v2-sidebar-brand">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} style={{ maxHeight: 36, maxWidth: 180, objectFit: 'contain' }} />
          ) : (
            <>
              <div className="v2-sidebar-brand-icon">
                <FiBookOpen size={18} color="#fff" />
              </div>
              <span className="v2-sidebar-brand-text">{brand.name}</span>
            </>
          )}
        </div>

        <nav className="v2-sidebar-nav">
          <NavItem to="/" end icon={FiHome} label="Dashboard" />
          <NavItem to="/new-order" icon={FiPlusCircle} label="New Order" />
          <NavItem to="/orders" icon={FiList} label="My Orders" />
          <NavItem to="/chats" icon={FiMessageSquare} label="Chat" badge={unreadChat} />
          <NavItem to="/issues" icon={FiAlertCircle} label="Issues" badge={unreadIssues} />
          <NavItem to="/payments" icon={FiCreditCard} label="Payments" />
          <NavItem to="/profile" icon={FiUser} label="Profile" />

          {/* Anchored CTA — red PLACE NEW ORDER */}
          <Link to="/new-order" className="v2-sidebar-cta">
            <FiPlusCircle size={16} /> PLACE NEW ORDER
          </Link>
        </nav>
      </aside>

      {/* Drawer overlay */}
      {sidebarOpen && <div className="v2-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Right side: topbar + main ── */}
      <div className="v2-shifted">
        <header className="v2-topbar">
          {/* Hamburger (mobile only) */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="v2-hamburger v2-icon-btn"
          >
            <FiMenu size={18} />
          </button>

          <h1 className="v2-topbar-title">STUDENT DASHBOARD</h1>

          <div className="v2-topbar-right">
            {/* Notification bell */}
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={openBell}
                aria-label="Notifications"
                title="Notifications"
                className="v2-icon-btn"
                style={{ position: 'relative' }}
              >
                <FiBell size={17} />
                {unreadNotifs > 0 && (
                  <span className="v2-bell-badge">{unreadNotifs > 99 ? '99+' : unreadNotifs}</span>
                )}
              </button>
              {bellOpen && (
                <NotificationPanel
                  notifications={notifications}
                  loading={notifLoading}
                  onItemRead={handleNotifRead}
                  onMarkAllRead={handleMarkAllNotifsRead}
                  onClose={() => setBellOpen(false)}
                />
              )}
            </div>

            {/* Profile chip */}
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => { setBellOpen(false); setProfileOpen(o => !o); }}
                className="v2-profile-chip"
              >
                <Avatar initials={initials} size={34} bg={C.accentSoft} color={C.accent} />
                <div className="v2-profile-text">
                  <div className="v2-profile-welcome">WELCOME,</div>
                  <div className="v2-profile-name">{displayName.toUpperCase()}</div>
                </div>
                <FiChevronDown size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
              </button>
              {profileOpen && (
                <ProfileMenu
                  onClose={() => setProfileOpen(false)}
                  onLogout={handleLogout}
                  helpEmail={helpEmail}
                />
              )}
            </div>

            {/* GET HELP 24/7 — mailto site contact (or fallback) */}
            <a
              href={`mailto:${helpEmail}?subject=${encodeURIComponent('Help — ' + (brand.name || 'Student Dashboard'))}`}
              className="v2-get-help"
              title={`Email ${helpEmail}`}
            >
              <FiLifeBuoy size={16} />
              <div>
                <div>GET HELP</div>
                <div className="v2-get-help-sub">24/7</div>
              </div>
            </a>
          </div>
        </header>

        <main className="v2-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── Sidebar nav item ──
function NavItem({ to, end, icon: Icon, label, badge }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `v2-nav-link ${isActive ? 'v2-active' : ''}`}>
      <Icon size={17} />
      <span className="v2-nav-label">{label}</span>
      {badge > 0 && <span className="v2-nav-badge">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  );
}

// ── Profile chip dropdown ──
function ProfileMenu({ onClose, onLogout, helpEmail }) {
  const navigate = useNavigate();
  const go = (path) => { onClose(); navigate(path); };
  const items = [
    { icon: FiSettings, label: 'Account Settings', onClick: () => go('/profile') },
    { icon: FiList, label: 'My Orders', onClick: () => go('/orders') },
    { icon: FiHelpCircle, label: 'Help Center', onClick: () => { onClose(); window.location.href = `mailto:${helpEmail}`; } },
  ];
  return (
    <div className="v2-popover" style={{ width: 220, right: 0 }}>
      {items.map((it, i) => (
        <button key={i} type="button" onClick={it.onClick} className="v2-popover-item v2-popover-item-btn">
          <it.icon size={15} style={{ color: C.textSecondary, flexShrink: 0 }} />
          <span className="v2-popover-item-title" style={{ fontWeight: 500 }}>{it.label}</span>
        </button>
      ))}
      <div style={{ height: 1, background: C.border, margin: '4px 6px' }} />
      <button type="button" onClick={onLogout} className="v2-popover-item v2-popover-item-btn">
        <FiLogOut size={15} style={{ color: C.red, flexShrink: 0 }} />
        <span className="v2-popover-item-title" style={{ fontWeight: 500, color: C.red }}>Sign Out</span>
      </button>
    </div>
  );
}
