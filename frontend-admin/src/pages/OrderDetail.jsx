import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderDetail, getOrderFiles, uploadFiles, deleteFile } from '../services/api';
import { useApi } from '../hooks/useApi';
import { FiArrowLeft, FiUpload, FiTrash2, FiDownload, FiUserPlus, FiX } from 'react-icons/fi';

function ServiceDetails({ order }) {
  const type = (order.order_type_name || '').toLowerCase();
  const rows = [];

  if (type.includes('online class')) {
    const classType = order.class_type
      ? (order.class_type === 'full' ? 'Full Class' : 'Partial Class')
      : null;
    if (classType) rows.push(['Class Scope', classType]);
    if (order.class_type === 'partial' && order.partial_weeks) {
      rows.push(['Partial Weeks', order.partial_weeks]);
    }
  } else if (type.includes('quiz') || type.includes('exam') || type.includes('test')) {
    if (order.num_pages) rows.push([`# of ${order.order_type_name}s`, order.num_pages]);
    if (order.quiz_mode) {
      rows.push(['Mode', order.quiz_mode.charAt(0).toUpperCase() + order.quiz_mode.slice(1)]);
    }
  } else if (type.includes('assignment') || type.includes('project')) {
    if (order.num_pages) rows.push(['Pages', order.num_pages]);
    if (order.work_type) {
      rows.push(['Work Type', order.work_type.charAt(0).toUpperCase() + order.work_type.slice(1)]);
    }
  } else if (order.num_pages) {
    rows.push(['Pages', order.num_pages]);
  }

  const hasQuizItems = Array.isArray(order.quiz_items) && order.quiz_items.length > 0;

  if (rows.length === 0 && !hasQuizItems) return null;

  return (
    <div className="card mt-2">
      <h4 style={{ marginBottom: 16 }}>Service Details</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(([l, v]) => (
          <div key={l} className="summary-row"><span className="label">{l}</span><span>{v}</span></div>
        ))}
      </div>
      {hasQuizItems && (
        <div style={{ marginTop: rows.length ? 16 : 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {order.order_type_name || 'Item'} List
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {order.quiz_items.map((q, i) => (
              <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 13 }}>
                <span><strong>{i + 1}.</strong> {q.name || <em style={{ color: 'var(--text-muted)' }}>(no name)</em>}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{q.duration || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tutors, setTutors] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedTutors, setSelectedTutors] = useState([]);
  const fileInputRef = useRef(null);
  const { assignTutors, getAllTutors } = useApi();

  const fetchOrder = () => {
    Promise.all([
      getOrderDetail(id),
      getOrderFiles(id)
    ]).then(([orderRes, filesRes]) => {
      setOrder(orderRes.data);
      setFiles(filesRes.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [id]);
  useEffect(() => { getAllTutors().then(res => setTutors(res.data)).catch(() => {}); }, []);

  const openAssign = () => {
    setSelectedTutors(order.tutors ? order.tutors.map(t => t.id) : []);
    setShowAssign(true);
  };

  const toggleTutor = (tid) => {
    setSelectedTutors(prev => prev.includes(tid) ? prev.filter(t => t !== tid) : [...prev, tid]);
  };

  const handleAssign = async () => {
    await assignTutors(id, { tutor_ids: selectedTutors });
    setShowAssign(false);
    fetchOrder();
  };

  const handleUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('order_id', id);
    for (const file of selectedFiles) {
      formData.append('files', file);
    }
    try {
      const res = await uploadFiles(formData);
      setFiles(prev => [...(res.data.files || []), ...prev]);
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Delete this file?')) return;
    try {
      await deleteFile(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;
  if (!order) return <div className="card text-center"><h3>Order not found</h3></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/orders" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <div><h2>Order #{order.id}</h2><p style={{ color: 'var(--text-secondary)' }}>{order.course_name} by {order.username}</p></div>
        <span className={`badge-status badge-${order.status}`} style={{ marginLeft: 'auto', fontSize: 14, padding: '6px 16px' }}>{order.status}</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Order Info</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Source', order.source_url || 'Direct'],
              ['Type', order.order_type_name],
              ['Course', order.course_name || '—'],
              ['Subject', order.subject_name],
              ['Level', order.education_level_name],
              ['Plan', order.plan_tier ? order.plan_tier.charAt(0).toUpperCase() + order.plan_tier.slice(1) : (order.plan_name || '—')],
              ['Start', new Date(order.start_date).toLocaleDateString()],
              ['End', new Date(order.end_date).toLocaleDateString()],
              ['Weeks', order.num_weeks]
            ].map(([l, v]) => (
              <div key={l} className="summary-row"><span className="label">{l}</span><span>{v}</span></div>
            ))}
          </div>
        </div>
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Financial</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="summary-row"><span className="label">Price</span><span>${parseFloat(order.price).toFixed(2)}</span></div>
            {parseFloat(order.urgent_fee) > 0 && <div className="summary-row"><span className="label">Urgent</span><span>+${parseFloat(order.urgent_fee).toFixed(2)}</span></div>}
            {parseFloat(order.discount_amount) > 0 && <div className="summary-row"><span className="label">Discount</span><span style={{ color: 'var(--success)' }}>-${parseFloat(order.discount_amount).toFixed(2)}</span></div>}
            <div className="summary-row total"><span className="label">Total</span><span className="value">${parseFloat(order.total_price).toFixed(2)}</span></div>
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Payment Status</span>
            <span className={`badge-status ${order.payment_status === 'completed' ? 'badge-active' : order.payment_status === 'pending' ? 'badge-in_progress' : order.payment_status === 'cancelled' ? 'badge-cancelled' : 'badge-incomplete'}`} style={{ fontSize: 12, padding: '4px 12px', textTransform: 'capitalize' }}>
              {order.payment_status || 'unpaid'}
            </span>
          </div>
          {order.school_url && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>School Credentials</div>
              <div style={{ fontSize: 13 }}>URL: {order.school_url}</div>
              <div style={{ fontSize: 13 }}>User: {order.school_username}</div>
              <div style={{ fontSize: 13 }}>Pass: {order.school_password}</div>
            </div>
          )}
        </div>
      </div>
      <ServiceDetails order={order} />

      {order.additional_instructions && <div className="card mt-2"><h4 style={{ marginBottom: 8 }}>Instructions</h4><p style={{ color: 'var(--text-secondary)' }}>{order.additional_instructions}</p></div>}

      {/* Files section with upload */}
      <div className="card mt-2">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4>Files ({files.length})</h4>
          <label className="btn btn-sm btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiUpload size={14} /> {uploading ? 'Uploading...' : 'Upload Files'}
            <input type="file" multiple ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
        </div>
        {files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
            <p>No files uploaded yet</p>
          </div>
        ) : (
          <div className="file-list">
            {files.map(f => (
              <div key={f.id} className="file-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-input)', marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{f.file_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {f.uploaded_by_role} {f.created_at ? `• ${new Date(f.created_at).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a href={f.file_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline" title="Download"><FiDownload size={13} /></a>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(f.id)} title="Delete"><FiTrash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assigned Tutors */}
      <div className="card mt-2">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4>Assigned Tutor(s)</h4>
          <button className="btn btn-sm btn-primary" onClick={openAssign} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiUserPlus size={14} /> {order.tutors?.length ? 'Change' : 'Assign'}
          </button>
        </div>
        {order.tutors?.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {order.tutors.map(t => (
              <span key={t.id} style={{ padding: '6px 14px', background: 'rgba(132,194,37,0.1)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>{t.name}</span>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No tutors assigned yet</p>
        )}
      </div>

      <div className="mt-2"><Link to={`/chats/${order.id}`} className="btn btn-primary" style={{ width: '100%' }}>View Chat</Link></div>

      {/* Assign Tutor Modal */}
      {showAssign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3>Assign Tutor(s) to Order #{order.id}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowAssign(false)}><FiX size={16} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>Select one or multiple tutors:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {tutors.filter(t => t.status === 'active').map(t => (
                <div key={t.id} onClick={() => toggleTutor(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: selectedTutors.includes(t.id) ? 'rgba(132,194,37,0.1)' : 'var(--bg-input)', border: `1px solid ${selectedTutors.includes(t.id) ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${selectedTutors.includes(t.id) ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedTutors.includes(t.id) ? 'var(--accent)' : 'transparent', color: '#000', fontSize: 12, fontWeight: 700 }}>{selectedTutors.includes(t.id) ? '✓' : ''}</div>
                  <div><div style={{ fontWeight: 500 }}>{t.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.specialization || t.email}</div></div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary mt-2" style={{ width: '100%' }} onClick={handleAssign} disabled={selectedTutors.length === 0}>Assign {selectedTutors.length} Tutor(s)</button>
          </div>
        </div>
      )}
    </div>
  );
}
