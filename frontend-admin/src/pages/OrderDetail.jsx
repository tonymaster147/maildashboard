import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderDetail, getOrderFiles, uploadFiles, deleteFile, getPublicStatuses } from '../services/api';
import InstallmentPlanModal from '../components/InstallmentPlanModal';
import EditInstallmentModal from '../components/EditInstallmentModal';
import CancelOrderModal from '../components/CancelOrderModal';
import PaymentCollectionModal from '../components/PaymentCollectionModal';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { isPartialEligible, PARTIAL_PAYMENT_AMOUNT } from '../utils/partialPayment';
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
  const [installments, setInstallments] = useState([]);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showEditInstallmentModal, setShowEditInstallmentModal] = useState(false);
  const [adminStatuses, setAdminStatuses] = useState([]);
  const fileInputRef = useRef(null);
  const { assignTutors, getAllTutors, markRemainingPaid, getInstallments, deleteInstallmentPlan, markInstallmentPaid, markAllInstallmentsPaid, updateOrderStatus } = useApi();

  const fetchInstallments = (orderId) => {
    getInstallments(orderId).then(res => setInstallments(res.data || [])).catch(() => setInstallments([]));
  };

  const fetchOrder = () => {
    Promise.all([
      getOrderDetail(id),
      getOrderFiles(id)
    ]).then(([orderRes, filesRes]) => {
      setOrder(orderRes.data);
      setFiles(filesRes.data || []);
      setLoading(false);
      if (orderRes.data?.has_installments) fetchInstallments(id);
      else setInstallments([]);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [id]);
  useEffect(() => { getAllTutors().then(res => setTutors(res.data)).catch(() => {}); }, []);
  useEffect(() => { getPublicStatuses('admin').then(res => setAdminStatuses((res.data.statuses || []).filter(s => s.is_active))).catch(() => {}); }, []);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const { isAdmin, user } = useAuth();
  const canMarkPaid = isAdmin || user?.role === 'sales_lead';
  const [paymentModal, setPaymentModal] = useState(null); // { targetCode, paymentType }

  const handleAdminStatusChange = async (code) => {
    if (code === 'cancelled') { setCancelOpen(true); return; }
    const targetIsPaid = /^paid_(full|partial)/.test(code || '');
    if (order?.admin_status_code === 'unpaid' && targetIsPaid) {
      if (!canMarkPaid) {
        alert('Only an Admin or Sales Lead can mark an order as paid.');
        fetchOrder();
        return;
      }
      const isPartial = code.startsWith('paid_partial');
      if (isPartial && !isPartialEligible(order)) {
        alert('Partial payment is only available for eligible Online Class orders (total ≥ $455 or 45+ days).');
        fetchOrder();
        return;
      }
      const total = parseFloat(order.total_price || 0);
      setPaymentModal({
        title: `Record Payment — Order ${order.order_code || `#${order.id}`}`,
        subtitle: `Marking as ${isPartial ? 'Paid — Partial' : 'Paid — Full'} · Order total $${total.toFixed(2)}`,
        amountLabel: isPartial ? 'Upfront amount' : 'Amount',
        amount: isPartial ? Math.min(PARTIAL_PAYMENT_AMOUNT, total) : total,
        maxAmount: total,
        noteRequiredWhenDifferent: !isPartial,
        showRemaining: isPartial,
        remainingBase: total,
        onSubmit: async (payment) => {
          await updateOrderStatus(id, { admin_status_code: code, payment });
          setPaymentModal(null);
          fetchOrder();
        },
      });
      return;
    }
    try {
      await updateOrderStatus(id, { admin_status_code: code });
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
      fetchOrder(); // revert dropdown to true server state
    }
  };

  const confirmCancel = async (note) => {
    setCancelSubmitting(true);
    try {
      await updateOrderStatus(id, { admin_status_code: 'cancelled', cancellation_note: note });
      setCancelOpen(false);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel');
    } finally {
      setCancelSubmitting(false);
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link to="/orders" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <div><h2>Order {order.order_code || `#${order.id}`}</h2><p style={{ color: 'var(--text-secondary)' }}>{order.course_name} by {order.username}</p></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-select"
            value={order.admin_status_code || ''}
            onChange={e => handleAdminStatusChange(e.target.value)}
            style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600, minWidth: 180 }}
          >
            {!order.admin_status_code && <option value="" disabled>Set status…</option>}
            {adminStatuses.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          {order.tutor_status_code && (
            <span
              title="Tutor work status (set by tutor)"
              style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: order.tutor_status_code === 'completed' ? 'rgba(34,197,94,0.12)' : order.tutor_status_code === 'work_stopped' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
                color:      order.tutor_status_code === 'completed' ? '#16a34a'             : order.tutor_status_code === 'work_stopped' ? '#d97706'             : '#2563eb',
                border: '1px solid currentColor'
              }}
            >
              Tutor: {order.tutor_status_name}
            </span>
          )}
        </div>
      </div>
      {order.admin_status_code === 'cancelled' && order.cancellation_note && (
        <div style={{
          marginBottom: 20, padding: '12px 16px',
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          borderRadius: 'var(--radius-sm, 8px)',
          color: 'var(--text-primary)'
        }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Cancellation Note</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{order.cancellation_note}</div>
        </div>
      )}
      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Order Info</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Placed', order.created_at ? new Date(order.created_at).toLocaleString() : '—'],
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
            {order.payment_type === 'partial' && (
              <>
                <div className="summary-row" style={{ color: 'var(--success)' }}><span className="label">Paid</span><span>${parseFloat(order.amount_paid || 0).toFixed(2)}</span></div>
                {parseFloat(order.convenience_fee || 0) > 0 && (
                  <div className="summary-row" style={{ color: 'var(--warning)' }}><span className="label">Convenience Fee</span><span>+${parseFloat(order.convenience_fee).toFixed(2)}</span></div>
                )}
                <div className="summary-row" style={{ color: 'var(--warning)', fontWeight: 600 }}><span className="label">Remaining</span><span>${parseFloat(order.amount_remaining || 0).toFixed(2)}</span></div>
              </>
            )}
          </div>
          {order.payment_type === 'partial' && parseFloat(order.amount_remaining) > 0 && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.15))', border: '1px solid #f59e0b', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>⚠️ PARTIAL PAYMENT — ${parseFloat(order.amount_remaining).toFixed(2)} outstanding</div>
              {!order.has_installments && (
                <>
                  <button className="btn btn-sm btn-primary" style={{ background: '#f59e0b', width: '100%', marginBottom: 6 }} onClick={() => setShowInstallmentModal(true)}>Split into Installments</button>
                  <button className="btn btn-sm btn-secondary" style={{ width: '100%' }} onClick={() => {
                    const remaining = parseFloat(order.amount_remaining);
                    setPaymentModal({
                      title: `Record Remaining Payment — Order ${order.order_code || `#${order.id}`}`,
                      subtitle: `Marking the remaining $${remaining.toFixed(2)} as paid`,
                      amount: remaining,
                      amountEditable: false,
                      submitLabel: 'Mark Remaining Paid',
                      onSubmit: async (payment) => {
                        await markRemainingPaid(order.id, { payment });
                        setPaymentModal(null);
                        fetchOrder();
                      },
                    });
                  }}>Mark Remaining Paid</button>
                </>
              )}
              {!!order.has_installments && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>INSTALLMENT PLAN ({installments.length} installments)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {installments.map(i => (
                      <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 13 }}>
                        <span style={{ minWidth: 0 }}>#{i.installment_number} · {new Date(i.due_date).toLocaleDateString()}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong>${parseFloat(i.amount).toFixed(2)}</strong>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: i.status === 'paid' ? '#16a34a' : i.status === 'overdue' ? '#dc2626' : '#d97706', color: '#fff' }}>{i.status}</span>
                          {i.status !== 'paid' && (
                            <button className="btn btn-sm" style={{ background: '#16a34a', color: '#fff', padding: '2px 8px', fontSize: 11 }} onClick={() => {
                              setPaymentModal({
                                title: `Record Installment Payment — Order ${order.order_code || `#${order.id}`}`,
                                subtitle: `Installment #${i.installment_number} · $${parseFloat(i.amount).toFixed(2)}`,
                                amount: parseFloat(i.amount),
                                amountEditable: false,
                                submitLabel: 'Mark Installment Paid',
                                onSubmit: async (payment) => {
                                  await markInstallmentPaid(i.id, { payment });
                                  setPaymentModal(null);
                                  fetchOrder();
                                },
                              });
                            }}>Mark Paid</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {installments.some(i => i.status !== 'paid') && (
                    <button className="btn btn-sm btn-secondary" style={{ width: '100%', marginBottom: 6 }} onClick={() => setShowEditInstallmentModal(true)}>Edit Plan</button>
                  )}
                  {installments.some(i => i.status !== 'paid') && (
                    <button className="btn btn-sm btn-primary" style={{ width: '100%', background: '#16a34a', marginBottom: 6 }} onClick={() => {
                      const pendingSum = installments.filter(i => i.status !== 'paid').reduce((s, i) => s + parseFloat(i.amount), 0);
                      setPaymentModal({
                        title: `Record Payment — Order ${order.order_code || `#${order.id}`}`,
                        subtitle: `Marking ALL remaining installments ($${pendingSum.toFixed(2)}) as paid`,
                        amount: pendingSum,
                        amountEditable: false,
                        submitLabel: 'Mark All Remaining Paid',
                        onSubmit: async (payment) => {
                          await markAllInstallmentsPaid(order.id, { payment });
                          setPaymentModal(null);
                          fetchOrder();
                        },
                      });
                    }}>Mark All Remaining Paid</button>
                  )}
                  {installments.every(i => i.status !== 'paid') && (
                    <button className="btn btn-sm btn-secondary" style={{ width: '100%' }} onClick={async () => {
                      if (!confirm('Delete installment plan? Outstanding balance reverts to single remaining amount.')) return;
                      try {
                        await deleteInstallmentPlan(order.id);
                        fetchOrder();
                      } catch (e) {
                        alert(e.response?.data?.error || 'Failed to delete plan');
                      }
                    }}>Delete Plan</button>
                  )}
                </div>
              )}
            </div>
          )}
          {showInstallmentModal && (
            <InstallmentPlanModal
              order={order}
              onClose={() => setShowInstallmentModal(false)}
              onCreated={() => { setShowInstallmentModal(false); fetchOrder(); }}
            />
          )}
          {showEditInstallmentModal && (
            <EditInstallmentModal
              orderId={order.id}
              orderCode={order.order_code}
              installments={installments}
              onClose={() => setShowEditInstallmentModal(false)}
              onSaved={() => { setShowEditInstallmentModal(false); fetchOrder(); }}
            />
          )}
          {cancelOpen && (
            <CancelOrderModal
              orderId={order.id}
              orderCode={order.order_code}
              onConfirm={confirmCancel}
              onCancel={() => setCancelOpen(false)}
              submitting={cancelSubmitting}
            />
          )}
          {paymentModal && (
            <PaymentCollectionModal
              {...paymentModal}
              onClose={() => { setPaymentModal(null); fetchOrder(); }}
            />
          )}
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Payment Status</span>
            <span className={`badge-status ${order.payment_status === 'completed' ? 'badge-active' : order.payment_status === 'pending' ? 'badge-in_progress' : order.payment_status === 'cancelled' ? 'badge-cancelled' : 'badge-incomplete'}`} style={{ fontSize: 12, padding: '4px 12px', textTransform: 'capitalize' }}>
              {order.payment_status || 'unpaid'}
            </span>
          </div>
          {(order.school_url || order.school_username || order.school_password) && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>School Credentials</div>
                {order.login_updated_at && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.15)', color: '#16a34a', fontWeight: 600 }}>
                    Updated {new Date(order.login_updated_at).toLocaleString()}
                  </span>
                )}
              </div>
              {order.school_url      && <div style={{ fontSize: 13 }}>URL: {order.school_url}</div>}
              {order.school_username && <div style={{ fontSize: 13 }}>User: {order.school_username}</div>}
              {order.school_password && <div style={{ fontSize: 13 }}>Pass: {order.school_password}</div>}
            </div>
          )}
        </div>
      </div>
      <ServiceDetails order={order} />

      {order.payment_collections && order.payment_collections.length > 0 && (
        <div className="card mt-2">
          <h4 style={{ marginBottom: 12 }}>Payment Records</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {order.payment_collections.map(pc => (
              <div key={pc.id} style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>${parseFloat(pc.amount).toFixed(2)}</span>
                  <span className={`badge-status ${pc.payment_type === 'full' ? 'badge-active' : 'badge-in_progress'}`} style={{ fontSize: 11, textTransform: 'capitalize' }}>{pc.payment_type}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <div>Invoice: <strong style={{ color: 'var(--text-primary)' }}>{pc.invoice_no || '—'}</strong></div>
                  <div>Date of payment: <strong style={{ color: 'var(--text-primary)' }}>{pc.payment_date ? new Date(pc.payment_date).toLocaleDateString() : '—'}</strong></div>
                  <div>Mode: <strong style={{ color: 'var(--text-primary)' }}>{pc.mode_of_communication || '—'}</strong></div>
                  <div>By: <strong style={{ color: 'var(--text-primary)' }}>{pc.collected_by_name || '—'}{pc.collected_by_role ? ` (${pc.collected_by_role.replace('_', ' ')})` : ''}</strong></div>
                </div>
                {pc.note && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Note: <span style={{ color: 'var(--text-primary)' }}>{pc.note}</span></div>}
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>Recorded {new Date(pc.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <div style={{ fontWeight: 500, fontSize: 13 }}>
                    {f.file_name}
                    {Number(f.is_post_submit) === 1 && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        Added later
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {f.uploaded_by_role} {f.created_at ? `• ${new Date(f.created_at).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a
                    href={f.drive_file_id ? `https://drive.google.com/uc?export=download&id=${f.drive_file_id}` : f.file_url}
                    download={f.file_name}
                    className="btn btn-sm btn-outline"
                    title="Download"
                  >
                    <FiDownload size={13} />
                  </a>
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
              <h3>Assign Tutor(s) to Order {order.order_code || `#${order.id}`}</h3>
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
