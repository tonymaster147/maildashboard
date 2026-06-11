// PaymentCancel — v2 styled. 5-second auto-redirect to /new-order with
// resumeOrderId state is preserved verbatim.

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { FiAlertTriangle, FiArrowLeft, FiHome } from 'react-icons/fi';
import { C } from '../theme/tokens';

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
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: C.radiusXl, boxShadow: C.shadowLg, padding: 32,
        textAlign: 'center',
      }}>
        {/* Warning ring */}
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
          boxShadow: '0 12px 28px rgba(245, 158, 11, 0.32)',
        }}>
          <FiAlertTriangle size={42} color="#fff" strokeWidth={2.5} />
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 800, color: C.textPrimary,
          margin: '0 0 8px', letterSpacing: 0.2,
        }}>
          Payment Cancelled
        </h1>
        <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 22px', lineHeight: 1.5 }}>
          Your payment was cancelled — but your order draft is saved.
        </p>

        {/* Countdown notice */}
        <div style={{
          background: C.orangeSoft, border: `1px solid ${C.orange}`,
          borderRadius: 12, padding: '14px 16px', marginBottom: 22,
        }}>
          <p style={{ color: C.orangeText, fontSize: 13, margin: 0, fontWeight: 600 }}>
            Redirecting you back to your order in{' '}
            <strong style={{ color: C.orangeText, fontSize: 15 }}>{countdown}</strong> second{countdown !== 1 ? 's' : ''}…
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            to="/new-order"
            state={{ resumeOrderId: orderId }}
            style={{
              padding: '12px 20px', borderRadius: 10, border: 'none',
              background: C.accent, color: '#fff', textDecoration: 'none',
              fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textTransform: 'uppercase',
            }}
          >
            <FiArrowLeft size={14} /> Return to Order
          </Link>
          <Link
            to="/"
            style={{
              padding: '12px 20px', borderRadius: 10,
              border: `1px solid ${C.border}`, background: C.surface, color: C.textPrimary,
              textDecoration: 'none',
              fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textTransform: 'uppercase',
            }}
          >
            <FiHome size={14} /> Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
