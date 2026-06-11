// Login — v2 split-screen auth shell. Access-code flow preserved verbatim.

import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FiLogIn, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useSiteBranding } from '../context/SiteBrandingContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { login } from '../services/api';
import Notice from '../components/Notice';
import { C } from '../theme/tokens';
import { AuthShell } from '../components/ui';

export default function Login() {
  usePageMeta('login');
  const brand = useSiteBranding();
  const [username, setUsername] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.signupSuccess ? location.state.message : null;

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
    <AuthShell
      title="Welcome back"
      subtitle={`Sign in to your ${brand.name} account to continue.`}
    >
      {successMessage && <Notice type="success">{successMessage}</Notice>}
      {error && <Notice type="error">{error}</Notice>}

      <form onSubmit={handleSubmit}>
        <Field label="Username">
          <input
            type="text" className="form-input"
            placeholder="Enter your username"
            value={username} onChange={e => setUsername(e.target.value)}
            required autoComplete="username"
          />
        </Field>
        <Field label="Access Code">
          <div style={{ position: 'relative' }}>
            <input
              type={showCode ? 'text' : 'password'} className="form-input"
              placeholder="Enter your access code"
              value={accessCode} onChange={e => setAccessCode(e.target.value)}
              required style={{ paddingRight: 44 }}
              autoComplete="current-password"
            />
            <button
              type="button" onClick={() => setShowCode(s => !s)}
              aria-label={showCode ? 'Hide access code' : 'Show access code'}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer',
                padding: 6, display: 'flex',
              }}
            >
              {showCode ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          <Link to="/forgot-access-code" className="v2-auth-forgot">
            Forgot access code?
          </Link>
        </Field>

        <button
          type="submit" disabled={loading}
          style={primaryBtnStyle(loading)}
        >
          {loading
            ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            : <><FiLogIn size={16} /> Sign In</>}
        </button>
      </form>

      <div className="v2-auth-link-strip">Don't have an account?</div>
      <Link to="/signup" className="v2-auth-secondary-btn">
        Create Account
      </Link>
    </AuthShell>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

const fieldLabelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted,
  letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
};

const primaryBtnStyle = (loading) => ({
  width: '100%', marginTop: 8, padding: '12px 18px', borderRadius: 10,
  border: 'none', background: C.accent, color: '#fff',
  cursor: loading ? 'not-allowed' : 'pointer',
  fontSize: 13, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  opacity: loading ? 0.7 : 1,
});
