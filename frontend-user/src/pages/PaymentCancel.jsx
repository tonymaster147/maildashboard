import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { FiAlertCircle, FiArrowLeft } from 'react-icons/fi';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/new-order', { state: { resumeOrderId: orderId } });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate, orderId]);

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ marginBottom: 8 }}>Payment Cancelled</h1>
        <p className="subtitle" style={{ marginBottom: 24 }}>Your payment was cancelled. Your order draft has been saved.</p>
        
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: 24 }}>
          <FiAlertCircle size={20} style={{ color: 'var(--warning)', marginBottom: 8 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>Redirecting you back to your order in <strong style={{ color: 'var(--warning)' }}>{countdown}</strong> seconds...</p>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link to="/new-order" state={{ resumeOrderId: orderId }} className="btn btn-primary"><FiArrowLeft size={16} /> Return to Order</Link>
          <Link to="/" className="btn btn-secondary">Go to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
