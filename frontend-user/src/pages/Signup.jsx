// Signup — v2 split-screen auth shell. Country-code picker + auto-detect via
// getPublicGeo + access-code email flow are preserved verbatim.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUserPlus, FiUser, FiAtSign, FiMail, FiPhone } from 'react-icons/fi';
import { signup, getPublicGeo } from '../services/api';
import { usePageMeta } from '../hooks/usePageMeta';
import { COUNTRY_CODES, DEFAULT_DIAL, findByIso } from '../utils/countryCodes';
import Notice from '../components/Notice';
import { C } from '../theme/tokens';
import { AuthShell } from '../components/ui';

export default function Signup() {
  usePageMeta('signup');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Auto-detect dial code from user's IP
  useEffect(() => {
    getPublicGeo()
      .then(({ data }) => {
        const match = findByIso(data?.countryCode);
        if (match) setDialCode(match.dial);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fullPhone = `${dialCode} ${phone}`.trim();
      await signup({ username, name, email, phone: fullPhone });
      navigate('/login', {
        state: { signupSuccess: true, message: 'Account created! Your access code has been emailed to you.' },
        replace: true,
      });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Signup failed');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign Up"
      subtitle="Fill in the details below to get started."
      heroTitle="Create your account"
      heroSubtitle="Create a new account to manage your assignments, message tutors, and track your progress all in one place."
    >
      {error && <Notice type="error">{error}</Notice>}

      <form onSubmit={handleSubmit}>
        <Field label="Name" required>
          <div className="v2-input-icon-wrap">
            <span className="v2-input-lead"><FiUser size={16} /></span>
            <input
              type="text" className="form-input" placeholder="Your full name"
              value={name} onChange={e => setName(e.target.value)}
              required minLength={2} maxLength={100} autoComplete="name"
            />
          </div>
        </Field>

        <Field label="Username" required>
          <div className="v2-input-icon-wrap">
            <span className="v2-input-lead"><FiAtSign size={16} /></span>
            <input
              type="text" className="form-input" placeholder="Choose a username"
              value={username} onChange={e => setUsername(e.target.value)}
              required minLength={3} autoComplete="username"
            />
          </div>
        </Field>

        <Field label="Email" required hint="Your access code will be sent to this email.">
          <div className="v2-input-icon-wrap">
            <span className="v2-input-lead"><FiMail size={16} /></span>
            <input
              type="email" className="form-input" placeholder="your@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
            />
          </div>
        </Field>

        <Field label="Phone Number" required>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              className="form-select" value={dialCode}
              onChange={e => setDialCode(e.target.value)}
              style={{ flex: '0 0 110px', paddingRight: 4 }}
              aria-label="Country code"
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.iso} value={c.dial}>{c.iso} {c.dial}</option>
              ))}
            </select>
            <div className="v2-input-icon-wrap" style={{ flex: 1 }}>
              <span className="v2-input-lead"><FiPhone size={16} /></span>
              <input
                type="tel" className="form-input" placeholder="555 123 4567"
                value={phone} onChange={e => setPhone(e.target.value)}
                required
                pattern="^[0-9\s\-()]{6,18}$"
                title="Enter a valid phone number (digits, spaces, -, parentheses)"
                style={{ width: '100%' }}
                autoComplete="tel-national"
              />
            </div>
          </div>
        </Field>

        <button
          type="submit" disabled={loading}
          style={primaryBtnStyle(loading)}
        >
          {loading
            ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            : <><FiUserPlus size={16} /> Create Account</>}
        </button>
      </form>

      <div className="v2-auth-link-strip">Already have an account?</div>
      <Link to="/login" className="v2-auth-secondary-btn">
        Sign In
      </Link>
    </AuthShell>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="v2-auth-label">
        {label}{required && <span className="req">*</span>}
      </label>
      {children}
      {hint && <p className="v2-auth-hint">{hint}</p>}
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
