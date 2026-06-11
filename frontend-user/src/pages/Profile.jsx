// Profile — v2 styled. Access-code change + email-change OTP flow are
// preserved verbatim. Wording stays "Access Code" (not "password").

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { changePassword, requestEmailChange, verifyEmailChange } from '../services/api';
import {
  FiSave, FiUser, FiMail, FiCalendar, FiSend, FiCheck, FiKey, FiEdit3,
} from 'react-icons/fi';
import Notice from '../components/Notice';
import { C } from '../theme/tokens';
import { Card, Avatar, initialsFrom } from '../components/ui';

export default function Profile() {
  const { user, refreshUser } = useAuth();

  // Access code form state
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Email change form state
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
      await verifyEmailChange({ code: emailCode });
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

  const displayName = user?.name || user?.username || 'Student';

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 0.3 }}>
          Profile
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>
          Manage your account, access code, and email address.
        </p>
      </div>

      {/* Two-column: Account Info + Change Access Code */}
      <div className="v2-detail-grid">
        {/* Account Info */}
        <Card>
          <SectionTitle icon={FiUser}>Account Information</SectionTitle>

          {/* Avatar + display name */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
            padding: 14, borderRadius: 10, background: C.surfaceHover,
            border: `1px solid ${C.border}`,
          }}>
            <Avatar initials={initialsFrom(displayName)} size={50} bg={C.accentSoft} color={C.accent} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              {user?.email && (
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InfoRow icon={FiUser} label="Username" value={user?.username} />
            {user?.name && <InfoRow icon={FiEdit3} label="Name" value={user.name} />}
            <InfoRow icon={FiMail} label="Email" value={user?.email || 'Not provided'} />
            <InfoRow
              icon={FiCalendar}
              label="Member Since"
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            />
          </div>
        </Card>

        {/* Change Access Code */}
        <Card>
          <SectionTitle icon={FiKey}>Change Access Code</SectionTitle>
          {message && <Notice type="success">{message}</Notice>}
          {error && <Notice type="error">{error}</Notice>}
          <form onSubmit={handleSubmit}>
            <Field label="Current Access Code">
              <input
                type="password" className="form-input"
                value={currentCode}
                onChange={e => setCurrentCode(e.target.value)}
                required
              />
            </Field>
            <Field label="New Access Code">
              <input
                type="password" className="form-input"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                required minLength={4}
              />
            </Field>
            <Field label="Confirm New Access Code">
              <input
                type="password" className="form-input"
                value={confirmCode}
                onChange={e => setConfirmCode(e.target.value)}
                required
              />
            </Field>
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '11px 20px', borderRadius: 10,
                border: 'none', background: C.accent, color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                : <><FiSave size={14} /> Update Access Code</>}
            </button>
          </form>
        </Card>
      </div>

      {/* Change Email (full width) */}
      <Card style={{ marginTop: 14 }}>
        <SectionTitle icon={FiMail}>Change Email</SectionTitle>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
          We'll send a 6-digit verification code to the new address. Your email won't change until you enter the code.
        </p>
        {emailMessage && <Notice type="success">{emailMessage}</Notice>}
        {emailError && <Notice type="error">{emailError}</Notice>}

        {emailStep === 'idle' && (
          <form onSubmit={handleRequestEmailCode}>
            <Field label="New Email Address">
              <input
                type="email" className="form-input"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
              />
            </Field>
            <button
              type="submit" disabled={emailLoading}
              style={{
                padding: '11px 20px', borderRadius: 10, border: 'none',
                background: C.accent, color: '#fff',
                cursor: emailLoading ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                opacity: emailLoading ? 0.7 : 1,
              }}
            >
              {emailLoading
                ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                : <><FiSend size={14} /> Send Verification Code</>}
            </button>
          </form>
        )}

        {emailStep === 'code-sent' && (
          <form onSubmit={handleVerifyEmailCode}>
            <Field label="Verification Code">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="form-input"
                value={emailCode}
                onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                autoFocus
                style={{
                  letterSpacing: 8, fontFamily: 'ui-monospace, monospace',
                  fontSize: 22, textAlign: 'center', fontWeight: 700,
                }}
              />
              <p style={{ fontSize: 11, color: C.textMuted, margin: '6px 0 0' }}>
                Sent to <strong style={{ color: C.textSecondary }}>{newEmail}</strong>. Code expires in 15 minutes.
              </p>
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={emailLoading || emailCode.length !== 6}
                style={{
                  flex: 1, padding: '11px 20px', borderRadius: 10, border: 'none',
                  background: C.accent, color: '#fff',
                  cursor: (emailLoading || emailCode.length !== 6) ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: (emailLoading || emailCode.length !== 6) ? 0.6 : 1,
                }}
              >
                {emailLoading
                  ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  : <><FiCheck size={14} /> Verify &amp; Update</>}
              </button>
              <button
                type="button" onClick={cancelEmailChange} disabled={emailLoading}
                style={{
                  padding: '11px 20px', borderRadius: 10,
                  border: `1px solid ${C.border}`, background: C.surface, color: C.textPrimary,
                  cursor: emailLoading ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────
function SectionTitle({ icon: Icon, children }) {
  return (
    <h3 style={{
      fontSize: 13, fontWeight: 800, color: C.textPrimary, margin: '0 0 16px',
      letterSpacing: 0.5, textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {Icon && <Icon size={14} color={C.accent} />}
      {children}
    </h3>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted,
          letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
        }}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', background: C.surfaceHover,
      border: `1px solid ${C.border}`, borderRadius: 8,
    }}>
      <Icon size={16} style={{ color: C.textMuted, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: C.textPrimary, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}
