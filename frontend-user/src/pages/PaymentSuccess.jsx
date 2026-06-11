// PaymentSuccess — v2 styled. verifyPayment API + URL-param flow unchanged.

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiCheck, FiArrowRight, FiHome } from 'react-icons/fi';
import { verifyPayment } from '../services/api';
import { C } from '../theme/tokens';
import { Row } from '../components/ui';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      verifyPayment(sessionId)
        .then(res => { setPayment(res.data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: C.bg,
      }}>
        <div className="loading-spinner" />
      </div>
    );
  }

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
        {/* Success ring */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
          boxShadow: '0 12px 28px rgba(34, 197, 94, 0.35)',
        }}>
          <FiCheck size={48} color="#fff" strokeWidth={3} />
        </div>

        <h1 style={{
          fontSize: 24, fontWeight: 800, color: C.textPrimary,
          margin: '0 0 8px', letterSpacing: 0.2,
        }}>
          Payment Successful
        </h1>
        <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
          Your order has been created and is being processed. We'll keep you posted.
        </p>

        {payment && (
          <div style={{
            background: C.surfaceHover, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: 16, margin: '0 0 22px',
            display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
          }}>
            <Row label="Amount"
              value={<span style={{ color: C.accent, fontWeight: 800, fontSize: 18 }}>
                ${parseFloat(payment.amount).toFixed(2)}
              </span>} mono={false}
            />
            <Row label="Status"
              value={<span style={{
                background: C.greenSoft, color: C.green,
                padding: '3px 10px', borderRadius: 999,
                fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
              }}>{payment.status}</span>} mono={false}
            />
            {payment.order_id && (
              <Row label="Order" value={`#${payment.order_id}`} />
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {payment?.order_id && (
            <Link to={`/orders/${payment.order_id}`} style={{
              padding: '12px 20px', borderRadius: 10, border: 'none',
              background: C.accent, color: '#fff', textDecoration: 'none',
              fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textTransform: 'uppercase',
            }}>
              View Order <FiArrowRight size={14} />
            </Link>
          )}
          <Link to="/" style={{
            padding: '12px 20px', borderRadius: 10,
            border: `1px solid ${C.border}`, background: C.surface, color: C.textPrimary,
            textDecoration: 'none',
            fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            textTransform: 'uppercase',
          }}>
            <FiHome size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
