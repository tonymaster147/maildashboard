import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';
import Notice from './Notice';

export default function EditInstallmentModal({ orderId, orderCode, installments, onClose, onSaved }) {
  const { updateInstallmentPlan } = useApi();
  const paid = installments.filter(i => i.status === 'paid');
  const unpaid = installments.filter(i => i.status !== 'paid');
  const fixedUnpaidSum = unpaid.reduce((s, i) => s + parseFloat(i.amount), 0);

  const [edits, setEdits] = useState(
    unpaid.map(i => ({
      id: i.id,
      installment_number: i.installment_number,
      amount: parseFloat(i.amount).toFixed(2),
      due_date: i.due_date.slice(0, 10) // YYYY-MM-DD
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (idx, field, value) => {
    setEdits(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const sumNow = edits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const isValid = Math.abs(sumNow - fixedUnpaidSum) < 0.5 && edits.every(e => e.amount && e.due_date);

  const submit = async () => {
    setError('');
    if (!isValid) {
      setError(`Sum ($${sumNow.toFixed(2)}) must equal $${fixedUnpaidSum.toFixed(2)}`);
      return;
    }
    setSubmitting(true);
    try {
      await updateInstallmentPlan(orderId, {
        installments: edits.map(e => ({ id: e.id, amount: parseFloat(e.amount), due_date: e.due_date }))
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update plan');
    }
    setSubmitting(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div className="card" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Edit Installment Plan — Order {orderCode || `#${orderId}`}</h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><FiX size={16} /></button>
        </div>

        {paid.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid #16a34a', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 6 }}>ALREADY PAID (read-only)</div>
            {paid.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0' }}>
                <span>#{p.installment_number} · {new Date(p.due_date).toLocaleDateString()}</span>
                <span>${parseFloat(p.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unpaid total (fixed, must match)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>${fixedUnpaidSum.toFixed(2)}</div>
        </div>

        <label className="form-label">Edit unpaid installments</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {edits.map((e, idx) => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>#{e.installment_number}</span>
              <input className="form-input" type="number" min="0" step="0.01" value={e.amount} onChange={ev => update(idx, 'amount', ev.target.value)} placeholder="Amount" />
              <input className="form-input" type="date" value={e.due_date} onChange={ev => update(idx, 'due_date', ev.target.value)} />
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, color: isValid ? 'var(--success)' : 'var(--warning)', marginBottom: 12 }}>
          Sum: ${sumNow.toFixed(2)} / Expected: ${fixedUnpaidSum.toFixed(2)}
        </div>

        {error && <Notice type="error" style={{ marginBottom: 12 }}>{error}</Notice>}

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={submit} disabled={!isValid || submitting}>
          {submitting ? <div className="loading-spinner" style={{ width: 18, height: 18 }}></div> : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
