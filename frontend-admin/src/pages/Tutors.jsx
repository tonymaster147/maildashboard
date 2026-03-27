import { useState, useEffect } from 'react';
import { getAllTutors, createTutor, updateTutor, deleteTutor } from '../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave } from 'react-icons/fi';

export default function Tutors() {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', specialization: '', status: 'active' });

  const fetchTutors = () => { getAllTutors().then(res => { setTutors(res.data); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { fetchTutors(); }, []);

  const openAdd = () => { setForm({ name: '', email: '', password: '', specialization: '', status: 'active' }); setEditing(null); setShowModal(true); };
  const openEdit = (t) => { setForm({ name: t.name, email: t.email, password: '', specialization: t.specialization || '', status: t.status }); setEditing(t.id); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await updateTutor(editing, form); }
      else { await createTutor(form); }
      setShowModal(false); fetchTutors();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this tutor?')) return;
    await deleteTutor(id); fetchTutors();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div><h2>Tutor Management</h2><p style={{ color: 'var(--text-secondary)' }}>Add, edit, and manage tutors</p></div>
        <button className="btn btn-primary" onClick={openAdd}><FiPlus size={16} /> Add Tutor</button>
      </div>
      {loading ? <div className="flex-center"><div className="loading-spinner"></div></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Specialization</th><th>Active Tasks</th><th>Completed</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {tutors.map(t => (
                <tr key={t.id}>
                  <td>#{t.id}</td>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{t.email}</td>
                  <td>{t.specialization || '—'}</td>
                  <td style={{ color: 'var(--info)', fontWeight: 600 }}>{t.active_tasks}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{t.completed_tasks}</td>
                  <td><span className={`badge-status ${t.status === 'active' ? 'badge-active' : 'badge-cancelled'}`}>{t.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(t)}><FiEdit2 size={14} /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}><FiTrash2 size={14} /></button>
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
          <div className="card" style={{ width: 480, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3>{editing ? 'Edit Tutor' : 'Add New Tutor'}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowModal(false)}><FiX size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
              {!editing && <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>}
              <div className="form-group"><label className="form-label">Specialization</label><input className="form-input" placeholder="e.g. Mathematics, Science" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} /></div>
              {editing && <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>}
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}><FiSave size={16} /> {editing ? 'Update' : 'Create'} Tutor</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
