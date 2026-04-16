import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { connectSocket } from '../services/socket';
import { useApi } from '../hooks/useApi';
import { FiGrid, FiUsers, FiUserCheck, FiShoppingBag, FiMessageCircle, FiSettings, FiLogOut, FiShield, FiPieChart, FiUserPlus, FiDollarSign, FiChevronDown } from 'react-icons/fi';

const MENU_ITEMS = [
  { to: '/', key: 'dashboard', icon: FiGrid, label: 'Dashboard', end: true },
  { to: '/users', key: 'users', icon: FiUsers, label: 'Users' },
  { to: '/tutors', key: 'tutors', icon: FiUserCheck, label: 'Tutors' },
  { to: '/orders', key: 'orders', icon: FiShoppingBag, label: 'Orders', hasBadge: true },
  { to: '/chats', key: 'chats', icon: FiMessageCircle, label: 'Chat Monitor', hasFlaggedBadge: true },
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
  const { getUnreadCount } = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadFlagged, setUnreadFlagged] = useState(0);
  const [pricingOpen, setPricingOpen] = useState(location.pathname.startsWith('/pricing'));
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

    socket.on('newOrderNotification', handleNewOrder);
    socket.on('chatNotification', handleChatNotif);
    socket.on('flaggedMessage', handleFlagged);

    return () => {
      socket.off('newOrderNotification', handleNewOrder);
      socket.off('chatNotification', handleChatNotif);
      socket.off('flaggedMessage', handleFlagged);
    };
  }, [token, playNotificationSound]);

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
              </NavLink>
              {item.key === 'tutors' && isAdmin && (
                <NavLink to="/sales-team" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FiUserPlus size={18} /> Sales Team
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

          {isSalesUser && (
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
