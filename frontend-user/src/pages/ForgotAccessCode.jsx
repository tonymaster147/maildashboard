import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotAccessCode } from '../services/api';
import { useSiteBranding } from '../context/SiteBrandingContext';
import { FiMail, FiArrowLeft } from 'react-icons/fi';

export default function ForgotAccessCode() {
  const brand = useSiteBranding();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await forgotAccessCode({ email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
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
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
          )}
          <h1>Forgot Access Code</h1>
          <p className="subtitle">Enter your {brand.name} email to receive a new access code</p>
        </div>

        {error && <div className="toast toast-error" style={{ position: 'relative', marginBottom: 16 }}>{error}</div>}
        {message && <div className="toast toast-success" style={{ position: 'relative', marginBottom: 16, background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-input" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div> : <><FiMail size={18} /> Send New Access Code</>}
          </button>
        </form>

        <div className="auth-divider">Remember your code?</div>
        <Link to="/login" className="btn btn-secondary btn-lg" style={{ width: '100%' }}><FiArrowLeft size={16} /> Back to Login</Link>
      </div>
    </div>
  );
}
