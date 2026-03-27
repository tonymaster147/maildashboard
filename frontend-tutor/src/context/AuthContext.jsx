import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tutor_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const userData = localStorage.getItem('tutor_user');
      if (userData) setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, [token]);

  const loginUser = (userData, authToken) => {
    localStorage.setItem('tutor_token', authToken);
    localStorage.setItem('tutor_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logoutUser = () => {
    localStorage.removeItem('tutor_token');
    localStorage.removeItem('tutor_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, logoutUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
