import { useState, useEffect } from 'react';
import { FiSave, FiEye, FiEyeOff } from 'react-icons/fi';
import { C } from '../../theme/tokens';
import { updateOrderLoginDetails } from '../../services/api';
import Modal from './Modal';

// UpdateCredentialModal — opens the per-order login details editor.
// Wraps the same updateOrderLoginDetails API call used by OrderDetail's
// inline form, so both surfaces stay in sync.
//
// Props:
//   open      — controlled open state
//   onClose   — close handler
//   order     — { id, order_code, school_url, school_username, school_password }
//   onSaved   — called after successful save (parent re-fetches data)
export default function UpdateCredentialModal({ open, onClose, order, onSaved }) {
  const [form, setForm] = useState({ school_url: '', school_username: '', school_password: '' });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && order) {
      setForm({
        school_url:      order.school_url      || '',
        school_username: order.school_username || '',
        school_password: order.school_password || '',
      });
      setShowPass(false);
      setError('');
    }
  }, [open, order]);

  const submit = async (e) => {
    e.preventDefault();
    if (!order?.id) return;
    setSaving(true);
    setError('');
    try {
      await updateOrderLoginDetails(order.id, form);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={order ? `Update Credentials — ${order.order_code || `#${order.id}`}` : 'Update Credentials'}
      width={460}
    >
      {error && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, marginBottom: 14,
          background: C.redSoft, color: C.red, fontSize: 13, fontWeight: 600,
        }}>
          {error}
        </div>
      )}
      <form onSubmit={submit}>
        <Field
          label="Portal URL"
          placeholder="https://school-portal.example.com"
          value={form.school_url}
          onChange={v => setForm(f => ({ ...f, school_url: v }))}
        />
        <Field
          label="Username"
          placeholder="your school username"
          value={form.school_username}
          onChange={v => setForm(f => ({ ...f, school_username: v }))}
        />
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={form.school_password}
              onChange={e => setForm(f => ({ ...f, school_password: e.target.value }))}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 40px 10px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: 14,
                background: C.surface,
                color: C.textPrimary,
                outline: 'none',
                fontFamily: 'ui-monospace, monospace',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              title={showPass ? 'Hide' : 'Show'}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted,
                padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button" onClick={onClose} disabled={saving}
            style={{
              padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.surface, color: C.textPrimary, cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="submit" disabled={saving}
            style={{
              padding: '10px 16px', borderRadius: 8, border: 'none',
              background: C.accent, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <FiSave size={14} /> {saving ? 'SAVING…' : 'SAVE CREDENTIALS'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          fontSize: 14,
          background: C.surface,
          color: C.textPrimary,
          outline: 'none',
          fontFamily: 'ui-monospace, monospace',
        }}
      />
    </div>
  );
}
