import { useState, useEffect } from 'react';
import { getAllSalesUsers, createSalesUser, updateSalesUser, deleteSalesUser } from '../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiShield } from 'react-icons/fi';

const AVAILABLE_MENUS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'tutors', label: 'Tutors' },
  { key: 'orders', label: 'Orders' },
  { key: 'chats', label: 'Chat Monitor' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
];

export default function SalesTeam() {
  const [salesUsers, setSalesUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales_executive', status: 'active', permissions: [] });

  const fetchSalesUsers = () => {
    getAllSalesUsers().then(res => { setSalesUsers(res.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { fetchSalesUsers(); }, []);

  const openAdd = () => {
    setForm({ name: '', email: '', password: '', role: 'sales_executive', status: 'active', permissions: ['dashboard', 'orders'] });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      status: u.status,
      permissions: u.permissions || []
    });
    setEditing(u.id);
    setShowModal(true);
  };

  const togglePermission = (key) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const data = { ...form };
        if (!data.password) delete data.password;
        await updateSalesUser(editing, data);
      } else {
        await createSalesUser(form);
      }
      setShowModal(false);
      fetchSalesUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sales user?')) return;
    await deleteSalesUser(id);
    fetchSalesUsers();
  };

  const getRoleLabel = (role) => role === 'sales_lead' ? 'Team Lead' : 'Executive';
  const getRoleColor = (role) => role === 'sales_lead' ? '#f59e0b' : '#3b82f6';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div><h2>Sales Team Management</h2><p style={{ color: 'var(--text-secondary)' }}>Add, edit, and manage sales team members</p></div>
        <button className="btn btn-primary" onClick={openAdd}><FiPlus size={16} /> Add Sales User</button>
      </div>
      {loading ? <div className="flex-center"><div className="loading-spinner"></div></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Permissions</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {salesUsers.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No sales users yet. Click "Add Sales User" to create one.</td></tr>
              )}
              {salesUsers.map(u => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: `${getRoleColor(u.role)}20`, color: getRoleColor(u.role) }}>
                      <FiShield size={10} /> {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(u.permissions || []).filter(p => p !== 'sales_chat').map(p => (
                        <span key={p} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td><span className={`badge-status ${u.status === 'active' ? 'badge-active' : 'badge-cancelled'}`}>{u.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}><FiEdit2 size={14} /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id)}><FiTrash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3>{editing ? 'Edit Sales User' : 'Add New Sales User'}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowModal(false)}><FiX size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              {!editing && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
              )}
              {editing && (
                <div className="form-group">
                  <label className="form-label">New Password (leave blank to keep current)</label>
                  <input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={6} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="sales_executive">Sales Executive</option>
                  <option value="sales_lead">Sales Team Lead</option>
                </select>
              </div>
              {editing && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ marginBottom: 8 }}>Menu Permissions</label>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Select which sections this user can access. Customer Chat is always enabled.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {AVAILABLE_MENUS.map(menu => (
                    <label key={menu.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: form.permissions.includes(menu.key) ? 'var(--accent-muted, rgba(99,102,241,0.1))' : 'transparent', transition: 'all 0.2s' }}>
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(menu.key)}
                        onChange={() => togglePermission(menu.key)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: 13, fontWeight: form.permissions.includes(menu.key) ? 600 : 400 }}>{menu.label}</span>
                    </label>
                  ))}
                  {/* Always-on chat indicator */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--success)', background: 'rgba(16,185,129,0.1)', cursor: 'default' }}>
                    <input type="checkbox" checked disabled style={{ accentColor: 'var(--success)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>Customer Chat</span>
                  </label>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                <FiSave size={16} /> {editing ? 'Update' : 'Create'} Sales User
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
