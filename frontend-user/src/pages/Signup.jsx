import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signup } from '../services/api';
import { FiUserPlus, FiCopy, FiCheck } from 'react-icons/fi';
import { useSiteBranding } from '../context/SiteBrandingContext';

export default function Signup() {
  const brand = useSiteBranding();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signup({ username, email });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(result.access_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h1>Account Created!</h1>
          <p className="subtitle">Save your access code securely</p>
          
          <div style={{ background: 'var(--bg-input)', padding: 24, borderRadius: 'var(--radius)', margin: '24px 0', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 14 }}>Your Access Code</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)', letterSpacing: 2 }}>{result.access_code}</span>
              <button onClick={copyCode} className="btn btn-sm btn-secondary">
                {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
              </button>
            </div>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 16, borderRadius: 'var(--radius-sm)', marginBottom: 24, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <p style={{ color: 'var(--warning)', fontSize: 13 }}>⚠️ Please save this code. You will need it to login.</p>
          </div>

          <Link to="/login" className="btn btn-primary btn-lg" style={{ width: '100%' }}>Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="text-center mb-3">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} style={{ maxHeight: 60, maxWidth: 200, objectFit: 'contain', marginBottom: 16 }} />
          ) : (
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          )}
          <h1>Create Account</h1>
          <p className="subtitle">Get started with {brand.name}</p>
        </div>

        {error && <div className="toast toast-error" style={{ position: 'relative', marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input type="text" className="form-input" placeholder="Choose a username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" className="form-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Your access code will be sent to this email</p>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div> : <><FiUserPlus size={18} /> Create Account</>}
          </button>
        </form>

        <div className="auth-divider">Already have an account?</div>
        <Link to="/login" className="btn btn-secondary btn-lg" style={{ width: '100%' }}>Sign In</Link>
      </div>
    </div>
  );
}
