// EmbeddedCheckout — v2 styled Stripe Payment Element.
// Payment flow (submit → confirmPayment → fulfillPaymentIntent) is unchanged;
// only the chrome around the Stripe iframe and the Stripe `appearance`
// variables moved to the v2 design tokens.

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, AddressElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { fulfillPaymentIntent } from '../services/api';
import { FiLock, FiX, FiCreditCard } from 'react-icons/fi';
import { C } from '../theme/tokens';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function PayForm({ amount, onSuccess, isPartial, fullTotal }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError('');

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message);
      setSubmitting(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required'
    });

    if (confirmError) {
      setError(confirmError.message);
      setSubmitting(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        const res = await fulfillPaymentIntent({ payment_intent_id: paymentIntent.id });
        onSuccess(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Fulfillment failed');
        setSubmitting(false);
      }
    } else {
      setError('Payment did not complete. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {isPartial && (
        <div style={{
          background: C.orangeSoft, border: `1px solid ${C.orange}`,
          padding: '12px 14px', borderRadius: 10, marginBottom: 16,
        }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.orangeText, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Partial Payment
          </div>
          <div style={{ fontSize: 12, color: C.orangeText, marginTop: 3, fontWeight: 600 }}>
            Paying ${amount.toFixed(2)} now · ${(fullTotal - amount).toFixed(2)} remaining
          </div>
        </div>
      )}

      <PaymentElement options={{ layout: 'tabs' }} />

      <div style={{
        marginTop: 18, marginBottom: 8,
        fontSize: 11, fontWeight: 700, color: C.textMuted,
        letterSpacing: 0.5, textTransform: 'uppercase',
      }}>
        Billing Address
      </div>
      <AddressElement options={{ mode: 'billing', autocomplete: { mode: 'disabled' } }} />

      {error && (
        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 8,
          background: C.redSoft, color: C.red, fontSize: 13, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          width: '100%', marginTop: 20, padding: '14px 20px',
          background: C.accent, color: '#fff', border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
          cursor: (!stripe || submitting) ? 'not-allowed' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: (!stripe || submitting) ? 0.7 : 1,
          boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)',
          transition: 'all 0.15s ease',
        }}
      >
        {submitting
          ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          : <><FiLock size={15} /> Pay ${amount.toFixed(2)}</>}
      </button>

      <p style={{
        fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}>
        <FiLock size={10} /> Secure payment powered by Stripe
      </p>
    </form>
  );
}

export default function EmbeddedCheckout({ clientSecret, amount, isPartial, fullTotal, onSuccess, onCancel }) {
  if (!clientSecret) return null;

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: C.accent,
        colorBackground: '#ffffff',
        colorText: C.textPrimary,
        colorTextSecondary: C.textSecondary,
        colorTextPlaceholder: C.textMuted,
        colorDanger: C.red,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        borderRadius: '8px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          border: `1px solid ${C.border}`,
          boxShadow: 'none',
        },
        '.Input:focus': {
          border: `1px solid ${C.accent}`,
          boxShadow: `0 0 0 3px ${C.accentSoft}`,
        },
        '.Label': {
          fontSize: '12px',
          fontWeight: '600',
          color: C.textSecondary,
        },
        '.Tab--selected': {
          borderColor: C.accent,
        },
      },
    },
  };

  return (
    <div style={{
      maxWidth: 520, margin: '0 auto',
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: C.radiusXl, boxShadow: C.shadow,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: C.accentSoft, color: C.accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FiCreditCard size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: 14, fontWeight: 800, color: C.textPrimary,
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>
            Complete Payment
          </h3>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
            Total due now: <strong style={{ color: C.accent }}>${amount.toFixed(2)}</strong>
          </div>
        </div>
        {onCancel && (
          <button
            type="button" onClick={onCancel} aria-label="Cancel payment"
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: '#f1f5f9', color: C.textSecondary, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <FiX size={15} />
          </button>
        )}
      </div>

      {/* Stripe form */}
      <div style={{ padding: 20 }}>
        <Elements stripe={stripePromise} options={options}>
          <PayForm amount={amount} fullTotal={fullTotal} isPartial={isPartial} onSuccess={onSuccess} />
        </Elements>
      </div>
    </div>
  );
}
