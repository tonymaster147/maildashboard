import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getUnreadCount,
  getNotificationsFeed, getNotificationsFeedUnread,
  markFeedNotificationRead, markAllFeedNotificationsRead,
} from '../services/api';
import { connectSocket } from '../services/socket';
import { FiBookOpen, FiLogOut, FiAward, FiMessageSquare, FiBell } from 'react-icons/fi';
import NotificationPanel from './NotificationPanel';

export default function Layout() {
  const { user, token, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadTasks, setUnreadTasks] = useState(0);
  // Notification feed (floating bell)
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [bellAnchor, setBellAnchor] = useState(null);
  const bellRef = useRef(null);
  const bellBtnRef = useRef(null);
  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

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

  // Poll unread count every 30s (skip on chat pages)
  useEffect(() => {
    const fetchUnread = () => {
      if (isOnChatPage(locationRef.current)) return;
      getUnreadCount().then(res => setUnreadChat(res.data.unread || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Bell: close on route change / outside click
  useEffect(() => { setBellOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!bellOpen) return;
    const onDown = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [bellOpen]);

  // Poll feed unread every 30s (socket covers live)
  useEffect(() => {
    const fetchCount = () => {
      getNotificationsFeedUnread().then(r => setUnreadNotifs(r.data?.unread || 0)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const openBell = () => {
    setBellOpen(o => !o);
    if (bellOpen) return;
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

  // Real-time chat + task notifications via socket
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    const handleChatNotif = () => {
      if (!isOnChatPage(locationRef.current)) {
        setUnreadChat(prev => prev + 1);
        playNotificationSound();
      }
    };

    const handleNewTask = () => {
      if (locationRef.current !== '/') {
        setUnreadTasks(prev => prev + 1);
      }
      playNotificationSound();
    };

    // Bell-panel feed (tutor personal room). chat_message + task_assigned
    // already chime via the handlers above, so stay quiet for those.
    const QUIET_TYPES = ['chat_message', 'task_assigned'];
    const handleNotification = (n) => {
      if (!n.is_update) setUnreadNotifs(prev => prev + 1);
      setNotifications(prev => [n, ...prev.filter(x => x.id !== n.id)]);
      if (!QUIET_TYPES.includes(n.type)) playNotificationSound();
    };

    socket.on('chatNotification', handleChatNotif);
    socket.on('tutorNewTask', handleNewTask);
    socket.on('notification', handleNotification);

    return () => {
      socket.off('chatNotification', handleChatNotif);
      socket.off('tutorNewTask', handleNewTask);
      socket.off('notification', handleNotification);
    };
  }, [token, playNotificationSound]);

  // Clear badges when entering relevant pages
  useEffect(() => {
    if (location.pathname === '/') setUnreadTasks(0);
  }, [location.pathname]);

  useEffect(() => {
    if (isOnChatPage(location.pathname)) setUnreadChat(0);
  }, [location.pathname]);

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
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
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
          />
        )}
      </div>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <FiAward size={18} />
          </div>
          <h1 style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tutor Panel</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiBookOpen size={18} /> My Tasks
            {unreadTasks > 0 && (
              <span style={{ background: 'var(--success)', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 10, marginLeft: 'auto', fontWeight: 700, minWidth: 20, textAlign: 'center', animation: 'pulse 2s infinite' }}>{unreadTasks}</span>
            )}
          </NavLink>
          <NavLink to="/chats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiMessageSquare size={18} /> Chat
            {unreadChat > 0 && !isOnChatPage(location.pathname) && (
              <span style={{ background: 'var(--error)', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 10, marginLeft: 'auto', fontWeight: 700, minWidth: 20, textAlign: 'center', animation: 'pulse 2s infinite' }}>{unreadChat}</span>
            )}
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Hello, <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { logoutUser(); navigate('/login'); }} style={{ width: '100%' }}>
            <FiLogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}
