import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { fulfillPaymentIntent } from '../services/api';
import { FiLock } from 'react-icons/fi';

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
        <div style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', padding: 12, borderRadius: 8, marginBottom: 16, color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Partial Payment</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Paying ${amount.toFixed(2)} now &middot; ${(fullTotal - amount).toFixed(2)} remaining</div>
        </div>
      )}
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <div style={{ color: 'var(--error)', marginTop: 12, fontSize: 13 }}>{error}</div>}
      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={!stripe || submitting}
        style={{ width: '100%', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {submitting ? <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div> : <><FiLock size={16} /> Pay ${amount.toFixed(2)}</>}
      </button>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
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
        colorPrimary: '#84C225',
        colorBackground: '#ffffff',
        borderRadius: '8px'
      }
    }
  };

  return (
    <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>Complete Payment</h3>
        {onCancel && <button type="button" className="btn btn-sm btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
      <Elements stripe={stripePromise} options={options}>
        <PayForm amount={amount} fullTotal={fullTotal} isPartial={isPartial} onSuccess={onSuccess} />
      </Elements>
    </div>
  );
}
