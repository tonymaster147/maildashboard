import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../services/api';
import { connectSocket } from '../services/socket';
import { FiHome, FiPlusCircle, FiList, FiMessageSquare, FiDollarSign, FiUser, FiLogOut } from 'react-icons/fi';

export default function Layout() {
  const { user, token, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadChat, setUnreadChat] = useState(0);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 200);
    } catch (e) {
      console.log('Sound not supported');
    }
  }, []);

  // Fetch initial unread count
  useEffect(() => {
    const fetchUnread = () => {
      getUnreadCount().then(res => setUnreadChat(res.data.unread || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time chat notifications via socket
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    socket.on('chatNotification', (data) => {
      if (!location.pathname.includes(`/chat/${data.order_id}`)) {
        setUnreadChat(prev => prev + 1);
        playNotificationSound();
      }
    });

    return () => {
      socket.off('chatNotification');
    };
  }, [token, location.pathname, playNotificationSound]);

  // When user navigates to a chat, refresh unread count
  useEffect(() => {
    if (location.pathname.includes('/chat/')) {
      setTimeout(() => {
        getUnreadCount().then(res => setUnreadChat(res.data.unread || 0)).catch(() => {});
      }, 1000);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">📚</div>
          <h1>EduPro</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiHome size={18} /> Dashboard
          </NavLink>
          <NavLink to="/new-order" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiPlusCircle size={18} /> New Order
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiList size={18} /> My Orders
          </NavLink>
          <NavLink to="/chats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiMessageSquare size={18} /> Chat
            {unreadChat > 0 && (
              <span style={{ background: 'var(--error)', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 10, marginLeft: 'auto', fontWeight: 700, minWidth: 20, textAlign: 'center', animation: 'pulse 2s infinite' }}>{unreadChat}</span>
            )}
          </NavLink>
          <NavLink to="/payments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiDollarSign size={18} /> Payments
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiUser size={18} /> Profile
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Logged in as <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ width: '100%' }}>
            <FiLogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
