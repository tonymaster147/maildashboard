import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Tutors from './pages/Tutors';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import ChatMonitor from './pages/ChatMonitor';
import ChatView from './pages/ChatView';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SalesTeam from './pages/SalesTeam';
import SalesChat from './pages/SalesChat';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="loading-spinner"></div></div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PermissionRoute = ({ menuKey, children }) => {
  const { hasPermission, isSalesUser, permissions, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="loading-spinner"></div></div>;
  if (hasPermission(menuKey)) return children;
  // For sales users without this permission, redirect to first permitted page or sales-chat
  if (isSalesUser) {
    const menuToPath = { dashboard: '/', users: '/users', tutors: '/tutors', orders: '/orders', chats: '/chats', reports: '/reports', settings: '/settings' };
    const firstPermitted = permissions.find(p => p !== 'sales_chat' && menuToPath[p]);
    return <Navigate to={firstPermitted ? menuToPath[firstPermitted] : '/sales-chat'} />;
  }
  return <Navigate to="/" />;
};

const AdminOnlyRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="loading-spinner"></div></div>;
  return isAdmin ? children : <Navigate to="/" />;
};

const SalesOnlyRoute = ({ children }) => {
  const { isSalesUser, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="loading-spinner"></div></div>;
  return isSalesUser ? children : <Navigate to="/" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<PermissionRoute menuKey="dashboard"><Dashboard /></PermissionRoute>} />
        <Route path="users" element={<PermissionRoute menuKey="users"><Users /></PermissionRoute>} />
        <Route path="tutors" element={<PermissionRoute menuKey="tutors"><Tutors /></PermissionRoute>} />
        <Route path="orders" element={<PermissionRoute menuKey="orders"><Orders /></PermissionRoute>} />
        <Route path="orders/:id" element={<PermissionRoute menuKey="orders"><OrderDetail /></PermissionRoute>} />
        <Route path="chats" element={<PermissionRoute menuKey="chats"><ChatMonitor /></PermissionRoute>} />
        <Route path="chats/:orderId" element={<PermissionRoute menuKey="chats"><ChatView /></PermissionRoute>} />
        <Route path="reports" element={<PermissionRoute menuKey="reports"><Reports /></PermissionRoute>} />
        <Route path="settings" element={<PermissionRoute menuKey="settings"><Settings /></PermissionRoute>} />
        <Route path="sales-team" element={<AdminOnlyRoute><SalesTeam /></AdminOnlyRoute>} />
        <Route path="sales-chat" element={<SalesOnlyRoute><SalesChat /></SalesOnlyRoute>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
