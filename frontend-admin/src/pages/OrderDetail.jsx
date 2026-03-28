import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderDetail } from '../services/api';
import { FiArrowLeft } from 'react-icons/fi';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getOrderDetail(id).then(res => { setOrder(res.data); setLoading(false); }).catch(() => setLoading(false)); }, [id]);

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
            {[['Source', order.source_url || 'Direct'], ['Type', order.order_type_name], ['Subject', order.subject_name], ['Level', order.education_level_name], ['Plan', order.plan_name], ['Start', new Date(order.start_date).toLocaleDateString()], ['End', new Date(order.end_date).toLocaleDateString()], ['Weeks', order.num_weeks]].map(([l, v]) => (
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
      {order.additional_instructions && <div className="card mt-2"><h4 style={{ marginBottom: 8 }}>Instructions</h4><p style={{ color: 'var(--text-secondary)' }}>{order.additional_instructions}</p></div>}
      {order.files?.length > 0 && (
        <div className="card mt-2">
          <h4 style={{ marginBottom: 12 }}>Files ({order.files.length})</h4>
          <div className="file-list">
            {order.files.map(f => <div key={f.id} className="file-item"><div><div className="file-name">{f.file_name}</div><div className="file-size">{f.uploaded_by_role}</div></div><a href={f.file_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">View</a></div>)}
          </div>
        </div>
      )}
      <div className="mt-2"><Link to={`/chats/${order.id}`} className="btn btn-primary" style={{ width: '100%' }}>View Chat</Link></div>
    </div>
  );
}
