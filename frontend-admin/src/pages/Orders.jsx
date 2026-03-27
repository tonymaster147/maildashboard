import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllOrders, updateOrderStatus, assignTutors, reopenChat, getAllTutors } from '../services/api';
import { FiSearch, FiEye, FiUserPlus, FiX, FiRefreshCw } from 'react-icons/fi';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState(null);
  const [selectedTutors, setSelectedTutors] = useState([]);

  const fetchOrders = () => {
    setLoading(true);
    getAllOrders({ status: filter, search }).then(res => { setOrders(res.data.orders); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, [filter]);
  useEffect(() => { getAllTutors().then(res => setTutors(res.data)); }, []);

  const handleStatusChange = async (id, status) => {
    await updateOrderStatus(id, { status });
    fetchOrders();
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
        {['', 'pending', 'active', 'in_progress', 'completed', 'cancelled'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>{s || 'All'}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input className="form-input" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} onKeyDown={e => e.key === 'Enter' && fetchOrders()} />
        <button className="btn btn-secondary" onClick={fetchOrders}><FiSearch size={16} /></button>
      </div>
      {loading ? <div className="flex-center"><div className="loading-spinner"></div></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>ID</th><th>User</th><th>Course</th><th>Type</th><th>Plan</th><th>Total</th><th>Tutor(s)</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{o.username}</td>
                  <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.course_name}</td>
                  <td>{o.order_type_name}</td>
                  <td>{o.plan_name}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>${parseFloat(o.total_price).toFixed(2)}</td>
                  <td style={{ fontSize: 13 }}>{o.tutor_names || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                  <td>
                    <select className="form-select" value={o.status} onChange={e => handleStatusChange(o.id, e.target.value)} style={{ padding: '4px 8px', fontSize: 12, minWidth: 110 }}>
                      <option value="pending">Pending</option><option value="active">Active</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Link to={`/orders/${o.id}`} className="btn btn-sm btn-outline"><FiEye size={12} /></Link>
                      <button className="btn btn-sm btn-secondary" onClick={() => openAssign(o)} title="Assign Tutor"><FiUserPlus size={12} /></button>
                      {!o.chat_enabled && <button className="btn btn-sm btn-secondary" onClick={() => handleReopen(o.id)} title="Reopen Chat"><FiRefreshCw size={12} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3>Assign Tutor(s) to Order #{assignModal.id}</h3>
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
