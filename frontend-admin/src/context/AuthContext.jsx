import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const userData = localStorage.getItem('admin_user');
      if (userData) setUser(JSON.parse(userData));
      const permsData = localStorage.getItem('admin_permissions');
      if (permsData) setPermissions(JSON.parse(permsData));
    }
    setLoading(false);
  }, [token]);

  const loginUser = (userData, authToken, perms = []) => {
    localStorage.setItem('admin_token', authToken);
    localStorage.setItem('admin_user', JSON.stringify(userData));
    if (perms.length > 0) {
      localStorage.setItem('admin_permissions', JSON.stringify(perms));
    }
    setToken(authToken);
    setUser(userData);
    setPermissions(perms);
  };

  const logoutUser = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_permissions');
    setToken(null);
    setUser(null);
    setPermissions([]);
  };

  const isSalesUser = user?.role === 'sales_lead' || user?.role === 'sales_executive';
  const isAdmin = user?.role === 'admin';

  const hasPermission = (menuKey) => {
    if (isAdmin) return true;
    return permissions.includes(menuKey);
  };

  return (
    <AuthContext.Provider value={{ user, token, permissions, loading, loginUser, logoutUser, isAuthenticated: !!token, isSalesUser, isAdmin, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
