// Signup — v2 split-screen auth shell. Country-code picker + auto-detect via
// getPublicGeo + access-code email flow are preserved verbatim.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUserPlus } from 'react-icons/fi';
import { signup, getPublicGeo } from '../services/api';
import { useSiteBranding } from '../context/SiteBrandingContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { COUNTRY_CODES, DEFAULT_DIAL, findByIso } from '../utils/countryCodes';
import Notice from '../components/Notice';
import { C } from '../theme/tokens';
import { AuthShell } from '../components/ui';

export default function Signup() {
  usePageMeta('signup');
  const brand = useSiteBranding();
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
      title="Create your account"
      subtitle={`Start your first order on ${brand.name} in under a minute.`}
      heroTitle="Get matched with a tutor in minutes."
      heroSubtitle="Sign up free — pay only when you place an order. Your access code arrives by email."
      bullets={[
        'Free to sign up — no card required',
        'Subject-matched tutors with proven results',
        'All work delivered plagiarism- and AI-free',
      ]}
    >
      {error && <Notice type="error">{error}</Notice>}

      <form onSubmit={handleSubmit}>
        <Field label="Username" required>
          <input
            type="text" className="form-input" placeholder="Choose a username"
            value={username} onChange={e => setUsername(e.target.value)}
            required minLength={3} autoComplete="username"
          />
        </Field>

        <Field label="Email" required hint="Your access code will be sent here.">
          <input
            type="email" className="form-input" placeholder="your@email.com"
            value={email} onChange={e => setEmail(e.target.value)}
            required autoComplete="email"
          />
        </Field>

        <Field label="Full Name" required>
          <input
            type="text" className="form-input" placeholder="Your full name"
            value={name} onChange={e => setName(e.target.value)}
            required minLength={2} maxLength={100} autoComplete="name"
          />
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
            <input
              type="tel" className="form-input" placeholder="555 123 4567"
              value={phone} onChange={e => setPhone(e.target.value)}
              required
              pattern="^[0-9\s\-()]{6,18}$"
              title="Enter a valid phone number (digits, spaces, -, parentheses)"
              style={{ flex: 1 }}
              autoComplete="tel-national"
            />
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
    <div style={{ marginBottom: 14 }}>
      <label style={fieldLabelStyle}>
        {label} {required && <span style={{ color: C.red }}>*</span>}
      </label>
      {children}
      {hint && (
        <p style={{ color: C.textMuted, fontSize: 11, margin: '6px 0 0' }}>{hint}</p>
      )}
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
