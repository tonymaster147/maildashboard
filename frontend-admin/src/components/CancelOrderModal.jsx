import { useState, useEffect } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

/**
 * Required-note modal shown when admin/sales flips an order to "Cancelled".
 * Calls onConfirm(note) with the trimmed note, or onCancel() to close.
 */
export default function CancelOrderModal({ orderId, onConfirm, onCancel, submitting }) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !submitting) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submitting, onCancel]);

  return (
    <div
      onClick={() => !submitting && onCancel()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: 20
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{ width: 480, maxWidth: '100%' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <FiAlertTriangle size={22} style={{ color: '#dc2626', flexShrink: 0 }} />
          <h3 style={{ margin: 0 }}>Cancel Order #{orderId}</h3>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="btn btn-sm btn-secondary"
            style={{ marginLeft: 'auto' }}
            title="Close"
          >
            <FiX size={14} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          A reason is required before cancelling. This note is saved with the order for future reference.
        </p>

        <div className="form-group">
          <label className="form-label">Notes <span style={{ color: 'var(--danger, #dc2626)' }}>*</span></label>
          <textarea
            className="form-input"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Explain why this order is being cancelled…"
            rows={4}
            autoFocus
            disabled={submitting}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            Keep Order
          </button>
          <button
            className="btn btn-primary"
            style={{ background: '#dc2626', borderColor: '#dc2626' }}
            onClick={() => onConfirm(trimmed)}
            disabled={!trimmed || submitting}
          >
            {submitting ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
