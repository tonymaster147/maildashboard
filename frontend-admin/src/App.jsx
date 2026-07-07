import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SalesDashboard from './pages/SalesDashboard';
import Users from './pages/Users';
import Tutors from './pages/Tutors';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import ChatMonitor from './pages/ChatMonitor';
import ChatView from './pages/ChatView';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SalesTeam from './pages/SalesTeam';
import AdminSalesActivity from './pages/AdminSalesActivity';
import SalesChat from './pages/SalesChat';
import PricingGeneral from './pages/PricingGeneral';
import ServicePricing from './pages/ServicePricing';
import Sites from './pages/Sites';
import Issues from './pages/Issues';
import IssueDetail from './pages/IssueDetail';
import AdminDemoDesign from './pages/AdminDemoDesign';
import AdminDemoDesignTwo from './pages/AdminDemoDesignTwo';
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

// Sales roles get their own dashboard (payment calendar + tasks); admins keep
// the business/revenue dashboard.
const DashboardHome = () => {
  const { isSalesUser } = useAuth();
  return isSalesUser ? <SalesDashboard /> : <Dashboard />;
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

// Customer Chat is available to admin AND sales users.
const ChatRoute = ({ children }) => {
  const { isAdmin, isSalesUser, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="loading-spinner"></div></div>;
  return (isAdmin || isSalesUser) ? children : <Navigate to="/" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public static design-preview pages — no auth, no admin shell */}
      <Route path="/admin-demo-design" element={<AdminDemoDesign />} />
      <Route path="/admin-demo-design-two" element={<AdminDemoDesignTwo />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<PermissionRoute menuKey="dashboard"><DashboardHome /></PermissionRoute>} />
        <Route path="users" element={<PermissionRoute menuKey="users"><Users /></PermissionRoute>} />
        <Route path="tutors" element={<PermissionRoute menuKey="tutors"><Tutors /></PermissionRoute>} />
        <Route path="orders" element={<PermissionRoute menuKey="orders"><Orders /></PermissionRoute>} />
        <Route path="orders/:id" element={<PermissionRoute menuKey="orders"><OrderDetail /></PermissionRoute>} />
        <Route path="chats" element={<PermissionRoute menuKey="chats"><ChatMonitor /></PermissionRoute>} />
        <Route path="chats/:orderId" element={<PermissionRoute menuKey="chats"><ChatView /></PermissionRoute>} />
        <Route path="issues" element={<PermissionRoute menuKey="issues"><Issues /></PermissionRoute>} />
        <Route path="issues/:id" element={<PermissionRoute menuKey="issues"><IssueDetail /></PermissionRoute>} />
        <Route path="reports" element={<PermissionRoute menuKey="reports"><Reports /></PermissionRoute>} />
        <Route path="pricing/general" element={<PermissionRoute menuKey="settings"><PricingGeneral /></PermissionRoute>} />
        <Route path="pricing/:serviceSlug" element={<PermissionRoute menuKey="settings"><ServicePricing /></PermissionRoute>} />
        <Route path="settings" element={<PermissionRoute menuKey="settings"><Settings /></PermissionRoute>} />
        <Route path="sites" element={<AdminOnlyRoute><Sites /></AdminOnlyRoute>} />
        <Route path="sales-team" element={<AdminOnlyRoute><SalesTeam /></AdminOnlyRoute>} />
        <Route path="sales-activity" element={<AdminOnlyRoute><AdminSalesActivity /></AdminOnlyRoute>} />
        <Route path="sales-chat" element={<ChatRoute><SalesChat /></ChatRoute>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router basename={import.meta.env.BASE_URL}>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
