import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminLogin, salesLogin } from '../services/api';
import { FiLogIn, FiShield, FiUsers } from 'react-icons/fi';

export default function Login() {
  const [loginType, setLoginType] = useState('admin'); // 'admin' or 'sales'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let res;
      if (loginType === 'admin') {
        res = await adminLogin({ username, password });
        loginUser(res.data.user, res.data.token);
      } else {
        res = await salesLogin({ email, password });
        loginUser(res.data.user, res.data.token, res.data.user.permissions || []);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const switchLoginType = (type) => {
    setLoginType(type);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="text-center mb-3">
          <div style={{ display: 'inline-flex', padding: 16, borderRadius: 16, background: loginType === 'admin' ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'linear-gradient(135deg, #f59e0b, #ef4444)', marginBottom: 16 }}>
            {loginType === 'admin' ? <FiShield size={36} color="white" /> : <FiUsers size={36} color="white" />}
          </div>
          <h1>{loginType === 'admin' ? 'Admin Login' : 'Sales Team Login'}</h1>
          <p className="subtitle">Sign in to the dashboard</p>
        </div>

        {/* Login type toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => switchLoginType('admin')}
            style={{
              flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: loginType === 'admin' ? 'var(--accent)' : 'var(--card-bg)',
              color: loginType === 'admin' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => switchLoginType('sales')}
            style={{
              flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: loginType === 'sales' ? '#f59e0b' : 'var(--card-bg)',
              color: loginType === 'sales' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            Sales Team
          </button>
        </div>

        {error && <div className="toast toast-error" style={{ position: 'relative', marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          {loginType === 'admin' ? (
            <div className="form-group"><label className="form-label">Username</label><input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} required /></div>
          ) : (
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          )}
          <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', background: loginType === 'sales' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : undefined }} disabled={loading}>
            {loading ? <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div> : <><FiLogIn size={18} /> Sign In</>}
          </button>
        </form>
      </div>
    </div>
  );
}
