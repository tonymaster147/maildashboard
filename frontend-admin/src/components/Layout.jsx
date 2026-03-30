import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { connectSocket } from '../services/socket';
import { FiGrid, FiUsers, FiUserCheck, FiShoppingBag, FiMessageCircle, FiSettings, FiLogOut, FiShield, FiPieChart } from 'react-icons/fi';

export default function Layout() {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadOrders, setUnreadOrders] = useState(0);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800; // 800Hz beep
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 200);
    } catch (e) {
      console.log('Sound not supported');
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const socket = connectSocket(token);
    
    // Join the admin monitor system
    socket.emit('adminMonitorAll');

    socket.on('newOrderNotification', () => {
      if (!location.pathname.includes('/orders')) {
        setUnreadOrders(prev => prev + 1);
        playNotificationSound();
      }
    });

    return () => {
      socket.off('newOrderNotification');
    };
  }, [location.pathname, playNotificationSound]);

  useEffect(() => {
    if (location.pathname.includes('/orders')) {
      setUnreadOrders(0);
    }
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <FiShield size={18} />
          </div>
          <h1 style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Admin Panel</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FiGrid size={18} /> Dashboard</NavLink>
          <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FiUsers size={18} /> Users</NavLink>
          <NavLink to="/tutors" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FiUserCheck size={18} /> Tutors</NavLink>
          <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiShoppingBag size={18} /> Orders
            {unreadOrders > 0 && (
              <span className="badge" style={{ animation: 'pulse 2s infinite' }}>{unreadOrders}</span>
            )}
          </NavLink>
          <NavLink to="/chats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FiMessageCircle size={18} /> Chat Monitor</NavLink>
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FiPieChart size={18} /> Reports</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FiSettings size={18} /> Settings</NavLink>
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
