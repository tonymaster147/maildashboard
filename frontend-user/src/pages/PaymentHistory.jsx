// PaymentHistory — v2 styled card list. API contract unchanged.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiArrowRight } from 'react-icons/fi';
import { getPaymentHistory } from '../services/api';
import { C } from '../theme/tokens';
import { Card, Pill } from '../components/ui';

const STATUS_STYLE = {
  completed: { bg: C.greenSoft,   color: C.green },
  succeeded: { bg: C.greenSoft,   color: C.green },
  pending:   { bg: C.orangeSoft,  color: C.orangeText },
  failed:    { bg: C.redSoft,     color: C.red },
  cancelled: { bg: '#eef2f7',     color: C.textMuted },
  refunded:  { bg: C.accentSoft,  color: C.accent },
};
const styleFor = (s) => STATUS_STYLE[s] || { bg: '#eef2f7', color: C.textSecondary };

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentHistory()
      .then(res => { setPayments(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 0.3 }}>
          Payment History
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>
          Every charge on your account — newest first.
        </p>
      </div>

      {payments.length === 0 ? (
        <Card style={{ padding: '50px 30px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: C.accentSoft, color: C.accent,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <FiDollarSign size={24} />
          </div>
          <h3 style={{ color: C.textPrimary, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            No payments yet
          </h3>
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
            Once you complete a checkout, the receipt shows up here.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {payments.map(p => <PaymentRow key={p.id} payment={p} />)}
        </div>
      )}
    </div>
  );
}

function PaymentRow({ payment: p }) {
  const ss = styleFor(p.status);
  return (
    <Card style={{ padding: 16 }}>
      <div className="v2-payment-grid">
        {/* Left: order info */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3 }}>
            PAYMENT{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace', color: C.textSecondary, fontWeight: 700 }}>
              #{p.id}
            </span>
            {' · '}
            {new Date(p.created_at).toLocaleDateString()}
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700, color: C.textPrimary, marginTop: 4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {p.course_name || `Order #${p.order_id || 'N/A'}`}
          </div>
          {p.stripe_payment_id && (
            <div style={{
              fontSize: 11, color: C.textMuted, marginTop: 4,
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {p.stripe_payment_id}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <Pill bg={ss.bg} color={ss.color}>{p.status}</Pill>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Amount
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.accent, marginTop: 2 }}>
            ${parseFloat(p.amount).toFixed(2)}
          </div>
        </div>

        {/* Order link */}
        {p.order_id && (
          <Link
            to={`/orders/${p.order_id}`}
            title="Open order"
            aria-label="Open order"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: C.accentSoft, color: C.accent,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', flexShrink: 0,
            }}
          >
            <FiArrowRight size={16} />
          </Link>
        )}
      </div>
    </Card>
  );
}
