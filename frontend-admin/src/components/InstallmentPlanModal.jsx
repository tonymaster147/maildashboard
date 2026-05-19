import { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

const todayPlusDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function InstallmentPlanModal({ order, onClose, onCreated }) {
  const { createInstallmentPlan } = useApi();
  const remaining = parseFloat(order.amount_remaining || 0);
  const [count, setCount] = useState(2);
  const [splitMode, setSplitMode] = useState('equal');
  const [feeType, setFeeType] = useState('flat');
  const [feeValue, setFeeValue] = useState(0);
  const [installments, setInstallments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Compute fee amount
  const feeAmount = feeType === 'percent'
    ? Math.round(remaining * (parseFloat(feeValue) || 0)) / 100
    : Math.round((parseFloat(feeValue) || 0) * 100) / 100;
  const totalWithFee = remaining + feeAmount;

  // Auto-populate installments when count or mode changes
  useEffect(() => {
    if (splitMode === 'equal') {
      const per = Math.floor((totalWithFee / count) * 100) / 100;
      const last = Math.round((totalWithFee - per * (count - 1)) * 100) / 100;
      const arr = Array.from({ length: count }, (_, i) => ({
        amount: i === count - 1 ? last : per,
        due_date: todayPlusDays((i + 1) * 30)
      }));
      setInstallments(arr);
    } else {
      // Manual mode: keep amounts if user already entered them; otherwise default to 0
      setInstallments(prev => {
        const arr = Array.from({ length: count }, (_, i) => prev[i] || { amount: 0, due_date: todayPlusDays((i + 1) * 30) });
        return arr;
      });
    }
  }, [count, splitMode, totalWithFee]);

  const updateInstallment = (idx, field, value) => {
    setInstallments(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const sumAmounts = installments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const isValid = Math.abs(sumAmounts - totalWithFee) < 0.5 && installments.every(i => i.amount && i.due_date);

  const submit = async () => {
    setError('');
    if (!isValid) {
      setError(`Sum ($${sumAmounts.toFixed(2)}) must equal remaining + fee ($${totalWithFee.toFixed(2)})`);
      return;
    }
    setSubmitting(true);
    try {
      await createInstallmentPlan(order.id, {
        installments: installments.map(i => ({ amount: parseFloat(i.amount), due_date: i.due_date })),
        convenience_fee: parseFloat(feeValue) || 0,
        fee_type: feeType,
        split_mode: splitMode
      });
      onCreated();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create plan');
    }
    setSubmitting(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div className="card" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Split into Installments — Order #{order.id}</h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}><FiX size={16} /></button>
        </div>

        <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Outstanding balance</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>${remaining.toFixed(2)}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="form-label">Number of Installments</label>
            <select className="form-select" value={count} onChange={e => setCount(parseInt(e.target.value))}>
              {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Split Mode</label>
            <select className="form-select" value={splitMode} onChange={e => setSplitMode(e.target.value)}>
              <option value="equal">Equal Split</option>
              <option value="manual">Manual Amounts</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
          <label className="form-label">Convenience Fee (optional)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" type="number" min="0" step="0.01" value={feeValue} onChange={e => setFeeValue(e.target.value)} style={{ flex: 1 }} placeholder="0" />
            <select className="form-select" value={feeType} onChange={e => setFeeType(e.target.value)} style={{ width: 100 }}>
              <option value="flat">$ Flat</option>
              <option value="percent">% Percent</option>
            </select>
          </div>
          {feeAmount > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              Fee: <strong style={{ color: 'var(--warning)' }}>${feeAmount.toFixed(2)}</strong> &nbsp;|&nbsp; New total: <strong style={{ color: 'var(--accent)' }}>${totalWithFee.toFixed(2)}</strong>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Installments</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {installments.map((it, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>#{idx + 1}</span>
                <input className="form-input" type="number" min="0" step="0.01" value={it.amount} onChange={e => updateInstallment(idx, 'amount', e.target.value)} disabled={splitMode === 'equal'} placeholder="Amount" />
                <input className="form-input" type="date" value={it.due_date} onChange={e => updateInstallment(idx, 'due_date', e.target.value)} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: isValid ? 'var(--success)' : 'var(--warning)' }}>
            Sum: ${sumAmounts.toFixed(2)} / Expected: ${totalWithFee.toFixed(2)}
          </div>
        </div>

        {error && <div className="toast toast-error" style={{ position: 'relative', marginBottom: 12 }}>{error}</div>}

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={submit} disabled={!isValid || submitting}>
          {submitting ? <div className="loading-spinner" style={{ width: 18, height: 18 }}></div> : `Create ${count} Installments`}
        </button>
      </div>
    </div>
  );
}
