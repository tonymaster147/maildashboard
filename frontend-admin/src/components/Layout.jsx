import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { connectSocket } from '../services/socket';
import { useApi } from '../hooks/useApi';
import { FiGrid, FiUsers, FiUserCheck, FiShoppingBag, FiMessageCircle, FiSettings, FiLogOut, FiShield, FiPieChart, FiUserPlus, FiDollarSign, FiChevronDown, FiGlobe, FiAlertCircle, FiBell } from 'react-icons/fi';
import NotificationPanel from './NotificationPanel';

const MENU_ITEMS = [
  { to: '/', key: 'dashboard', icon: FiGrid, label: 'Dashboard', end: true },
  { to: '/users', key: 'users', icon: FiUsers, label: 'Users' },
  { to: '/tutors', key: 'tutors', icon: FiUserCheck, label: 'Tutors' },
  { to: '/orders', key: 'orders', icon: FiShoppingBag, label: 'Orders', hasBadge: true },
  { to: '/chats', key: 'chats', icon: FiMessageCircle, label: 'Chat Monitor', hasFlaggedBadge: true },
  { to: '/issues', key: 'issues', icon: FiAlertCircle, label: 'Escalation', hasIssuesBadge: true },
  { to: '/reports', key: 'reports', icon: FiPieChart, label: 'Reports' },
  { to: '/settings', key: 'settings', icon: FiSettings, label: 'Settings' },
];

const PRICING_SUBITEMS = [
  { to: '/pricing/general', label: 'General Settings' },
  { to: '/pricing/online-class', label: 'Online Class' },
  { to: '/pricing/assignment', label: 'Assignment' },
  { to: '/pricing/essay', label: 'Essay/Paper' },
  { to: '/pricing/project', label: 'Project' },
  { to: '/pricing/discussion', label: 'Discussion' },
  { to: '/pricing/online-exam', label: 'Online Exam' },
  { to: '/pricing/online-quiz', label: 'Online Quiz' },
  { to: '/pricing/test', label: 'Test' },
];

export default function Layout() {
  const { logoutUser, isAdmin, isSalesUser, hasPermission, user, token } = useAuth();
  const {
    getUnreadCount, getIssuesUnreadCount,
    getNotificationsFeed, getNotificationsFeedUnread,
    markFeedNotificationRead, markAllFeedNotificationsRead,
  } = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadFlagged, setUnreadFlagged] = useState(0);
  const [unreadIssues, setUnreadIssues] = useState(0);
  const [pricingOpen, setPricingOpen] = useState(location.pathname.startsWith('/pricing'));
  // Notification feed (sidebar bell)
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [bellAnchor, setBellAnchor] = useState(null);
  const bellRef = useRef(null);
  const bellBtnRef = useRef(null);
  const myRole = isSalesUser ? user?.role : 'admin';
  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

  // Close bell on outside click / route change
  useEffect(() => { setBellOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!bellOpen) return;
    const onDown = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [bellOpen]);

  // Poll feed unread count every 30s (socket below covers live)
  useEffect(() => {
    if (!getNotificationsFeedUnread) return;
    const fetchCount = () => {
      getNotificationsFeedUnread().then(r => setUnreadNotifs(r.data?.unread || 0)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [getNotificationsFeedUnread]);

  const openBell = () => {
    setBellOpen(o => !o);
    if (bellOpen) return; // closing
    if (bellBtnRef.current) setBellAnchor(bellBtnRef.current.getBoundingClientRect());
    setNotifLoading(true);
    getNotificationsFeed()
      .then(r => setNotifications(r.data?.notifications || []))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  };

  const handleNotifRead = (id) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n)));
    setUnreadNotifs(prev => Math.max(0, prev - 1));
    markFeedNotificationRead(id).catch(() => {});
  };

  const handleMarkAllNotifsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadNotifs(0);
    markAllFeedNotificationsRead().catch(() => {});
  };

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

  const isOnChatPage = (path) => path.startsWith('/chats') || path === '/sales-chat';

  // Poll unread count every 30s (skip on chat pages)
  useEffect(() => {
    if (!getUnreadCount) return;
    const fetchUnread = () => {
      if (isOnChatPage(locationRef.current)) return;
      getUnreadCount().then(res => setUnreadChat(res.data.unread || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [getUnreadCount]);

  // Issues unread — bumps when user replies/opens new issue; clears when staff opens the thread
  useEffect(() => {
    if (!getIssuesUnreadCount) return;
    const fetchUnread = () => {
      if (locationRef.current.startsWith('/issues')) { setUnreadIssues(0); return; }
      getIssuesUnreadCount().then(r => setUnreadIssues(r.data?.unread || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [getIssuesUnreadCount]);

  // Clear badge immediately on navigation to issues area
  useEffect(() => {
    if (location.pathname.startsWith('/issues')) setUnreadIssues(0);
  }, [location.pathname]);

  // Socket: listen for order + chat notifications, join admin_monitor room
  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    socket.emit('adminMonitorAll');
    socket._adminMonitor = true;

    const handleNewOrder = () => {
      if (!locationRef.current.includes('/orders')) {
        setUnreadOrders(prev => prev + 1);
        playNotificationSound();
      }
    };

    const handleChatNotif = () => {
      const onSalesChat = locationRef.current === '/sales-chat';
      if (!isOnChatPage(locationRef.current)) {
        // Not on any chat page — show badge + sound
        setUnreadChat(prev => prev + 1);
        playNotificationSound();
      } else if (!onSalesChat) {
        // On ChatMonitor/ChatView but not SalesChat — just play sound
        playNotificationSound();
      }
      // On /sales-chat — SalesChat component handles its own sound
    };

    const handleFlagged = () => {
      if (!locationRef.current.startsWith('/chats')) {
        setUnreadFlagged(prev => prev + 1);
      }
      playNotificationSound();
    };

    // Live issues badge — fires when a student opens a new issue or replies
    // (previously this only refreshed on the 30s poll, unlike chat).
    const handleIssueNotif = () => {
      if (!locationRef.current.startsWith('/issues')) {
        setUnreadIssues(prev => prev + 1);
        playNotificationSound();
      }
    };

    // Bell-panel feed — each role gets its own row; keep only ours. Types
    // that already chime through the dedicated handlers above stay silent
    // here so a single event never double-beeps.
    const QUIET_TYPES = ['chat_message', 'issue_created', 'issue_reply', 'new_order', 'flagged_message'];
    const handleStaffNotif = (n) => {
      if (n.role !== myRole) return;
      if (!n.is_update) setUnreadNotifs(prev => prev + 1);
      setNotifications(prev => [n, ...prev.filter(x => x.id !== n.id)]);
      if (!QUIET_TYPES.includes(n.type)) playNotificationSound();
    };

    socket.on('newOrderNotification', handleNewOrder);
    socket.on('chatNotification', handleChatNotif);
    socket.on('flaggedMessage', handleFlagged);
    socket.on('issueNotification', handleIssueNotif);
    socket.on('staffNotification', handleStaffNotif);

    return () => {
      socket.off('newOrderNotification', handleNewOrder);
      socket.off('chatNotification', handleChatNotif);
      socket.off('flaggedMessage', handleFlagged);
      socket.off('issueNotification', handleIssueNotif);
      socket.off('staffNotification', handleStaffNotif);
    };
  }, [token, playNotificationSound, myRole]);

  // Clear order badge after 5s on orders page
  useEffect(() => {
    if (location.pathname.includes('/orders')) {
      const timer = setTimeout(() => setUnreadOrders(0), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Clear chat badge when entering chat pages
  useEffect(() => {
    if (isOnChatPage(location.pathname)) {
      setUnreadChat(0);
    }
    if (location.pathname.startsWith('/chats')) {
      setUnreadFlagged(0);
    }
  }, [location.pathname]);

  // Auto-expand pricing menu when on a pricing route
  useEffect(() => {
    if (location.pathname.startsWith('/pricing')) {
      setPricingOpen(true);
    }
  }, [location.pathname]);

  const visibleMenuItems = MENU_ITEMS.filter(item => hasPermission(item.key));

  const panelLabel = isSalesUser
    ? (user?.role === 'sales_lead' ? 'Sales Lead' : 'Sales Executive')
    : 'Admin Panel';

  const panelGradient = isSalesUser
    ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
    : 'linear-gradient(135deg, #3b82f6, #8b5cf6)';

  return (
    <div className="app-layout">
      {/* Notification bell — fixed top-right; .main-content reserves a
          topbar-height gap so page content never sits under it. */}
      <div ref={bellRef} style={{ position: 'fixed', top: 14, right: 28, zIndex: 250 }}>
        <button
          type="button"
          onClick={openBell}
          aria-label="Notifications"
          title="Notifications"
          style={{
            position: 'relative', width: 42, height: 42, borderRadius: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
          }}
        >
          <FiBell size={18} />
          {unreadNotifs > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -5,
              minWidth: 18, height: 18, borderRadius: 9,
              background: 'var(--error)', color: '#fff',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px', animation: 'pulse 2s infinite',
            }}>
              {unreadNotifs > 99 ? '99+' : unreadNotifs}
            </span>
          )}
        </button>
        {bellOpen && (
          <NotificationPanel
            notifications={notifications}
            loading={notifLoading}
            onItemRead={handleNotifRead}
            onMarkAllRead={handleMarkAllNotifsRead}
            onClose={() => setBellOpen(false)}
            isSalesUser={isSalesUser}
          />
        )}
      </div>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon" style={{ background: panelGradient }}>
            <FiShield size={18} />
          </div>
          <h1 style={{ background: panelGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: isSalesUser ? 16 : undefined }}>{panelLabel}</h1>
        </div>
        <nav className="sidebar-nav">
          {visibleMenuItems.map(item => (
            <React.Fragment key={item.key}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <item.icon size={18} /> {item.label}
                {item.hasBadge && unreadOrders > 0 && (
                  <span className="badge" style={{ animation: 'pulse 2s infinite' }}>{unreadOrders}</span>
                )}
                {item.hasFlaggedBadge && unreadFlagged > 0 && (
                  <span style={{ background: 'var(--warning)', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 10, marginLeft: 'auto', fontWeight: 700, minWidth: 20, textAlign: 'center', animation: 'pulse 2s infinite' }}>{unreadFlagged}</span>
                )}
                {item.hasIssuesBadge && unreadIssues > 0 && !location.pathname.startsWith('/issues') && (
                  <span style={{ background: 'var(--error)', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 10, marginLeft: 'auto', fontWeight: 700, minWidth: 20, textAlign: 'center', animation: 'pulse 2s infinite' }}>{unreadIssues}</span>
                )}
              </NavLink>
              {item.key === 'tutors' && isAdmin && (
                <NavLink to="/sales-team" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FiUserPlus size={18} /> Sales Team
                </NavLink>
              )}
              {item.key === 'settings' && isAdmin && (
                <NavLink to="/sites" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FiGlobe size={18} /> Sites
                </NavLink>
              )}
              {item.key === 'reports' && hasPermission('settings') && (
                <>
                  <div
                    className={`nav-link ${location.pathname.startsWith('/pricing') ? 'active' : ''}`}
                    onClick={() => setPricingOpen(prev => !prev)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><FiDollarSign size={18} /> Pricing</span>
                    <FiChevronDown size={14} style={{ transition: 'transform 0.2s', transform: pricingOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </div>
                  {pricingOpen && (
                    <div style={{ paddingLeft: 28 }}>
                      {PRICING_SUBITEMS.map(sub => (
                        <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ fontSize: 13, padding: '6px 12px' }}>
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              )}
            </React.Fragment>
          ))}

          {(isSalesUser || isAdmin) && (
            <NavLink to="/sales-chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FiMessageCircle size={18} /> Customer Chat
              {unreadChat > 0 && !isOnChatPage(location.pathname) && (
                <span style={{ background: 'var(--error)', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 10, marginLeft: 'auto', fontWeight: 700, minWidth: 20, textAlign: 'center', animation: 'pulse 2s infinite' }}>{unreadChat}</span>
              )}
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-secondary btn-sm" onClick={() => { logoutUser(); navigate('/login'); }} style={{ width: '100%' }}>
            <FiLogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}
