import { useState, useEffect } from 'react';
import { getPaymentHistory } from '../services/api';
import { FiDollarSign } from 'react-icons/fi';

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentHistory().then(res => { setPayments(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>Payment History</h2>
        <p>View all your payment transactions</p>
      </div>

      {payments.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><FiDollarSign /></div>
          <h3>No payments yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Your payment history will appear here</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Order</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment ID</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td>{p.course_name || `Order #${p.order_id || 'N/A'}`}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>${parseFloat(p.amount).toFixed(2)}</td>
                  <td>
                    <span className={`badge-status ${p.status === 'completed' ? 'badge-completed' : p.status === 'pending' ? 'badge-pending' : 'badge-cancelled'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.stripe_payment_id || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
