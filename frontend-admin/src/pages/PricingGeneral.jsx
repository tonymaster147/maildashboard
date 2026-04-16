import { useState, useEffect } from 'react';
import { FiSave, FiEdit2, FiDollarSign } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

export default function PricingGeneral() {
  const { getPricingRules, updateUrgentFee } = useApi();
  const [urgentFee, setUrgentFee] = useState(75);
  const [editing, setEditing] = useState(false);
  const [urgentInput, setUrgentInput] = useState('75');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPricingRules().then(res => {
      setUrgentFee(res.data.urgentFee);
      setUrgentInput(String(res.data.urgentFee));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await updateUrgentFee({ price: parseFloat(urgentInput) });
      setUrgentFee(parseFloat(urgentInput));
      setEditing(false);
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>General Pricing Settings</h2>
        <p>Manage global pricing configuration</p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <h4 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiDollarSign /> Urgent Fee
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          This flat fee is added when the customer marks their order as urgent (due before midnight today).
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Urgent Surcharge:</span>
          {editing ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>$</span>
                <input type="number" step="0.01" className="form-input" value={urgentInput} onChange={e => setUrgentInput(e.target.value)} style={{ width: 100, padding: '6px 10px', fontSize: 16, fontWeight: 700 }} />
              </div>
              <button className="btn btn-sm btn-primary" onClick={handleSave}><FiSave size={14} /> Save</button>
              <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(false); setUrgentInput(String(urgentFee)); }}>Cancel</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>${urgentFee.toFixed(2)}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}><FiEdit2 size={14} /> Edit</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
