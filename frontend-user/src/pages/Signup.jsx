import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup, getPublicGeo } from '../services/api';
import { FiUserPlus } from 'react-icons/fi';
import { useSiteBranding } from '../context/SiteBrandingContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { COUNTRY_CODES, DEFAULT_DIAL, findByIso } from '../utils/countryCodes';
import Notice from '../components/Notice';

export default function Signup() {
  usePageMeta('signup');
  const brand = useSiteBranding();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
      await signup({ username, email, phone: fullPhone });
      navigate('/login', {
        state: { signupSuccess: true, message: 'Account created! Your access code has been emailed to you.' },
        replace: true
      });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Signup failed');
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
          <h1>Create Account</h1>
          <p className="subtitle">Get started with {brand.name}</p>
        </div>

        {error && <Notice type="error">{error}</Notice>}

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
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="form-input"
                value={dialCode}
                onChange={e => setDialCode(e.target.value)}
                style={{ flex: '0 0 110px', paddingRight: 4 }}
                aria-label="Country code"
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.iso} value={c.dial}>{c.iso} {c.dial}</option>
                ))}
              </select>
              <input
                type="tel"
                className="form-input"
                placeholder="555 123 4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                pattern="^[0-9\s\-()]{6,18}$"
                title="Enter a valid phone number (digits, spaces, -, parentheses)"
                style={{ flex: 1 }}
              />
            </div>
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
