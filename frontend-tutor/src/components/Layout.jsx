import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiBookOpen, FiLogOut, FiAward } from 'react-icons/fi';

export default function Layout() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            <FiAward size={18} />
          </div>
          <h1 style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tutor Panel</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FiBookOpen size={18} /> My Tasks
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
