// Issues — v2 styled. Create-issue API contract unchanged (category +
// optional order_id + description). Listing/polling behavior unchanged.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiAlertCircle, FiMessageSquare, FiX } from 'react-icons/fi';
import { getMyIssues, createIssue, getIssueCategories, getUserOrders } from '../services/api';
import Notice from '../components/Notice';
import { C } from '../theme/tokens';
import { Card, Pill } from '../components/ui';

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
    getMyIssues()
      .then(r => { setIssues(r.data.issues || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { getIssueCategories().then(r => setCategories(r.data.categories || [])).catch(() => {}); }, []);
  useEffect(() => { getUserOrders().then(r => setOrders(r.data || [])).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.category) { setError('Pick a category'); return; }
    if (!form.description.trim() || form.description.trim().length < 5) {
      setError('Describe the issue (at least 5 characters)');
      return;
    }
    setSubmitting(true);
    try {
      await createIssue({
        category: form.category,
        order_id: form.order_id || null,
        description: form.description.trim(),
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
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: 18, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 0.3 }}>
            Issues
          </h2>
          <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>
            Open a support ticket and chat with our team.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: C.accent, color: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              textTransform: 'uppercase',
            }}
          >
            <FiPlus size={14} /> New Issue
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Create a new issue
            </h3>
            <button
              type="button" onClick={() => { setShowForm(false); setError(''); }}
              aria-label="Close form"
              style={{
                marginLeft: 'auto', width: 30, height: 30, borderRadius: 8,
                border: 'none', background: '#f1f5f9', color: C.textSecondary, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiX size={14} />
            </button>
          </div>

          {error && <Notice type="error">{error}</Notice>}

          <form onSubmit={submit}>
            <div className="v2-form-grid">
              <Field label="Category" required>
                <select
                  className="form-select" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Related Order" optional>
                <select
                  className="form-select" value={form.order_id}
                  onChange={e => setForm({ ...form, order_id: e.target.value })}
                >
                  <option value="">— None —</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.order_code || `#${o.id}`} — {o.course_name || 'Untitled'}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Describe the issue" required>
              <textarea
                className="form-textarea"
                rows={5}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Tell us what's going on. Be as specific as you can."
                required
                style={{ resize: 'vertical' }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button" onClick={() => { setShowForm(false); setError(''); }}
                disabled={submitting}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                  background: C.surface, color: C.textPrimary, cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                }}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={submitting}
                style={{
                  padding: '10px 18px', borderRadius: 8, border: 'none',
                  background: C.accent, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting
                  ? <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  : 'Submit Issue'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
          <div className="loading-spinner" />
        </div>
      ) : issues.length === 0 ? (
        <Card style={{ padding: '50px 30px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: C.accentSoft, color: C.accent,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <FiAlertCircle size={24} />
          </div>
          <h3 style={{ color: C.textPrimary, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            No issues yet
          </h3>
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
            If you run into anything, hit <strong style={{ color: C.textPrimary }}>"New Issue"</strong> up top.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {issues.map(i => <IssueRow key={i.id} issue={i} />)}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }) {
  const isClosed = issue.status === 'closed';
  const ts = new Date(issue.last_message_at || issue.created_at);
  return (
    <Link
      to={`/issues/${issue.id}`}
      style={{
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 16, transition: C.transitionFast,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderStrong; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3 }}>
          #{issue.id}
        </span>
        <Pill
          bg={isClosed ? '#eef2f7' : C.greenSoft}
          color={isClosed ? C.textMuted : C.green}
        >
          {issue.status}
        </Pill>
        {issue.category && <Pill bg={C.accentSoft} color={C.accent}>{issue.category}</Pill>}
        <span style={{
          fontSize: 14, fontWeight: 700, color: C.textPrimary,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {issue.subject}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>
          {ts.toLocaleString()}
        </span>
      </div>
      {issue.last_message && (
        <div style={{
          fontSize: 12, color: C.textMuted, marginTop: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <FiMessageSquare size={11} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          <strong style={{ color: C.textSecondary, fontWeight: 600 }}>
            {issue.last_message_role === 'user' ? 'You' : 'Support'}:
          </strong>{' '}
          {issue.last_message}
        </div>
      )}
    </Link>
  );
}

function Field({ label, required, optional, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted,
        letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}{' '}
        {required && <span style={{ color: C.red }}>*</span>}
        {optional && <span style={{ color: C.textMuted, fontWeight: 500 }}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}
