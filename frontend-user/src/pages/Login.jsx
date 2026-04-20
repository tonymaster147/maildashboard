import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSiteBranding } from '../context/SiteBrandingContext';
import { login } from '../services/api';
import { FiLogIn, FiEye, FiEyeOff } from 'react-icons/fi';

export default function Login() {
  const brand = useSiteBranding();
  const [username, setUsername] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login({ username, access_code: accessCode });
      loginUser(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="text-center mb-3">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} style={{ maxHeight: 60, maxWidth: 200, objectFit: 'contain', marginBottom: 16 }} />
          ) : (
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          )}
          <h1>Welcome Back</h1>
          <p className="subtitle">Sign in to your {brand.name} account</p>
        </div>

        {error && <div className="toast toast-error" style={{ position: 'relative', marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" className="form-input" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Access Code</label>
            <div style={{ position: 'relative' }}>
              <input type={showCode ? 'text' : 'password'} className="form-input" placeholder="Enter your access code" value={accessCode} onChange={e => setAccessCode(e.target.value)} required style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowCode(!showCode)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showCode ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div> : <><FiLogIn size={18} /> Sign In</>}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link to="/forgot-access-code" style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Forgot Access Code?</Link>
        </div>

        <div className="auth-divider">Don't have an account?</div>
        <Link to="/signup" className="btn btn-secondary btn-lg" style={{ width: '100%' }}>Create Account</Link>
      </div>
    </div>
  );
}
