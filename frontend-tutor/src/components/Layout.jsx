import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../services/api';
import { connectSocket } from '../services/socket';
import { FiBookOpen, FiLogOut, FiAward, FiMessageSquare } from 'react-icons/fi';

export default function Layout() {
  const { user, token, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadTasks, setUnreadTasks] = useState(0);
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

    socket.on('chatNotification', handleChatNotif);
    socket.on('tutorNewTask', handleNewTask);

    return () => {
      socket.off('chatNotification', handleChatNotif);
      socket.off('tutorNewTask', handleNewTask);
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
