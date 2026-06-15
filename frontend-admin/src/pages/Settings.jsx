import { useState, useEffect } from 'react';
import { FiSave, FiPlus, FiTrash2, FiShield, FiMail } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';
import StatusListEditor from '../components/StatusListEditor';

export default function Settings() {
  const { getSettings, updateNotificationEmails, updatePlan, createCoupon, deleteCoupon, getBannedWords, addBannedWord, deleteBannedWord } = useApi();
  const [settings, setSettings] = useState(null);
  const [bannedWords, setBannedWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCoupon, setNewCoupon] = useState({ code: '', discount_percent: '', max_uses: '', expires_at: '' });
  const [editingPlan, setEditingPlan] = useState(null);
  const [newPhrase, setNewPhrase] = useState('');
  const [notifEmails, setNotifEmails] = useState('');
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMsg, setNotifMsg] = useState(null);

  const fetchSettings = async () => {
    try {
      const [setRes, banRes] = await Promise.all([getSettings(), getBannedWords()]);
      setSettings(setRes.data);
      setNotifEmails(setRes.data.adminNotificationEmails || '');
      setBannedWords(banRes.data.banned_words);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchSettings(); }, []);

  const handleSaveNotifEmails = async (e) => {
    e.preventDefault();
    setSavingNotif(true);
    setNotifMsg(null);
    try {
      const res = await updateNotificationEmails({ emails: notifEmails });
      setNotifEmails(res.data.adminNotificationEmails);
      setNotifMsg({ type: 'success', text: 'Saved. Notifications will go to these addresses.' });
    } catch (err) {
      setNotifMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save' });
    } finally {
      setSavingNotif(false);
    }
  };

  const handlePlanSave = async (plan) => {
    await updatePlan(plan.id, plan);
    setEditingPlan(null);
    fetchSettings();
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      await createCoupon({ ...newCoupon, discount_percent: parseFloat(newCoupon.discount_percent), max_uses: newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null, expires_at: newCoupon.expires_at || null });
      setNewCoupon({ code: '', discount_percent: '', max_uses: '', expires_at: '' });
      fetchSettings();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    await deleteCoupon(id);
    fetchSettings();
  };

  const handleAddPhrase = async (e) => {
    e.preventDefault();
    if (!newPhrase.trim()) return;
    try {
      await addBannedWord({ word: newPhrase });
      setNewPhrase('');
      fetchSettings();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add phrase');
    }
  };

  const handleDeletePhrase = async (id) => {
    if (!window.confirm('Remove this phrase from the banned list?')) return;
    await deleteBannedWord(id);
    fetchSettings();
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header"><h2>Settings</h2><p>Manage plans, coupons, and chat security</p></div>

      {/* Admin Notification Emails */}
      <div className="card mb-3">
        <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiMail className="text-info" /> Notification Emails
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
          These addresses receive new-order, support-issue, and login-update emails. Add one or more, separated by commas.
        </p>
        <form onSubmit={handleSaveNotifEmails} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="faruqui.a4u@gmail.com, admin@example.com"
            value={notifEmails}
            onChange={e => setNotifEmails(e.target.value)}
            style={{ flex: 1, minWidth: 280 }}
          />
          <button type="submit" className="btn btn-primary" disabled={savingNotif}>
            <FiSave size={14} /> {savingNotif ? 'Saving…' : 'Save'}
          </button>
        </form>
        {notifMsg && (
          <p style={{ marginTop: 10, fontSize: 13, color: notifMsg.type === 'error' ? 'var(--error)' : 'var(--success, #16a34a)' }}>
            {notifMsg.text}
          </p>
        )}
      </div>

      {/* Plans */}
      <div className="card mb-3">
        <h3 style={{ marginBottom: 16 }}>Plans & Pricing</h3>
        <div className="table-container">
          <table>
            <thead><tr><th>Name</th><th>Price</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {settings?.plans?.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{editingPlan?.id === p.id ? <input className="form-input" value={editingPlan.name} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} style={{ padding: '4px 8px' }} /> : p.name}</td>
                  <td>{editingPlan?.id === p.id ? <input type="number" className="form-input" value={editingPlan.price} onChange={e => setEditingPlan({ ...editingPlan, price: e.target.value })} style={{ padding: '4px 8px', width: 100 }} /> : <span style={{ color: 'var(--accent)' }}>${parseFloat(p.price).toFixed(2)}</span>}</td>
                  <td style={{ maxWidth: 250 }}>{editingPlan?.id === p.id ? <input className="form-input" value={editingPlan.description} onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })} style={{ padding: '4px 8px' }} /> : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{p.description}</span>}</td>
                  <td><span className={`badge-status ${p.is_active ? 'badge-active' : 'badge-cancelled'}`}>{p.is_active ? 'Yes' : 'No'}</span></td>
                  <td>
                    {editingPlan?.id === p.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => handlePlanSave(editingPlan)}><FiSave size={12} /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditingPlan(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingPlan({ ...p })}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coupons */}
      <div className="card mb-3">
        <h3 style={{ marginBottom: 16 }}>Coupons</h3>
        <form onSubmit={handleCreateCoupon} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Code" value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })} required style={{ width: 120 }} />
          <input type="number" className="form-input" placeholder="Discount %" value={newCoupon.discount_percent} onChange={e => setNewCoupon({ ...newCoupon, discount_percent: e.target.value })} required style={{ width: 100 }} />
          <input type="number" className="form-input" placeholder="Max Uses" value={newCoupon.max_uses} onChange={e => setNewCoupon({ ...newCoupon, max_uses: e.target.value })} style={{ width: 100 }} />
          <input type="datetime-local" className="form-input" value={newCoupon.expires_at} onChange={e => setNewCoupon({ ...newCoupon, expires_at: e.target.value })} style={{ width: 200 }} />
          <button type="submit" className="btn btn-primary btn-sm"><FiPlus size={14} /> Add</button>
        </form>
        <div className="table-container">
          <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Used/Max</th><th>Expires</th><th>Active</th><th>Action</th></tr></thead>
            <tbody>
              {settings?.coupons?.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.code}</td>
                  <td style={{ color: 'var(--accent)' }}>{c.discount_percent}%</td>
                  <td>{c.used_count}/{c.max_uses || '∞'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}</td>
                  <td><span className={`badge-status ${c.is_active ? 'badge-active' : 'badge-cancelled'}`}>{c.is_active ? 'Yes' : 'No'}</span></td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => handleDeleteCoupon(c.id)}><FiTrash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Banned Phrases */}
      <div className="card mb-3">
        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiShield className="text-warning" /> Chat Security & Banned Phrases
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
          Any chat messages containing these phrases will be automatically censored (replaced with ***) and flagged for review. Phone numbers and email structures (like *@*.com) are already blocked by default.
        </p>
        <form onSubmit={handleAddPhrase} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="form-input" placeholder="Enter word or phrase (e.g., 'contact me')" value={newPhrase} onChange={e => setNewPhrase(e.target.value)} required style={{ maxWidth: 300 }} />
          <button type="submit" className="btn btn-primary btn-sm"><FiPlus size={14} /> Add Pattern</button>
        </form>
        
        {bannedWords.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {bannedWords.map(bw => (
              <div key={bw.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 500 }}>"{bw.word}"</span>
                <button 
                  onClick={() => handleDeletePhrase(bw.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Remove"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, fontStyle: 'italic' }}>No custom banned phrases configured.</p>
        )}
      </div>

      {/* Order Types & Subjects (read only display) */}
      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 12 }}>Order Types ({settings?.orderTypes?.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {settings?.orderTypes?.map(t => <span key={t.id} className="badge-status badge-active">{t.name}</span>)}
          </div>
        </div>
        <div className="card">
          <h4 style={{ marginBottom: 12 }}>Education Levels ({settings?.educationLevels?.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {settings?.educationLevels?.map(l => <span key={l.id} className="badge-status badge-completed">{l.name}</span>)}
          </div>
        </div>
      </div>

      {/* Order Status lists (editable) */}
      <div className="grid-2" style={{ marginTop: 24 }}>
        <StatusListEditor kind="admin" title="Admin Order Statuses" accent="#84c225" />
        <StatusListEditor kind="tutor" title="Tutor Work Statuses"  accent="#2563eb" />
      </div>
    </div>
  );
}
