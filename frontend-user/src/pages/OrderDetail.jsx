// OrderDetail — v2 styled. Every block from the legacy page is preserved:
// header + status, order details summary, site contact email link, payment
// summary with all 3 conditional CTAs (complete / pay remaining / pay
// installments), installment plan list, tutor list, instructions, login
// details editor (via shared UpdateCredentialModal), files with "Added later"
// pill + Drive/file_url download fallback, upload zone, tutor/support chat
// buttons, and the EmbeddedCheckout swap.

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getOrderDetail, uploadFiles, createPaymentIntent, createRemainingPaymentIntent,
  getOrderInstallments, payInstallment, payAllInstallments, checkPartialEligibility,
} from '../services/api';
import EmbeddedCheckout from '../components/EmbeddedCheckout';
import {
  FiDownload, FiArrowLeft, FiCalendar, FiUser, FiBookOpen, FiUpload, FiCreditCard,
  FiHeadphones, FiMail, FiKey, FiEdit2,
} from 'react-icons/fi';
import { C } from '../theme/tokens';
import {
  Card, Pill, Row, Avatar, initialsFrom,
  LoginDetailsCard, Stars,
} from '../components/ui';

// Resolve relative photo URLs (/uploads/foo.png) against API origin.
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const resolvePhoto = (u) => (!u ? null : (u.startsWith('http') ? u : `${API_ORIGIN}${u}`));

// Map admin/tutor status codes → pill colors (same table used by ActiveOrderCard)
const STATUS_STYLE = {
  in_progress:  { bg: C.greenSoft,  color: C.green },
  active:       { bg: C.greenSoft,  color: C.green },
  work_stopped: { bg: C.redSoft,    color: C.red },
  pending:      { bg: C.orangeSoft, color: C.orangeText },
  completed:    { bg: C.accentSoft, color: C.accent },
  cancelled:    { bg: '#eef2f7',    color: C.textMuted },
  incomplete:   { bg: C.orangeSoft, color: C.orangeText },
};
const statusStyleFor = (code) => STATUS_STYLE[code] || { bg: '#eef2f7', color: C.textSecondary };

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [installments, setInstallments] = useState([]);
  // Partial-payment option for an unpaid Online-Class order (same rule as new-order).
  const [partialElig, setPartialElig] = useState(null); // { eligible, partial_amount }
  const [payChoice, setPayChoice] = useState('full');    // 'full' | 'partial'

  const fetchOrder = () => {
    getOrderDetail(id).then(res => {
      setOrder(res.data);
      setLoading(false);
      // If it's still unpaid, check whether it qualifies for a partial payment.
      if (res.data && res.data.status === 'incomplete' && parseFloat(res.data.total_price) > 0 && !res.data.has_installments) {
        checkPartialEligibility(id).then(r => setPartialElig(r.data)).catch(() => setPartialElig(null));
      } else {
        setPartialElig(null);
      }
      if (res.data?.has_installments) {
        getOrderInstallments(id).then(r => setInstallments(r.data || [])).catch(() => setInstallments([]));
      } else {
        setInstallments([]);
      }
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handlePayInstallment = async (instId) => {
    setPaymentLoading(true);
    try {
      const res = await payInstallment(instId);
      setCheckout({ clientSecret: res.data.client_secret, amount: res.data.amount, isPartial: false, fullTotal: res.data.amount });
    } catch (err) {
      alert(err.response?.data?.error || 'Payment setup failed');
    }
    setPaymentLoading(false);
  };

  const handlePayAllInstallments = async () => {
    setPaymentLoading(true);
    try {
      const res = await payAllInstallments(id);
      setCheckout({ clientSecret: res.data.client_secret, amount: res.data.amount, isPartial: false, fullTotal: res.data.amount });
    } catch (err) {
      alert(err.response?.data?.error || 'Payment setup failed');
    }
    setPaymentLoading(false);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    formData.append('order_id', order.id);
    try {
      await uploadFiles(formData);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    }
    setUploading(false);
  };

  const handleCompletePayment = async () => {
    setPaymentLoading(true);
    try {
      const type = partialElig?.eligible ? payChoice : 'full';
      const res = await createPaymentIntent({ order_id: order.id, payment_type: type });
      setCheckout({ clientSecret: res.data.client_secret, amount: res.data.amount, isPartial: res.data.is_partial, fullTotal: res.data.full_total });
    } catch (err) {
      alert(err.response?.data?.error || 'Payment setup failed');
    }
    setPaymentLoading(false);
  };

  const handlePayRemaining = async () => {
    setPaymentLoading(true);
    try {
      const res = await createRemainingPaymentIntent({ order_id: order.id });
      setCheckout({ clientSecret: res.data.client_secret, amount: res.data.amount, isPartial: false, fullTotal: res.data.amount });
    } catch (err) {
      alert(err.response?.data?.error || 'Payment setup failed');
    }
    setPaymentLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (checkout) {
    return (
      <Card padding={0} style={{ overflow: 'hidden', maxWidth: 720, margin: '24px auto' }}>
        <EmbeddedCheckout
          clientSecret={checkout.clientSecret}
          amount={checkout.amount}
          isPartial={checkout.isPartial}
          fullTotal={checkout.fullTotal}
          onSuccess={() => { setCheckout(null); fetchOrder(); }}
          onCancel={() => setCheckout(null)}
        />
      </Card>
    );
  }

  if (!order) {
    return (
      <Card style={{ textAlign: 'center', padding: 40 }}>
        <h3 style={{ color: C.textPrimary }}>Order not found</h3>
      </Card>
    );
  }

  const orderCode = order.order_code || `#${order.id}`;
  const statusCode = order.admin_status_code || order.status;
  const statusName = order.admin_status_name || order.status || '—';
  const statusStyle = statusStyleFor(statusCode);
  const tutors = Array.isArray(order.tutors) ? order.tutors : [];

  return (
    <div>
      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        <Link
          to="/orders"
          aria-label="Back to orders"
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: '#f1f5f9', color: C.textSecondary,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          <FiArrowLeft size={16} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3 }}>
            ORDER ID:{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace', color: C.textSecondary, fontWeight: 700 }}>{orderCode}</span>
          </div>
          <h2 style={{
            fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: '4px 0 0',
            letterSpacing: 0.3, textTransform: 'uppercase',
          }}>
            {order.course_name || order.subject_name || order.order_type_name || 'Order'}
          </h2>
        </div>
        <Pill bg={statusStyle.bg} color={statusStyle.color} style={{ fontSize: 12, padding: '6px 14px' }}>
          {statusName}
        </Pill>
      </div>

      {/* ── Two-column: Details + Payment ──────────────── */}
      <div className="v2-detail-grid">
        {/* Order Details card */}
        <Card>
          <SectionTitle icon={FiBookOpen}>Order Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="Type"    value={order.order_type_name || '—'} mono={false} />
            <Row label="Course"  value={order.course_name || '—'} mono={false} />
            <Row label="Subject" value={order.subject_name || '—'} mono={false} />
            <Row label="Level"   value={order.education_level_name || '—'} mono={false} />
            <Row label="Plan"
              value={
                <span style={{ color: C.accent, fontWeight: 700 }}>
                  {order.plan_tier ? capitalize(order.plan_tier) : (order.plan_name || '—')}
                </span>
              }
              mono={false}
            />
            <Row label="Start" value={fmtDate(order.start_date)} mono={false} />
            <Row label="End"   value={fmtDate(order.end_date)} mono={false} />
            <Row label="Weeks" value={order.num_weeks ?? '—'} mono={false} />
          </div>

          {order.site_contact_email && (
            <a
              href={`mailto:${order.site_contact_email}?subject=${encodeURIComponent(`Order ${orderCode} — ${order.course_name || ''}`)}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 14,
                padding: '10px 12px', background: C.accentSoft2 || '#eff6ff',
                border: `1px solid ${C.border}`, borderRadius: 8,
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <FiMail size={16} style={{ color: C.accent, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Need help with this order?</div>
                <div style={{
                  fontWeight: 600, fontSize: 13, color: C.accent,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {order.site_contact_email}
                </div>
              </div>
            </a>
          )}
        </Card>

        {/* Payment card */}
        <Card>
          <SectionTitle icon={FiCreditCard}>Payment</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="Plan Price" value={`$${parseFloat(order.price).toFixed(2)}`} mono={false} />
            {parseFloat(order.urgent_fee) > 0 && (
              <Row label="Urgent Fee" value={<span style={{ color: C.orangeText }}>+${parseFloat(order.urgent_fee).toFixed(2)}</span>} mono={false} />
            )}
            {parseFloat(order.discount_amount) > 0 && (
              <Row label="Discount" value={<span style={{ color: C.green }}>−${parseFloat(order.discount_amount).toFixed(2)}</span>} mono={false} />
            )}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderTop: `1px solid ${C.border}`, marginTop: 4,
            }}>
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Total
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>
                ${parseFloat(order.total_price).toFixed(2)}
              </span>
            </div>
            {order.payment_type === 'partial' && parseFloat(order.amount_remaining) > 0 && (
              <>
                <Row label="Paid" value={<span style={{ color: C.green }}>${parseFloat(order.amount_paid).toFixed(2)}</span>} mono={false} />
                {parseFloat(order.convenience_fee || 0) > 0 && (
                  <Row label="Conv Fee" value={<span style={{ color: C.orangeText }}>+${parseFloat(order.convenience_fee).toFixed(2)}</span>} mono={false} />
                )}
                <Row
                  label="Remaining"
                  value={<span style={{ color: C.orangeText, fontWeight: 700 }}>${parseFloat(order.amount_remaining).toFixed(2)}</span>}
                  mono={false}
                />
              </>
            )}
          </div>

          {/* Conditional payment CTAs — same logic as legacy page */}
          {order.status === 'incomplete' && parseFloat(order.total_price) > 0 && partialElig?.eligible && (
            <div style={{ marginTop: 14, padding: 14, background: C.accentSoft, border: `1px solid ${C.accentSoft}`, borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 10, color: C.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Payment Option
              </div>
              <PayChoiceRow
                checked={payChoice === 'full'} onChange={() => setPayChoice('full')}
                title="Pay Full Now" sub={`$${parseFloat(order.total_price).toFixed(2)}`}
              />
              <PayChoiceRow
                checked={payChoice === 'partial'} onChange={() => setPayChoice('partial')}
                title="Pay Partial"
                sub={`$${Number(partialElig.partial_amount).toFixed(2)} now · $${(parseFloat(order.total_price) - Number(partialElig.partial_amount)).toFixed(2)} later`}
              />
            </div>
          )}
          {order.status === 'incomplete' && parseFloat(order.total_price) > 0 && (
            <PrimaryButton onClick={handleCompletePayment} disabled={paymentLoading} icon={FiCreditCard}>
              {partialElig?.eligible && payChoice === 'partial'
                ? `Pay $${Number(partialElig.partial_amount).toFixed(2)} Now`
                : 'Complete Payment'}
            </PrimaryButton>
          )}
          {order.payment_type === 'partial' && parseFloat(order.amount_remaining) > 0 && order.status !== 'incomplete' && !order.has_installments && (
            <PrimaryButton
              onClick={handlePayRemaining} disabled={paymentLoading} icon={FiCreditCard}
              gradient={`linear-gradient(135deg, ${C.orange}, ${C.orangeText})`}
            >
              Pay Remaining ${parseFloat(order.amount_remaining).toFixed(2)}
            </PrimaryButton>
          )}
          {!!order.has_installments && installments.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Installment Plan
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {installments.map(i => {
                  const isPaid = i.status === 'paid';
                  const isOverdue = i.status === 'overdue';
                  const tone = isPaid
                    ? { bg: C.greenSoft,  border: C.green,  text: C.green }
                    : isOverdue
                      ? { bg: C.redSoft,    border: C.red,    text: C.red }
                      : { bg: '#f6f7fb',    border: C.border, text: C.orangeText };
                  return (
                    <div
                      key={i.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: 12, background: tone.bg, border: `1px solid ${tone.border}`,
                        borderRadius: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: C.textPrimary }}>Installment {i.installment_number}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          Due {fmtDate(i.due_date)} ·{' '}
                          <span style={{ textTransform: 'uppercase', fontWeight: 700, color: tone.text, letterSpacing: 0.3 }}>{i.status}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 15, color: C.textPrimary }}>${parseFloat(i.amount).toFixed(2)}</strong>
                        {!isPaid && (
                          <button
                            type="button" onClick={() => handlePayInstallment(i.id)} disabled={paymentLoading}
                            style={{
                              padding: '7px 14px', background: C.accent, color: '#fff', border: 'none',
                              borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, cursor: 'pointer',
                            }}
                          >
                            PAY
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {installments.some(i => i.status !== 'paid') && (
                <PrimaryButton
                  onClick={handlePayAllInstallments} disabled={paymentLoading}
                  gradient={`linear-gradient(135deg, ${C.orange}, ${C.orangeText})`}
                >
                  Pay All Remaining ${installments.filter(i => i.status !== 'paid').reduce((s, i) => s + parseFloat(i.amount), 0).toFixed(2)}
                </PrimaryButton>
              )}
            </div>
          )}

          {/* Assigned tutors (array — multi-tutor support) */}
          {tutors.length > 0 && (
            <div style={{
              marginTop: 18, padding: '12px 14px',
              background: C.surfaceHover, borderRadius: 10, border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                <FiUser size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Assigned Tutor{tutors.length > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {tutors.map((t, i) => (
                  <div key={t.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar
                      initials={initialsFrom(t.name)} size={28}
                      bg={C.indigoSoft} color={C.indigo} photo={resolvePhoto(t.photo_url)}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{t.name}</div>
                      <Stars value={t.rating} size={10} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Instructions ───────────────────────────────── */}
      {order.additional_instructions && (
        <Card style={{ marginTop: 16 }}>
          <SectionTitle icon={FiEdit2}>Instructions</SectionTitle>
          <p style={{ color: C.textSecondary, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
            {order.additional_instructions}
          </p>
        </Card>
      )}

      {/* ── Login Details (per-order; reuses shared widget) ── */}
      <div style={{ marginTop: 16 }}>
        <LoginDetailsCard orders={[order]} onChanged={fetchOrder} />
      </div>

      {/* ── Files ─────────────────────────────────────── */}
      <Card style={{ marginTop: 16 }}>
        <SectionTitle icon={FiDownload}>
          Files {order.files ? `(${order.files.length})` : '(0)'}
        </SectionTitle>

        {order.files?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {order.files.map(file => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        )}

        {!['completed', 'cancelled', 'incomplete', 'pending'].includes(order.status) && (
          <UploadZone uploading={uploading} onUpload={handleFileUpload} />
        )}
      </Card>

      {/* ── Tutor + Support chat CTAs ──────────────────── */}
      {!!order.chat_enabled && (
        <div className="v2-chat-cta-row">
          {tutors.length > 0 ? (
            <Link
              to={`/chat/tutor/${order.id}`}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 18px', borderRadius: 10, textDecoration: 'none',
                background: C.indigoSoft, color: C.indigo, fontWeight: 700, letterSpacing: 0.4,
                fontSize: 13, textTransform: 'uppercase',
              }}
            >
              <FiUser size={16} /> Tutor Chat
            </Link>
          ) : (
            <div
              title="A tutor hasn't been assigned to this order yet"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 18px', borderRadius: 10,
                background: '#eef2f7', color: C.textMuted, fontWeight: 700, letterSpacing: 0.4,
                fontSize: 13, textTransform: 'uppercase', cursor: 'not-allowed',
              }}
            >
              <FiUser size={16} /> Tutor Chat — Not assigned yet
            </div>
          )}
          <Link
            to={`/chat/support/${order.id}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 18px', borderRadius: 10, textDecoration: 'none',
              background: C.greenSoft, color: C.green, fontWeight: 700, letterSpacing: 0.4,
              fontSize: 13, textTransform: 'uppercase',
            }}
          >
            <FiHeadphones size={16} /> Support Chat
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────
function SectionTitle({ icon: Icon, children }) {
  return (
    <h3 style={{
      fontSize: 13, fontWeight: 800, color: C.textPrimary, margin: '0 0 14px',
      letterSpacing: 0.5, textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {Icon && <Icon size={14} color={C.accent} />}
      {children}
    </h3>
  );
}

function PrimaryButton({ onClick, disabled, icon: Icon, gradient, children }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        marginTop: 14, width: '100%', padding: '13px 18px',
        background: gradient || C.accent, color: '#fff', border: 'none', borderRadius: 10,
        fontSize: 14, fontWeight: 700, letterSpacing: 0.4, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: disabled ? 0.7 : 1,
        textTransform: 'uppercase',
      }}
    >
      {disabled
        ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
        : <>{Icon && <Icon size={16} />} {children}</>}
    </button>
  );
}

// Full/Partial radio row for the unpaid-order payment option (mirrors new order).
function PayChoiceRow({ checked, onChange, title, sub }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
      padding: '10px 12px', borderRadius: 9, marginBottom: 6,
      background: checked ? '#fff' : 'transparent',
      border: `1px solid ${checked ? C.accent : C.border}`,
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${checked ? C.accent : C.borderStrong || C.border}`,
        display: 'grid', placeItems: 'center',
      }}>
        {checked && <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.accent }} />}
      </span>
      <input type="radio" checked={checked} onChange={onChange} style={{ display: 'none' }} />
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: C.textPrimary }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: C.textSecondary, marginTop: 1 }}>{sub}</span>
      </span>
    </label>
  );
}

function FileRow({ file }) {
  const isPostSubmit = Number(file.is_post_submit) === 1;
  const href = file.drive_file_id
    ? `https://drive.google.com/uc?export=download&id=${file.drive_file_id}`
    : file.file_url;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', background: C.surfaceHover,
      border: `1px solid ${C.border}`, borderRadius: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: C.textPrimary,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
          }}>
            {file.file_name}
          </span>
          {isPostSubmit && (
            <Pill bg={C.orangeSoft} color={C.orangeText}>Added later</Pill>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
          Uploaded by {file.uploaded_by_role} · {fmtDate(file.created_at)}
        </div>
      </div>
      <a
        href={href} download={file.file_name} title="Download"
        style={{
          width: 34, height: 34, borderRadius: 8,
          background: C.accentSoft, color: C.accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', flexShrink: 0,
        }}
      >
        <FiDownload size={14} />
      </a>
    </div>
  );
}

function UploadZone({ uploading, onUpload }) {
  return (
    <>
      <div
        onClick={() => document.getElementById('user-upload-files').click()}
        style={{
          padding: 22, border: `2px dashed ${C.border}`, borderRadius: 10,
          textAlign: 'center', cursor: 'pointer', background: C.surfaceHover,
        }}
      >
        {uploading ? (
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        ) : (
          <>
            <FiUpload size={22} style={{ marginBottom: 8, color: C.accent }} />
            <p style={{ color: C.textSecondary, fontSize: 13, margin: 0, fontWeight: 600 }}>
              Click to upload additional files
            </p>
          </>
        )}
      </div>
      <input id="user-upload-files" type="file" multiple style={{ display: 'none' }} onChange={onUpload} />
    </>
  );
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
