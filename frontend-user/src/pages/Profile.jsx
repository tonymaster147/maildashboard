import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { changePassword, requestEmailChange, verifyEmailChange } from '../services/api';
import { FiSave, FiUser, FiMail, FiCalendar, FiSend, FiCheck } from 'react-icons/fi';
import Notice from '../components/Notice';

export default function Profile() {
  const { user, refreshUser } = useAuth();

  // Access code form
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Email change form
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailStep, setEmailStep] = useState('idle'); // idle | code-sent
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (newCode !== confirmCode) { setError('Access codes do not match'); return; }
    if (newCode.length < 4) { setError('Access code must be at least 4 characters'); return; }
    setLoading(true);
    try {
      await changePassword({ current_access_code: currentCode, new_access_code: newCode });
      setMessage('Access code updated successfully!');
      setCurrentCode(''); setNewCode(''); setConfirmCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEmailCode = async (e) => {
    e.preventDefault();
    setEmailMessage('');
    setEmailError('');
    setEmailLoading(true);
    try {
      await requestEmailChange({ new_email: newEmail });
      setEmailStep('code-sent');
      setEmailMessage(`Verification code sent to ${newEmail}. Check your inbox.`);
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Failed to send code');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e) => {
    e.preventDefault();
    setEmailMessage('');
    setEmailError('');
    setEmailLoading(true);
    try {
      const res = await verifyEmailChange({ code: emailCode });
      setEmailMessage('Email updated successfully!');
      setEmailStep('idle');
      setNewEmail('');
      setEmailCode('');
      await refreshUser();
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Failed to verify');
    } finally {
      setEmailLoading(false);
    }
  };

  const cancelEmailChange = () => {
    setEmailStep('idle');
    setEmailCode('');
    setEmailError('');
    setEmailMessage('');
  };

  return (
    <div>
      <div className="page-header">
        <h2>Profile</h2>
        <p>Manage your account settings</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 20 }}>Account Information</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <FiUser size={18} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Username</div>
                <div style={{ fontWeight: 600 }}>{user?.username}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <FiMail size={18} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email</div>
                <div style={{ fontWeight: 600 }}>{user?.email || 'Not provided'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <FiCalendar size={18} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Member Since</div>
                <div style={{ fontWeight: 600 }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 20 }}>Change Access Code</h4>
          {message && <Notice type="success">{message}</Notice>}
          {error && <Notice type="error">{error}</Notice>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Current Access Code</label>
              <input type="password" className="form-input" value={currentCode} onChange={e => setCurrentCode(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">New Access Code</label>
              <input type="password" className="form-input" value={newCode} onChange={e => setNewCode(e.target.value)} required minLength={4} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Access Code</label>
              <input type="password" className="form-input" value={confirmCode} onChange={e => setConfirmCode(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> : <><FiSave size={16} /> Update</>}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h4 style={{ marginBottom: 8 }}>Change Email</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          We'll send a 6-digit verification code to the new address. Your email won't change until you enter the code.
        </p>
        {emailMessage && <Notice type="success">{emailMessage}</Notice>}
        {emailError && <Notice type="error">{emailError}</Notice>}

        {emailStep === 'idle' && (
          <form onSubmit={handleRequestEmailCode}>
            <div className="form-group">
              <label className="form-label">New Email Address</label>
              <input
                type="email"
                className="form-input"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={emailLoading}>
              {emailLoading ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> : <><FiSend size={16} /> Send Verification Code</>}
            </button>
          </form>
        )}

        {emailStep === 'code-sent' && (
          <form onSubmit={handleVerifyEmailCode}>
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="form-input"
                value={emailCode}
                onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                required
                autoFocus
                style={{ letterSpacing: 6, fontFamily: 'monospace', fontSize: 18 }}
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Sent to <strong>{newEmail}</strong>. Code expires in 15 minutes.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={emailLoading || emailCode.length !== 6} style={{ flex: 1 }}>
                {emailLoading ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> : <><FiCheck size={16} /> Verify & Update</>}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelEmailChange} disabled={emailLoading}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
