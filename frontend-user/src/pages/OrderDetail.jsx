import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderDetail, uploadFiles, createPaymentIntent, createRemainingPaymentIntent, getOrderInstallments, payInstallment, payAllInstallments } from '../services/api';
import EmbeddedCheckout from '../components/EmbeddedCheckout';
import { FiDownload, FiArrowLeft, FiCalendar, FiUser, FiBookOpen, FiUpload, FiCreditCard, FiHeadphones, FiMail } from 'react-icons/fi';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [installments, setInstallments] = useState([]);

  const fetchOrder = () => {
    getOrderDetail(id).then(res => {
      setOrder(res.data);
      setLoading(false);
      if (res.data?.has_installments) {
        getOrderInstallments(id).then(r => setInstallments(r.data || [])).catch(() => {});
      } else {
        setInstallments([]);
      }
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handlePayInstallment = async (instId) => {
    setPaymentLoading(true);
    try {
      const res = await payInstallment(instId);
      setCheckout({ clientSecret: res.data.client_secret, amount: res.data.amount, isPartial: false, fullTotal: res.data.amount });
    } catch (err) {
      alert(err.response?.data?.error || 'Payment setup failed');
    }
    setPaymentLoading(false);
  };

  const handlePayAllInstallments = async () => {
    setPaymentLoading(true);
    try {
      const res = await payAllInstallments(id);
      setCheckout({ clientSecret: res.data.client_secret, amount: res.data.amount, isPartial: false, fullTotal: res.data.amount });
    } catch (err) {
      alert(err.response?.data?.error || 'Payment setup failed');
    }
    setPaymentLoading(false);
  };

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

  const handleCompletePayment = async () => {
    setPaymentLoading(true);
    try {
      const res = await createPaymentIntent({ order_id: order.id, payment_type: 'full' });
      setCheckout({ clientSecret: res.data.client_secret, amount: res.data.amount, isPartial: false, fullTotal: res.data.full_total });
    } catch (err) {
      alert(err.response?.data?.error || 'Payment setup failed');
    }
    setPaymentLoading(false);
  };

  const handlePayRemaining = async () => {
    setPaymentLoading(true);
    try {
      const res = await createRemainingPaymentIntent({ order_id: order.id });
      setCheckout({ clientSecret: res.data.client_secret, amount: res.data.amount, isPartial: false, fullTotal: res.data.amount });
    } catch (err) {
      alert(err.response?.data?.error || 'Payment setup failed');
    }
    setPaymentLoading(false);
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  if (checkout) {
    return (
      <div style={{ padding: '40px 20px' }}>
        <EmbeddedCheckout
          clientSecret={checkout.clientSecret}
          amount={checkout.amount}
          isPartial={checkout.isPartial}
          fullTotal={checkout.fullTotal}
          onSuccess={() => { setCheckout(null); fetchOrder(); }}
          onCancel={() => setCheckout(null)}
        />
      </div>
    );
  }
  if (!order) return <div className="card text-center"><h3>Order not found</h3></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/orders" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <div>
          <h2>Order {order.order_code || `#${order.id}`}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{order.course_name}</p>
        </div>
        <span className={`badge-status badge-${order.status}`} style={{ marginLeft: 'auto', fontSize: 14, padding: '6px 16px' }}>
          {order.admin_status_name || order.status}
        </span>
      </div>

      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>📋 Order Details</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="summary-row"><span className="label"><FiBookOpen size={14} /> Type</span><span>{order.order_type_name}</span></div>
            <div className="summary-row"><span className="label">Course</span><span>{order.course_name || '—'}</span></div>
            <div className="summary-row"><span className="label">Subject</span><span>{order.subject_name}</span></div>
            <div className="summary-row"><span className="label">Level</span><span>{order.education_level_name}</span></div>
            <div className="summary-row"><span className="label">Plan</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{order.plan_tier ? order.plan_tier.charAt(0).toUpperCase() + order.plan_tier.slice(1) : (order.plan_name || '—')}</span></div>
            <div className="summary-row"><span className="label"><FiCalendar size={14} /> Start</span><span>{new Date(order.start_date).toLocaleDateString()}</span></div>
            <div className="summary-row"><span className="label"><FiCalendar size={14} /> End</span><span>{new Date(order.end_date).toLocaleDateString()}</span></div>
            <div className="summary-row"><span className="label">Weeks</span><span>{order.num_weeks}</span></div>
          </div>

          {order.site_contact_email && (
            <a
              href={`mailto:${order.site_contact_email}?subject=${encodeURIComponent(`Order ${order.order_code || `#${order.id}`} — ${order.course_name || ''}`)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 16,
                padding: '10px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'var(--transition)'
              }}
            >
              <FiMail size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Need help with this order?</div>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {order.site_contact_email}
                </div>
              </div>
            </a>
          )}
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 16 }}>💰 Payment</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="summary-row"><span className="label">Plan Price</span><span>${parseFloat(order.price).toFixed(2)}</span></div>
            {parseFloat(order.urgent_fee) > 0 && <div className="summary-row"><span className="label">Urgent Fee</span><span style={{ color: 'var(--warning)' }}>+${parseFloat(order.urgent_fee).toFixed(2)}</span></div>}
            {parseFloat(order.discount_amount) > 0 && <div className="summary-row"><span className="label">Discount</span><span style={{ color: 'var(--success)' }}>-${parseFloat(order.discount_amount).toFixed(2)}</span></div>}
            <div className="summary-row total"><span className="label">Total</span><span className="value">${parseFloat(order.total_price).toFixed(2)}</span></div>
            {order.payment_type === 'partial' && parseFloat(order.amount_remaining) > 0 && (
              <>
                <div className="summary-row" style={{ color: 'var(--success)' }}><span className="label">Paid</span><span>${parseFloat(order.amount_paid).toFixed(2)}</span></div>
                {parseFloat(order.convenience_fee || 0) > 0 && (
                  <div className="summary-row" style={{ color: 'var(--warning)' }}><span className="label">Convenience Fee</span><span>+${parseFloat(order.convenience_fee).toFixed(2)}</span></div>
                )}
                <div className="summary-row" style={{ color: 'var(--warning)', fontWeight: 600 }}><span className="label">Remaining</span><span>${parseFloat(order.amount_remaining).toFixed(2)}</span></div>
              </>
            )}
          </div>
          {order.status === 'incomplete' && parseFloat(order.total_price) > 0 && (
            <button className="btn btn-primary mt-2" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', fontSize: 15 }} onClick={handleCompletePayment} disabled={paymentLoading}>
              {paymentLoading ? <div className="loading-spinner" style={{ width: 18, height: 18 }}></div> : <><FiCreditCard size={18} /> Complete Payment</>}
            </button>
          )}
          {order.payment_type === 'partial' && parseFloat(order.amount_remaining) > 0 && order.status !== 'incomplete' && !order.has_installments && (
            <button className="btn btn-primary mt-2" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', fontSize: 15, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} onClick={handlePayRemaining} disabled={paymentLoading}>
              {paymentLoading ? <div className="loading-spinner" style={{ width: 18, height: 18 }}></div> : <><FiCreditCard size={18} /> Pay Remaining ${parseFloat(order.amount_remaining).toFixed(2)}</>}
            </button>
          )}
          {!!order.has_installments && installments.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>📅 Installment Plan</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {installments.map(i => (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: i.status === 'paid' ? 'rgba(34,197,94,0.08)' : i.status === 'overdue' ? 'rgba(220,38,38,0.08)' : 'var(--bg-input)', border: `1px solid ${i.status === 'paid' ? '#22c55e' : i.status === 'overdue' ? '#dc2626' : 'var(--border)'}`, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Installment {i.installment_number}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Due {new Date(i.due_date).toLocaleDateString()} · <span style={{ textTransform: 'uppercase', fontWeight: 600, color: i.status === 'paid' ? '#16a34a' : i.status === 'overdue' ? '#dc2626' : 'var(--warning)' }}>{i.status}</span></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ fontSize: 15 }}>${parseFloat(i.amount).toFixed(2)}</strong>
                      {i.status !== 'paid' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handlePayInstallment(i.id)} disabled={paymentLoading}>Pay</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {installments.some(i => i.status !== 'paid') && (
                <button className="btn btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} onClick={handlePayAllInstallments} disabled={paymentLoading}>
                  {paymentLoading ? <div className="loading-spinner" style={{ width: 18, height: 18 }}></div> : `Pay All Remaining $${installments.filter(i => i.status !== 'paid').reduce((s, i) => s + parseFloat(i.amount), 0).toFixed(2)}`}
                </button>
              )}
            </div>
          )}
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

      {!!order.chat_enabled && (
        <div className="mt-2" style={{ display: 'flex', gap: 12 }}>
          <Link to={`/chat/tutor/${order.id}`} className="btn btn-lg" style={{ flex: 1, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <FiUser size={18} /> Tutor Chat
          </Link>
          <Link to={`/chat/support/${order.id}`} className="btn btn-lg" style={{ flex: 1, background: 'rgba(132, 194, 37, 0.1)', border: '1px solid rgba(132, 194, 37, 0.3)', color: '#84c225', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <FiHeadphones size={18} /> Support Chat
          </Link>
        </div>
      )}
    </div>
  );
}
