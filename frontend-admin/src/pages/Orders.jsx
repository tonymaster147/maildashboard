import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiEye, FiUserPlus, FiX, FiRefreshCw, FiChevronLeft, FiChevronRight, FiFilter } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { getPublicStatuses } from '../services/api';
import CancelOrderModal from '../components/CancelOrderModal';
import PaymentCollectionModal from '../components/PaymentCollectionModal';
import InstallmentPlanModal from '../components/InstallmentPlanModal';
import { isPartialEligible, PARTIAL_PAYMENT_AMOUNT } from '../utils/partialPayment';

const VIEWED_ORDERS_KEY = 'admin_viewed_orders';

const getViewedOrders = () => {
  try { return new Set(JSON.parse(localStorage.getItem(VIEWED_ORDERS_KEY) || '[]')); }
  catch { return new Set(); }
};

const markOrderViewed = (id) => {
  const viewed = getViewedOrders();
  viewed.add(id);
  localStorage.setItem(VIEWED_ORDERS_KEY, JSON.stringify([...viewed]));
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [adminStatuses, setAdminStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');         // admin_status_code (or '')
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState(null);
  const [selectedTutors, setSelectedTutors] = useState([]);
  const [viewedIds, setViewedIds] = useState(getViewedOrders);
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const perPage = 100;
  const { getAllOrders, getOrderFilterOptions, updateOrderStatus, assignTutors, reopenChat, getAllTutors } = useApi();
  const { isAdmin, user } = useAuth();
  const canMarkPaid = isAdmin || user?.role === 'sales_lead';
  const [paymentModal, setPaymentModal] = useState(null);     // { order, targetCode, paymentType }
  const [installmentModal, setInstallmentModal] = useState(null); // order-like object

  // Advanced filters (ID prefix, type, plan, tutor, source, tutor status, dates)
  const emptyAdv = { code_prefix: '', order_type_id: '', plan_tier: '', tutor_id: '', source_url: '', tutor_status_code: '', start_date: '', end_date: '' };
  const [showFilters, setShowFilters] = useState(false);
  const [advForm, setAdvForm] = useState(emptyAdv);   // in-progress form
  const [adv, setAdv] = useState(emptyAdv);           // applied
  const [filterOptions, setFilterOptions] = useState({ orderTypes: [], tutors: [], tutorStatuses: [], prefixes: [], sources: [], planTiers: [] });
  const activeAdvCount = Object.values(adv).filter(Boolean).length;

  useEffect(() => {
    getOrderFilterOptions().then(res => setFilterOptions(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = () => {
    setLoading(true);
    const advParams = {};
    Object.entries(adv).forEach(([k, v]) => { if (v) advParams[k] = v; });
    getAllOrders({ admin_status_code: filter || undefined, search, page, limit: perPage, ...advParams })
      .then(res => { setOrders(res.data.orders); setTotalOrders(res.data.total); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, [filter, page, adv]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyAdv = () => { setPage(1); setAdv(advForm); };
  const clearAdv = () => { setAdvForm(emptyAdv); setPage(1); setAdv(emptyAdv); };
  useEffect(() => { getAllTutors().then(res => setTutors(res.data)); }, []);
  useEffect(() => { getPublicStatuses('admin').then(res => setAdminStatuses((res.data.statuses || []).filter(s => s.is_active))); }, []);

  const [cancelTarget, setCancelTarget] = useState(null); // { orderId }
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const handleStatusChange = async (order, admin_status_code) => {
    const id = order.id;
    if (admin_status_code === 'cancelled') {
      setCancelTarget({ orderId: id, orderCode: order.order_code });
      return;
    }
    // Unpaid → Paid (Full/Partial): collect payment info via modal, role-gated.
    const targetIsPaid = /^paid_(full|partial)/.test(admin_status_code || '');
    if (order.admin_status_code === 'unpaid' && targetIsPaid) {
      if (!canMarkPaid) {
        alert('Only an Admin or Sales Lead can mark an order as paid.');
        fetchOrders(); // revert the dropdown
        return;
      }
      const isPartial = admin_status_code.startsWith('paid_partial');
      if (isPartial && !isPartialEligible(order)) {
        alert('Partial payment is only available for eligible Online Class orders (total ≥ $455 or 45+ days).');
        fetchOrders(); // revert the dropdown
        return;
      }
      setPaymentModal({ order, targetCode: admin_status_code, paymentType: isPartial ? 'partial' : 'full' });
      return;
    }
    try {
      await updateOrderStatus(id, { admin_status_code });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
      fetchOrders(); // revert UI to true server state
    }
  };


  const confirmCancel = async (note) => {
    if (!cancelTarget) return;
    setCancelSubmitting(true);
    try {
      await updateOrderStatus(cancelTarget.orderId, { admin_status_code: 'cancelled', cancellation_note: note });
      setCancelTarget(null);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const openAssign = (order) => {
    setAssignModal(order);
    if (order.tutor_ids) {
      // tutor_ids comes back as a comma-separated string from MySQL GROUP_CONCAT
      const ids = order.tutor_ids.split(',').map(id => parseInt(id, 10));
      setSelectedTutors(ids);
    } else {
      setSelectedTutors([]);
    }
  };

  const handleAssign = async () => {
    await assignTutors(assignModal.id, { tutor_ids: selectedTutors });
    setAssignModal(null);
    fetchOrders();
  };

  const handleReopen = async (id) => {
    await reopenChat(id);
    fetchOrders();
  };

  const toggleTutor = (id) => {
    setSelectedTutors(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  return (
    <div>
      <div className="page-header"><h2>Order Management</h2><p>Manage and assign orders</p></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button key="all" className={`btn btn-sm ${filter === '' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilter(''); setPage(1); }}>All</button>
        {adminStatuses.map(s => (
          <button key={s.code} className={`btn btn-sm ${filter === s.code ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilter(s.code); setPage(1); }}>{s.name}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} onKeyDown={e => e.key === 'Enter' && fetchOrders()} />
        <button className="btn btn-secondary" onClick={() => { setPage(1); fetchOrders(); }}><FiSearch size={16} /></button>
        <button className={`btn btn-sm ${showFilters || activeAdvCount ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(s => !s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FiFilter size={15} /> Filters{activeAdvCount ? ` (${activeAdvCount})` : ''}
        </button>
        {activeAdvCount > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={clearAdv} title="Clear filters"><FiX size={14} /> Clear</button>
        )}
      </div>

      {showFilters && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, alignItems: 'end' }}>
            <FilterSelect label="By ID (prefix)" value={advForm.code_prefix} onChange={v => setAdvForm(f => ({ ...f, code_prefix: v }))}
              options={filterOptions.prefixes.map(p => ({ value: p, label: p }))} />
            <FilterSelect label="By Type" value={advForm.order_type_id} onChange={v => setAdvForm(f => ({ ...f, order_type_id: v }))}
              options={filterOptions.orderTypes.map(t => ({ value: String(t.id), label: t.name }))} />
            <FilterSelect label="By Plan" value={advForm.plan_tier} onChange={v => setAdvForm(f => ({ ...f, plan_tier: v }))}
              options={filterOptions.planTiers.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
            <FilterSelect label="By Tutor" value={advForm.tutor_id} onChange={v => setAdvForm(f => ({ ...f, tutor_id: v }))}
              options={filterOptions.tutors.map(t => ({ value: String(t.id), label: t.name }))} />
            <FilterSelect label="By Source" value={advForm.source_url} onChange={v => setAdvForm(f => ({ ...f, source_url: v }))}
              options={filterOptions.sources.map(s => ({ value: s, label: s }))} />
            <FilterSelect label="By Tutor Status" value={advForm.tutor_status_code} onChange={v => setAdvForm(f => ({ ...f, tutor_status_code: v }))}
              options={filterOptions.tutorStatuses.map(s => ({ value: s.code, label: s.name }))} />
            <div className="form-group mb-0">
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Start Date</label>
              <input type="date" className="form-input" value={advForm.start_date} onChange={e => setAdvForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="form-group mb-0">
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>End Date</label>
              <input type="date" className="form-input" value={advForm.end_date} onChange={e => setAdvForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={applyAdv}><FiFilter size={14} /> Apply Filters</button>
            <button className="btn btn-secondary btn-sm" onClick={clearAdv}><FiRefreshCw size={14} /> Clear</button>
          </div>
        </div>
      )}

      {loading ? <div className="flex-center"><div className="loading-spinner"></div></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>ID</th><th>Source</th><th>User</th><th>Course</th><th>Type</th><th>Plan</th><th>Total</th><th>Tutor(s)</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {orders.map(o => {
                const isNew = !viewedIds.has(o.id);
                return (
                <tr key={o.id} style={isNew ? { background: 'rgba(132,194,37,0.08)', boxShadow: 'inset 3px 0 0 var(--accent)' } : {}}>
                  <td>{o.order_code || `#${o.id}`}{isNew && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}></span>}</td>
                  <td><div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.source_url || 'Direct'}>{o.source_url || 'Direct'}</div></td>
                  <td>{o.username}</td>
                  <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.course_name}</td>
                  <td>{o.order_type_name}</td>
                  <td>{o.plan_tier ? o.plan_tier.charAt(0).toUpperCase() + o.plan_tier.slice(1) : (o.plan_name || '—')}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    ${parseFloat(o.total_price).toFixed(2)}
                    {o.payment_type === 'partial' && parseFloat(o.amount_remaining) > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#f59e0b', padding: '2px 6px', borderRadius: 4, marginLeft: 6, letterSpacing: 0.3 }} title={`Paid $${parseFloat(o.amount_paid).toFixed(2)} | Remaining $${parseFloat(o.amount_remaining).toFixed(2)}`}>PARTIAL</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{o.tutor_names || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                  <td>
                    <select className="form-select" value={o.admin_status_code || ''} onChange={e => handleStatusChange(o, e.target.value)} style={{ padding: '4px 8px', fontSize: 12, minWidth: 140 }}>
                      {!o.admin_status_code && <option value="" disabled>—</option>}
                      {adminStatuses.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                    {o.tutor_status_code && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }} title="Tutor work status">
                        Tutor: <span style={{ color: o.tutor_status_code === 'completed' ? 'var(--success)' : o.tutor_status_code === 'work_stopped' ? 'var(--warning)' : 'var(--accent)' }}>{o.tutor_status_name}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Link to={`/orders/${o.id}`} className="btn btn-sm btn-outline" onClick={() => { markOrderViewed(o.id); setViewedIds(prev => new Set([...prev, o.id])); }}><FiEye size={12} /></Link>
                      <button className="btn btn-sm btn-secondary" onClick={() => openAssign(o)} title="Assign Tutor"><FiUserPlus size={12} /></button>
                      {!o.chat_enabled && <button className="btn btn-sm btn-secondary" onClick={() => handleReopen(o.id)} title="Reopen Chat"><FiRefreshCw size={12} /></button>}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Pagination */}
      {totalOrders > perPage && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
          <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <FiChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Page {page} of {Math.ceil(totalOrders / perPage)} <span style={{ color: 'var(--text-muted)' }}>({totalOrders} orders)</span>
          </span>
          <button className="btn btn-sm btn-secondary" disabled={page >= Math.ceil(totalOrders / perPage)} onClick={() => setPage(p => p + 1)}>
            Next <FiChevronRight size={14} />
          </button>
        </div>
      )}
      {cancelTarget && (
        <CancelOrderModal
          orderId={cancelTarget.orderId}
          orderCode={cancelTarget.orderCode}
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
          submitting={cancelSubmitting}
        />
      )}
      {paymentModal && (() => {
        const { order, targetCode, paymentType } = paymentModal;
        const isPartial = paymentType === 'partial';
        const total = parseFloat(order.total_price || 0);
        return (
          <PaymentCollectionModal
            title={`Record Payment — Order ${order.order_code || `#${order.id}`}`}
            subtitle={`Marking as ${isPartial ? 'Paid — Partial' : 'Paid — Full'} · Order total $${total.toFixed(2)}`}
            amountLabel={isPartial ? 'Upfront amount' : 'Amount'}
            amount={isPartial ? Math.min(PARTIAL_PAYMENT_AMOUNT, total) : total}
            maxAmount={total}
            noteRequiredWhenDifferent={!isPartial}
            showRemaining={isPartial}
            remainingBase={total}
            onClose={() => { setPaymentModal(null); fetchOrders(); }}
            onSubmit={async (payment) => {
              await updateOrderStatus(order.id, { admin_status_code: targetCode, payment });
              const remaining = Math.max(0, total - payment.amount);
              setPaymentModal(null);
              fetchOrders();
              if (isPartial && remaining > 0) {
                setInstallmentModal({ ...order, payment_type: 'partial', amount_remaining: remaining, has_installments: 0 });
              }
            }}
          />
        );
      })()}
      {installmentModal && (
        <InstallmentPlanModal
          order={installmentModal}
          onClose={() => { setInstallmentModal(null); fetchOrders(); }}
          onCreated={() => { setInstallmentModal(null); fetchOrders(); }}
        />
      )}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3>Assign Tutor(s) to Order {assignModal.order_code || `#${assignModal.id}`}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setAssignModal(null)}><FiX size={16} /></button>
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

// Small labelled dropdown used by the Orders filter panel.
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="form-group mb-0">
      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</label>
      <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
