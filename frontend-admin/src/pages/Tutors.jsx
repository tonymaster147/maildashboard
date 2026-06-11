import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiUpload, FiUser } from 'react-icons/fi';

// Resolve a tutor photo URL (server may return a relative `/uploads/...` path
// or a full absolute URL). Returns null when none set so caller falls back
// to a placeholder icon.
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const resolvePhoto = (u) => (!u ? null : (u.startsWith('http') ? u : `${API_ORIGIN}${u}`));

export default function Tutors() {
  const { getAllTutors, createTutor, updateTutor, deleteTutor, uploadTutorPhoto } = useApi();
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', specialization: '', status: 'active', photo_url: '', rating: '' });
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchTutors = () => { getAllTutors().then(res => { setTutors(res.data); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { fetchTutors(); }, []);

  const openAdd = () => {
    setForm({ name: '', email: '', password: '', specialization: '', status: 'active', photo_url: '', rating: '' });
    setEditing(null);
    setShowModal(true);
  };
  const openEdit = (t) => {
    setForm({
      name: t.name, email: t.email, password: '',
      specialization: t.specialization || '',
      status: t.status,
      photo_url: t.photo_url || '',
      rating: t.rating != null ? String(t.rating) : '',
    });
    setEditing(t.id);
    setShowModal(true);
  };

  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-selecting the same file fires onChange
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please pick an image file (JPG, PNG, WEBP)'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5 MB'); return; }
    setPhotoUploading(true);
    try {
      const res = await uploadTutorPhoto(file);
      setForm(f => ({ ...f, photo_url: res.data.url }));
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = () => setForm(f => ({ ...f, photo_url: '' }));

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
            <thead><tr><th>ID</th><th>Photo</th><th>Name</th><th>Email</th><th>Specialization</th><th>Rating</th><th>Active Tasks</th><th>Completed</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {tutors.map(t => (
                <tr key={t.id}>
                  <td>#{t.id}</td>
                  <td>
                    <TutorAvatar photo={resolvePhoto(t.photo_url)} name={t.name} size={32} />
                  </td>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{t.email}</td>
                  <td>{t.specialization || '—'}</td>
                  <td><StarRating value={t.rating} /></td>
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

            {/* Photo upload */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <TutorAvatar photo={resolvePhoto(form.photo_url)} name={form.name} size={64} />
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Profile Photo</label>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                  JPG / PNG / WEBP, up to 5 MB. Shown on student dashboard avatars.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoPick}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                  >
                    {photoUploading
                      ? <><div className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Uploading…</>
                      : <><FiUpload size={12} /> {form.photo_url ? 'Replace' : 'Upload'}</>}
                  </button>
                  {form.photo_url && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={removePhoto} disabled={photoUploading}>
                      <FiX size={12} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
              {!editing
                ? <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
                : <div className="form-group">
                    <label className="form-label">New Password <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>(leave blank to keep current)</span></label>
                    <input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={6} placeholder="•••••••" autoComplete="new-password" />
                  </div>}
              <div className="form-group"><label className="form-label">Specialization</label><input className="form-input" placeholder="e.g. Mathematics, Science" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} /></div>
              <div className="form-group">
                <label className="form-label">Rating <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>(0–5, e.g. 4.7 — shown to students)</span></label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 4.7"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.rating}
                    onChange={e => setForm({ ...form, rating: e.target.value })}
                    style={{ flex: '0 0 140px' }}
                  />
                  <StarRating value={form.rating} size={18} />
                </div>
              </div>
              {editing && <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>}
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}><FiSave size={16} /> {editing ? 'Update' : 'Create'} Tutor</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple avatar that shows the photo if available, else the first letter
// of the tutor's name (or a placeholder icon if no name yet).
function TutorAvatar({ photo, name, size = 32 }) {
  const initial = (name || '').trim().charAt(0).toUpperCase();
  const common = {
    width: size, height: size, borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
    background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6',
    fontWeight: 700, fontSize: Math.round(size * 0.42),
  };
  if (photo) {
    return <img src={photo} alt={name || 'Tutor'} style={{ ...common, objectFit: 'cover' }} />;
  }
  if (initial) {
    return <span style={common}>{initial}</span>;
  }
  return <span style={{ ...common, color: 'var(--text-muted)' }}><FiUser size={Math.round(size * 0.5)} /></span>;
}


// Gold star strip for a 0-5 rating (half-star steps). Renders nothing when
// the tutor has no rating yet.
function StarRating({ value, size = 14 }) {
  const v = parseFloat(value);
  if (!value || Number.isNaN(v) || v <= 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span aria-hidden style={{ position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1, color: 'rgba(127,127,127,0.35)' }}>
        {'★★★★★'}
        <span style={{
          position: 'absolute', top: 0, left: 0, overflow: 'hidden', whiteSpace: 'nowrap',
          width: `${(Math.min(5, Math.max(0, v)) / 5) * 100}%`, color: '#fbbf24',
        }}>
          {'★★★★★'}
        </span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{v.toFixed(1)}</span>
    </span>
  );
}
