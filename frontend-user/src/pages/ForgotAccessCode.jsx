// ForgotAccessCode — v2 split-screen auth shell. Email-based recovery API
// flow preserved verbatim.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import { forgotAccessCode } from '../services/api';
import Notice from '../components/Notice';
import { C } from '../theme/tokens';
import { AuthShell } from '../components/ui';

export default function ForgotAccessCode() {
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
    <AuthShell
      title="Forgot Access Code?"
      subtitle="Enter your email and we'll send a new access code right away."
      heroTitle="Reset access"
      heroSubtitle="Enter your email and we'll send a fresh access code so you can get back in — no support ticket needed."
    >
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}

      <form onSubmit={handleSubmit}>
        <Field label="Email Address">
          <div className="v2-input-icon-wrap">
            <span className="v2-input-lead"><FiMail size={16} /></span>
            <input
              type="email" className="form-input"
              placeholder="your@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
            />
          </div>
        </Field>

        <button
          type="submit" disabled={loading}
          style={primaryBtnStyle(loading)}
        >
          {loading
            ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            : <><FiMail size={16} /> Send New Access Code</>}
        </button>
      </form>

      <div className="v2-auth-link-strip">Remember your code?</div>
      <Link to="/login" className="v2-auth-secondary-btn">
        <FiArrowLeft size={14} /> Back to Login
      </Link>
    </AuthShell>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="v2-auth-label">{label}</label>
      {children}
    </div>
  );
}

const primaryBtnStyle = (loading) => ({
  width: '100%', marginTop: 8, padding: '13px 18px', borderRadius: 10,
  border: 'none', background: C.accent, color: '#fff',
  cursor: loading ? 'not-allowed' : 'pointer',
  fontSize: 14, fontWeight: 600, letterSpacing: 0.2,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  opacity: loading ? 0.7 : 1,
});
