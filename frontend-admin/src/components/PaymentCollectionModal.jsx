import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import Notice from './Notice';

const todayStr = () => new Date().toISOString().split('T')[0];

// Generic payment-details collector. Used for: Unpaid→Paid (full/partial),
// Mark Remaining Paid, and marking installment(s) paid. The parent supplies an
// async `onSubmit(payment)` that performs the actual API call; this modal only
// collects + validates the fields. It stays open and shows the error if
// onSubmit throws; the parent unmounts it on success.
export default function PaymentCollectionModal({
  title,
  subtitle,
  amountLabel = 'Amount',
  amount: amountProp = 0,
  amountEditable = true,
  maxAmount,
  noteRequiredWhenDifferent = true,
  showRemaining = false,
  remainingBase = 0,
  submitLabel = 'Save Payment',
  onSubmit,
  onClose,
}) {
  const cap = maxAmount != null ? maxAmount : parseFloat(amountProp) || 0;
  const expected = parseFloat(amountProp) || 0;

  const [mode, setMode] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [payDate, setPayDate] = useState(todayStr());
  const [amount, setAmount] = useState((parseFloat(amountProp) || 0).toFixed(2));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amt = amountEditable ? parseFloat(amount) : expected;
  const validAmt = Number.isFinite(amt) && amt > 0 && amt <= cap + 0.001;
  const remaining = showRemaining && validAmt ? Math.max(0, Math.round((remainingBase - amt) * 100) / 100) : null;
  const noteRequired = amountEditable && noteRequiredWhenDifferent && validAmt && Math.abs(amt - expected) > 0.001;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!mode.trim()) return setError('Mode of communication is required.');
    if (!invoiceNo.trim()) return setError('Invoice number is required.');
    if (!payDate) return setError('Date of payment is required.');
    if (amountEditable && !validAmt) return setError(`Enter a valid amount between 0 and $${cap.toFixed(2)}.`);
    if (noteRequired && !note.trim()) return setError('A note is required when the amount differs from the expected amount.');

    setSubmitting(true);
    try {
      await onSubmit({
        mode_of_communication: mode.trim(),
        invoice_no: invoiceNo.trim(),
        payment_date: payDate,
        amount: amt,
        note: note.trim(),
      });
      // parent unmounts the modal on success
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <form className="card" onSubmit={submit} style={{ width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}><FiX size={16} /></button>
        </div>
        {subtitle && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>{subtitle}</p>
        )}

        <div className="form-group">
          <label className="form-label">Mode of communication *</label>
          <input className="form-input" value={mode} onChange={e => setMode(e.target.value)} placeholder="e.g. WhatsApp, Phone call, Email" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Invoice No *</label>
            <input className="form-input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-0001" />
          </div>
          <div className="form-group">
            <label className="form-label">Date of payment *</label>
            <input className="form-input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} max={todayStr()} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: showRemaining ? '1fr 1fr' : '1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">{amountLabel}{amountEditable ? ' *' : ''}</label>
            <input
              className="form-input" type="number" min="0" step="0.01" max={cap}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={!amountEditable}
            />
          </div>
          {showRemaining && (
            <div className="form-group">
              <label className="form-label">Remaining</label>
              <input className="form-input" value={remaining != null ? `$${remaining.toFixed(2)}` : '—'} readOnly disabled />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Note {noteRequired && <span style={{ color: 'var(--error)' }}>*</span>}</label>
          <textarea className="form-input" rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder={noteRequired ? 'Required — explain why the amount differs' : 'Optional'} />
        </div>

        {showRemaining && remaining > 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -4, marginBottom: 12 }}>
            After saving, you can split the remaining <strong>${remaining.toFixed(2)}</strong> into installments (optional).
          </p>
        )}

        {error && <Notice type="error" style={{ marginBottom: 12 }}>{error}</Notice>}

        <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? <div className="loading-spinner" style={{ width: 18, height: 18 }} /> : submitLabel}
        </button>
      </form>
    </div>
  );
}
