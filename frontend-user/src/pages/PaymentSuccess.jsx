import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyPayment } from '../services/api';
import { FiCheckCircle, FiArrowRight } from 'react-icons/fi';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      verifyPayment(sessionId).then(res => { setPayment(res.data); setLoading(false); }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) return <div className="loading-page"><div className="loading-spinner"></div></div>;

  return (
    <div className="auth-container">
      <div className="auth-card text-center">
        <div style={{ color: 'var(--success)', marginBottom: 16 }}><FiCheckCircle size={64} /></div>
        <h1 style={{ marginBottom: 8 }}>Payment Successful!</h1>
        <p className="subtitle">Your order has been created and is being processed.</p>

        {payment && (
          <div style={{ background: 'var(--bg-input)', padding: 20, borderRadius: 'var(--radius)', margin: '24px 0', textAlign: 'left' }}>
            <div className="summary-row"><span className="label">Amount</span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>${parseFloat(payment.amount).toFixed(2)}</span></div>
            <div className="summary-row"><span className="label">Status</span><span className="badge-status badge-completed">{payment.status}</span></div>
            {payment.order_id && <div className="summary-row"><span className="label">Order</span><span>#{payment.order_id}</span></div>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {payment?.order_id && <Link to={`/orders/${payment.order_id}`} className="btn btn-primary btn-lg" style={{ width: '100%' }}>View Order <FiArrowRight size={16} /></Link>}
          <Link to="/" className="btn btn-secondary btn-lg" style={{ width: '100%' }}>Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
