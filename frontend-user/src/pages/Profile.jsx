import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../services/api';
import { FiSave, FiUser, FiMail, FiCalendar } from 'react-icons/fi';

export default function Profile() {
  const { user } = useAuth();
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          {message && <div className="toast toast-success" style={{ position: 'relative', marginBottom: 16 }}>{message}</div>}
          {error && <div className="toast toast-error" style={{ position: 'relative', marginBottom: 16 }}>{error}</div>}
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
    </div>
  );
}
