import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiPlusCircle, FiList, FiMessageSquare, FiDollarSign, FiUser, FiLogOut } from 'react-icons/fi';

export default function Layout() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

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
