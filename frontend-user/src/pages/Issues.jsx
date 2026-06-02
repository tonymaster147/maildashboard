import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiAlertCircle, FiMessageSquare } from 'react-icons/fi';
import { getMyIssues, createIssue, getIssueCategories, getUserOrders } from '../services/api';
import Notice from '../components/Notice';

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ category: '', order_id: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getMyIssues().then(r => { setIssues(r.data.issues || []); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { getIssueCategories().then(r => setCategories(r.data.categories || [])).catch(() => {}); }, []);
  useEffect(() => { getUserOrders().then(r => setOrders(r.data || [])).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.category) { setError('Pick a category'); return; }
    if (!form.description.trim() || form.description.trim().length < 5) { setError('Describe the issue (at least 5 characters)'); return; }
    setSubmitting(true);
    try {
      await createIssue({
        category: form.category,
        order_id: form.order_id || null,
        description: form.description.trim()
      });
      setForm({ category: '', order_id: '', description: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Issues</h2>
          <p>Open a support ticket and chat with our team.</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <FiPlus size={16} /> New Issue
          </button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h4 style={{ marginBottom: 16 }}>Create a new issue</h4>
          {error && <Notice type="error">{error}</Notice>}
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
                <option value="">Select…</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Related Order <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>(optional)</span></label>
              <select className="form-input" value={form.order_id} onChange={e => setForm({ ...form, order_id: e.target.value })}>
                <option value="">— None —</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.order_code || `#${o.id}`} — {o.course_name || 'Untitled'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Describe the issue *</label>
              <textarea
                className="form-input"
                rows={5}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Tell us what's going on. Be as specific as you can."
                required
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Submit Issue'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setError(''); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex-center" style={{ padding: 40 }}><div className="loading-spinner" /></div>
      ) : issues.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 40px' }}>
          <FiAlertCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h3 style={{ marginBottom: 8 }}>No issues yet</h3>
          <p style={{ color: 'var(--text-muted)' }}>If you run into anything, hit "New Issue" up top.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {issues.map(i => (
            <Link
              key={i.id}
              to={`/issues/${i.id}`}
              className="card"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: 16 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{i.id}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.3,
                  background: i.status === 'open' ? 'rgba(34,197,94,0.12)' : 'rgba(127,127,127,0.12)',
                  color: i.status === 'open' ? '#16a34a' : 'var(--text-muted)'
                }}>{i.status}</span>
                <span style={{ fontWeight: 600 }}>{i.subject}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(i.last_message_at || i.created_at).toLocaleString()}
                </span>
              </div>
              {i.last_message && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <FiMessageSquare size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  {i.last_message_role === 'user' ? 'You' : 'Support'}: {i.last_message}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
