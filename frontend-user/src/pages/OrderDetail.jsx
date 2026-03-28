import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderDetail, uploadFiles } from '../services/api';
import { FiMessageSquare, FiDownload, FiArrowLeft, FiCalendar, FiUser, FiBookOpen, FiUpload } from 'react-icons/fi';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchOrder = () => {
    getOrderDetail(id).then(res => { setOrder(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    formData.append('order_id', order.id);

    try {
      await uploadFiles(formData);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    }
    setUploading(false);
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;
  if (!order) return <div className="card text-center"><h3>Order not found</h3></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/orders" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <div>
          <h2>Order #{order.id}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{order.course_name}</p>
        </div>
        <span className={`badge-status badge-${order.status}`} style={{ marginLeft: 'auto', fontSize: 14, padding: '6px 16px' }}>{order.status}</span>
      </div>

      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>📋 Order Details</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="summary-row"><span className="label"><FiBookOpen size={14} /> Type</span><span>{order.order_type_name}</span></div>
            <div className="summary-row"><span className="label">Subject</span><span>{order.subject_name}</span></div>
            <div className="summary-row"><span className="label">Level</span><span>{order.education_level_name}</span></div>
            <div className="summary-row"><span className="label">Plan</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{order.plan_name}</span></div>
            <div className="summary-row"><span className="label"><FiCalendar size={14} /> Start</span><span>{new Date(order.start_date).toLocaleDateString()}</span></div>
            <div className="summary-row"><span className="label"><FiCalendar size={14} /> End</span><span>{new Date(order.end_date).toLocaleDateString()}</span></div>
            <div className="summary-row"><span className="label">Weeks</span><span>{order.num_weeks}</span></div>
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 16 }}>💰 Payment</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="summary-row"><span className="label">Plan Price</span><span>${parseFloat(order.price).toFixed(2)}</span></div>
            {parseFloat(order.urgent_fee) > 0 && <div className="summary-row"><span className="label">Urgent Fee</span><span style={{ color: 'var(--warning)' }}>+${parseFloat(order.urgent_fee).toFixed(2)}</span></div>}
            {parseFloat(order.discount_amount) > 0 && <div className="summary-row"><span className="label">Discount</span><span style={{ color: 'var(--success)' }}>-${parseFloat(order.discount_amount).toFixed(2)}</span></div>}
            <div className="summary-row total"><span className="label">Total</span><span className="value">${parseFloat(order.total_price).toFixed(2)}</span></div>
          </div>
          {order.tutors?.length > 0 && (
            <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}><FiUser size={12} /> Assigned Tutor(s)</div>
              <div style={{ fontWeight: 500 }}>{order.tutors.map(t => t.name).join(', ')}</div>
            </div>
          )}
        </div>
      </div>

      {order.additional_instructions && (
        <div className="card mt-2">
          <h4 style={{ marginBottom: 12 }}>📝 Instructions</h4>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{order.additional_instructions}</p>
        </div>
      )}

      <div className="card mt-2">
        <h4 style={{ marginBottom: 16 }}>📎 Files {order.files ? `(${order.files.length})` : '(0)'}</h4>
        
        {order.files?.length > 0 && (
          <div className="file-list" style={{ marginBottom: 16 }}>
            {order.files.map(file => (
              <div key={file.id} className="file-item">
                <div>
                  <div className="file-name">{file.file_name}</div>
                  <div className="file-size">Uploaded by {file.uploaded_by_role} • {new Date(file.created_at).toLocaleDateString()}</div>
                </div>
                <a href={file.file_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary"><FiDownload size={14} /></a>
              </div>
            ))}
          </div>
        )}

        {order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'incomplete' && order.status !== 'pending' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div className="file-upload-zone" onClick={() => document.getElementById('user-upload-files').click()} style={{ padding: '20px', border: '2px dashed var(--border)', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-card-hover)', transition: 'var(--transition)' }}>
              {uploading ? (
                <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
              ) : (
                <>
                  <FiUpload size={24} style={{ marginBottom: 8, color: 'var(--accent)' }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Click to upload additional files</p>
                </>
              )}
            </div>
            <input id="user-upload-files" type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>
        )}
      </div>

      {order.chat_enabled && (
        <div className="mt-2">
          <Link to={`/chat/${order.id}`} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            <FiMessageSquare size={18} /> Open Chat
          </Link>
        </div>
      )}
    </div>
  );
}
