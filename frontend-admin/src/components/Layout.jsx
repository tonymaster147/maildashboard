import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiGrid, FiUsers, FiUserCheck, FiShoppingBag, FiMessageCircle, FiSettings, FiLogOut, FiShield, FiPieChart } from 'react-icons/fi';

export default function Layout() {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();

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
          <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><FiShoppingBag size={18} /> Orders</NavLink>
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
