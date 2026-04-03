import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { connectSocket } from '../services/socket';
import { useApi } from '../hooks/useApi';
import { FiGrid, FiUsers, FiUserCheck, FiShoppingBag, FiMessageCircle, FiSettings, FiLogOut, FiShield, FiPieChart, FiUserPlus } from 'react-icons/fi';

const MENU_ITEMS = [
  { to: '/', key: 'dashboard', icon: FiGrid, label: 'Dashboard', end: true },
  { to: '/users', key: 'users', icon: FiUsers, label: 'Users' },
  { to: '/tutors', key: 'tutors', icon: FiUserCheck, label: 'Tutors' },
  { to: '/orders', key: 'orders', icon: FiShoppingBag, label: 'Orders', hasBadge: true },
  { to: '/chats', key: 'chats', icon: FiMessageCircle, label: 'Chat Monitor' },
  { to: '/reports', key: 'reports', icon: FiPieChart, label: 'Reports' },
  { to: '/settings', key: 'settings', icon: FiSettings, label: 'Settings' },
];

export default function Layout() {
  const { logoutUser, isAdmin, isSalesUser, hasPermission, user, token } = useAuth();
  const { getUnreadCount } = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
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

  // Fetch initial unread chat count & poll every 30s
  useEffect(() => {
    if (!getUnreadCount) return;
    const fetchUnread = () => {
      getUnreadCount().then(res => setUnreadChat(res.data.unread || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [getUnreadCount]);

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    socket.emit('adminMonitorAll');
    socket._adminMonitor = true; // flag for reconnection handler

    const handleNewOrder = () => {
      if (!locationRef.current.includes('/orders')) {
        setUnreadOrders(prev => prev + 1);
        playNotificationSound();
      }
    };

    const handleChatNotif = () => {
      const inChat = locationRef.current.includes('/sales-chat') || locationRef.current.includes('/chats/');
      if (!inChat) {
        setUnreadChat(prev => prev + 1);
        playNotificationSound();
      }
    };

    socket.on('newOrderNotification', handleNewOrder);
    socket.on('chatNotification', handleChatNotif);

    return () => {
      socket.off('newOrderNotification', handleNewOrder);
      socket.off('chatNotification', handleChatNotif);
    };
  }, [token, playNotificationSound]);

  useEffect(() => {
    if (location.pathname.includes('/orders')) {
      const timer = setTimeout(() => setUnreadOrders(0), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Refresh unread count when entering chat pages (5s delay for proper read marking)
  useEffect(() => {
    if (location.pathname.includes('/sales-chat') || location.pathname.includes('/chats/')) {
      if (!getUnreadCount) return;
      const timer = setTimeout(() => {
        getUnreadCount().then(res => setUnreadChat(res.data.unread || 0)).catch(() => {});
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, getUnreadCount]);

  // Filter menu items based on permissions
  const visibleMenuItems = MENU_ITEMS.filter(item => hasPermission(item.key));

  const panelLabel = isSalesUser
    ? (user?.role === 'sales_lead' ? 'Sales Lead' : 'Sales Executive')
    : 'Admin Panel';

  const panelGradient = isSalesUser
    ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
    : 'linear-gradient(135deg, #3b82f6, #8b5cf6)';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon" style={{ background: panelGradient }}>
            <FiShield size={18} />
          </div>
          <h1 style={{ background: panelGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: isSalesUser ? 16 : undefined }}>{panelLabel}</h1>
        </div>
        <nav className="sidebar-nav">
          {visibleMenuItems.map(item => (
            <NavLink key={item.key} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <item.icon size={18} /> {item.label}
              {item.hasBadge && unreadOrders > 0 && (
                <span className="badge" style={{ animation: 'pulse 2s infinite' }}>{unreadOrders}</span>
              )}
            </NavLink>
          ))}

          {/* Sales Team management - admin only */}
          {isAdmin && (
            <NavLink to="/sales-team" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FiUserPlus size={18} /> Sales Team
            </NavLink>
          )}

          {/* Sales Chat - always visible for sales users */}
          {isSalesUser && (
            <NavLink to="/sales-chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FiMessageCircle size={18} /> Customer Chat
              {unreadChat > 0 && (
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
