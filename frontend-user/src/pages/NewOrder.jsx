// NewOrder — v2 styled. ALL pricing/draft/coupon/file/plan/checkout logic is
// preserved verbatim from the legacy page. Only the JSX chrome is restyled
// (step indicator → v2 pills, cards → v2 Card primitives, plan cards →
// selectable v2 cards with checkmark, sidebar summary → v2 Card with Row
// items, buttons → v2 accent buttons). DatePicker library + Notice + legacy
// .form-input class are kept as-is.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getOrderTypes, getSubjects, getEducationLevels, validateCoupon, calculatePrice,
  createPaymentIntent, uploadFiles, createDraftOrder, updateDraftOrder,
} from '../services/api';
import EmbeddedCheckout from '../components/EmbeddedCheckout';
import {
  FiUpload, FiX, FiCheck, FiArrowRight, FiArrowLeft, FiTag, FiPlus,
} from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Notice from '../components/Notice';
import { C } from '../theme/tokens';
import { Card, Pill, Row } from '../components/ui';

const STEPS = ['Service Details', 'Schedule & Plan', 'Review & Checkout'];

// Education levels surfaced in the order form (kept short on purpose)
const ALLOWED_LEVELS = ['High School', 'Undergraduate', 'Graduate', 'Post-Graduate'];

// Determine what the quantity field means per service type
const getQuantityConfig = (typeName) => {
  if (!typeName) return { label: 'Pages', placeholder: 'Number of pages', needsDueDate: true };
  const n = typeName.toLowerCase();
  if (n.includes('online class')) return { label: null, placeholder: null, needsDueDate: true, weeksOnly: true };
  if (n.includes('quiz')) return { label: 'Number of Quizzes', placeholder: 'How many quizzes?', needsDueDate: true };
  if (n.includes('exam')) return { label: 'Number of Exams', placeholder: 'How many exams?', needsDueDate: true };
  if (n.includes('test')) return { label: 'Number of Tests', placeholder: 'How many tests?', needsDueDate: true };
  if (n.includes('discussion')) return { label: 'Number of Discussions', placeholder: 'How many discussions?', needsDueDate: true };
  return { label: 'Pages', placeholder: 'Number of pages', needsDueDate: true };
};

// Which tiers to show for each service type
const getTiersForType = (typeName) => {
  if (!typeName) return ['essential', 'premium'];
  const n = typeName.toLowerCase();
  if (n.includes('online class')) return ['essential', 'priority', 'vip'];
  if (n.includes('quiz') || n.includes('exam') || n.includes('test')) return ['essential'];
  return ['essential', 'premium'];
};

export default function NewOrder() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [draftOrderId, setDraftOrderId] = useState(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [paymentType, setPaymentType] = useState('full');
  const [checkout, setCheckout] = useState(null);
  const PARTIAL_AMOUNT = 150;

  // Lookup data
  const [orderTypes, setOrderTypes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    order_type_id: '', course_name: '', subject_id: '', subject_name: '',
    education_level_id: '', due_date: '', num_pages: '', work_type: '',
    quiz_mode: '', class_type: '', class_start_date: '', partial_weeks: '',
    additional_instructions: '', school_url: '', school_username: '',
    school_password: '', coupon_code: '',
  });
  const [files, setFiles] = useState([]);
  const [file2, setFile2] = useState(null);
  const [couponValid, setCouponValid] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [quizDetails, setQuizDetails] = useState([{ name: '', duration: '' }]);

  const [tierPricing, setTierPricing] = useState({});
  const [selectedPlan, setSelectedPlan] = useState('essential');
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    Promise.all([getOrderTypes(), getEducationLevels()])
      .then(([types, levels]) => {
        setOrderTypes(types.data);
        setEducationLevels(levels.data.filter(l => ALLOWED_LEVELS.includes(l.name)));
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const searchSubjects = useCallback(async (search) => {
    setSubjectSearch(search);
    const res = await getSubjects(search);
    setSubjects(res.data);
    setShowSubjectDropdown(true);
  }, []);

  const update = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'order_type_id') {
      setSelectedPlan('essential');
      setTierPricing({});
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const total = files.length + newFiles.length;
    if (total > 10) { setError('Maximum 10 files allowed'); return; }
    const oversized = newFiles.find(f => f.size > 30 * 1024 * 1024);
    if (oversized) { setError('Each file must be under 30MB'); return; }
    setFiles(prev => [...prev, ...newFiles]);
    setError('');
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatDate = (date) => {
    if (!date) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr + 'T00:00:00');
  };

  const getEffectiveWeeks = () => {
    const typeName = orderTypes.find(t => t.id === Number(formData.order_type_id))?.name || '';
    const isOnlineClass = typeName.toLowerCase().includes('online class');

    if (isOnlineClass) {
      if (formData.class_type === 'partial_class') {
        return parseInt(formData.partial_weeks) || 0;
      }
      if (!formData.class_start_date || !formData.due_date) return 0;
      const start = new Date(formData.class_start_date);
      const end = new Date(formData.due_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const diffMs = end - start;
      if (diffMs <= 0) return 1;
      return Math.max(Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)), 1);
    }

    if (!formData.due_date) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(formData.due_date);
    const diffMs = due - today;
    if (diffMs <= 0) return 1;
    return Math.max(Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)), 1);
  };

  const fetchPrice = useCallback(async () => {
    if (!formData.order_type_id) return;
    const numWeeks = getEffectiveWeeks();
    const numPages = formData.num_pages ? parseInt(formData.num_pages) : 0;

    if (numWeeks <= 0 && numPages <= 0) {
      setTierPricing({});
      return;
    }

    setPricingLoading(true);
    const tiers = getTiersForType(orderTypes.find(t => t.id === Number(formData.order_type_id))?.name);
    const params = {
      order_type_id: parseInt(formData.order_type_id),
      education_level_id: formData.education_level_id ? parseInt(formData.education_level_id) : null,
      num_weeks: numWeeks,
      num_pages: numPages,
      is_urgent: isUrgent,
      coupon_code: couponValid ? formData.coupon_code : undefined,
    };

    const results = await Promise.allSettled(
      tiers.map(tier => calculatePrice({ ...params, plan_tier: tier }))
    );

    const newPricing = {};
    tiers.forEach((tier, i) => {
      if (results[i].status === 'fulfilled') newPricing[tier] = results[i].value.data;
    });
    setTierPricing(newPricing);

    if (!newPricing[selectedPlan] && Object.keys(newPricing).length > 0) {
      setSelectedPlan(Object.keys(newPricing)[0]);
    }

    setPricingLoading(false);
  }, [formData.order_type_id, formData.education_level_id, formData.due_date, formData.num_pages, formData.class_type, formData.class_start_date, formData.partial_weeks, isUrgent, couponValid, formData.coupon_code, orderTypes, selectedPlan]);

  useEffect(() => {
    if (currentStep === 1) fetchPrice();
  }, [currentStep, fetchPrice]);

  const applyCoupon = async () => {
    if (!formData.coupon_code) return;
    try {
      const res = await validateCoupon(formData.coupon_code);
      setCouponValid(true);
      setCouponDiscount(res.data.discount_percent);
    } catch {
      setCouponValid(false);
      setCouponDiscount(0);
    }
  };

  const selectedType = orderTypes.find(t => t.id === Number(formData.order_type_id));
  const qtyConfig = getQuantityConfig(selectedType?.name);
  const availableTiers = getTiersForType(selectedType?.name);
  const isOnlineClass = selectedType?.name?.toLowerCase().includes('online class');
  const isQuizExamTestType = (() => { const n = selectedType?.name?.toLowerCase() || ''; return n.includes('quiz') || n.includes('exam') || n.includes('test'); })();

  const pricing = tierPricing[selectedPlan] || null;
  const basePrice = pricing?.base_price || 0;
  const urgentFee = pricing?.urgent_fee || 0;
  const discount = pricing?.discount_amount || 0;
  const totalPrice = pricing?.total_price || 0;
  const rangeType = pricing?.range_type || 'weeks';
  const hasTierPricing = Object.keys(tierPricing).length > 0;

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.order_type_id && formData.course_name && formData.subject_id && formData.education_level_id;
      case 1: {
        if (!pricing || totalPrice <= 0 || !formData.due_date) return false;
        if (isQuizExamTestType && !formData.quiz_mode) return false;
        if (isOnlineClass && (!formData.class_type || !formData.class_start_date)) return false;
        if (isOnlineClass && formData.class_type === 'partial_class' && !formData.partial_weeks) return false;
        return true;
      }
      case 2: return pricing && totalPrice > 0;
      default: return false;
    }
  };

  const handleNext = async () => {
    try {
      setSubmitting(true);
      setError('');
      const quizData = isQuizExamTestType ? { quiz_details: quizDetails.filter(q => q.name || q.duration) } : {};
      const payload = {
        ...formData,
        ...quizData,
        start_date: isOnlineClass ? formData.class_start_date : formatDate(new Date()),
        end_date: formData.due_date,
        num_weeks: getEffectiveWeeks(),
        source_url: window.location.origin + (import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')),
        ...(currentStep === 1 && pricing ? {
          num_pages: formData.num_pages ? parseInt(formData.num_pages) : null,
          price: basePrice,
          total_price: totalPrice,
          urgent_fee: urgentFee,
          discount_amount: discount,
          pricing_rule_id: pricing.pricing_rule_id,
        } : {}),
      };
      if (!draftOrderId) {
        const res = await createDraftOrder(payload);
        setDraftOrderId(res.data.order_id);
      } else {
        await updateDraftOrder(draftOrderId, payload);
      }
      setCurrentStep(prev => prev + 1);
      setSubmitting(false);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save progress');
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      let tempFileIds = [];
      const allFiles = [...files];
      if (file2) allFiles.push(file2);
      if (allFiles.length > 0) {
        const uploadFormData = new FormData();
        allFiles.forEach(f => uploadFormData.append('files', f));
        const uploadRes = await uploadFiles(uploadFormData);
        if (uploadRes.data && uploadRes.data.files) {
          tempFileIds = uploadRes.data.files.map(f => f.id);
        }
      }
      const finalQuizData = isQuizExamTestType ? { quiz_details: quizDetails.filter(q => q.name || q.duration) } : {};
      await updateDraftOrder(draftOrderId, {
        ...formData,
        ...finalQuizData,
        start_date: isOnlineClass ? formData.class_start_date : formatDate(new Date()),
        end_date: formData.due_date,
        num_weeks: getEffectiveWeeks(),
        num_pages: formData.num_pages ? parseInt(formData.num_pages) : null,
        urgent_fee: urgentFee,
        source_url: window.location.origin + (import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')),
        price: basePrice,
        total_price: totalPrice,
        discount_amount: discount,
        pricing_rule_id: pricing?.pricing_rule_id || null,
        temp_file_ids: tempFileIds,
      });
      const res = await createPaymentIntent({ order_id: draftOrderId, payment_type: paymentType });
      setCheckout({
        clientSecret: res.data.client_secret,
        amount: res.data.amount,
        isPartial: res.data.is_partial,
        fullTotal: res.data.full_total,
      });
      setSubmitting(false);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to process order');
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = (data) => {
    navigate('/payment/success?order_id=' + (data?.order_id || draftOrderId));
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
          onSuccess={handlePaymentSuccess}
          onCancel={() => setCheckout(null)}
        />
      </Card>
    );
  }

  return (
    <div style={{ paddingBottom: 64 }}>
      {/* Page header */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 0.3 }}>
          Create New Order
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>
          Tell us about your project — pricing and tutor matching follow.
        </p>
      </div>

      {/* ── Step indicator ─────────────────────────────────── */}
      <StepIndicator current={currentStep} steps={STEPS} />

      {error && <Notice type="error" style={{ marginBottom: 16 }}>{error}</Notice>}

      {/* ── Step 1: Service Details ────────────────────────── */}
      {currentStep === 0 && (
        <Card>
          <SectionTitle>Service Details</SectionTitle>
          <div className="v2-form-grid">
            <Field label="Type of Service" required>
              <select
                className="form-select" value={formData.order_type_id}
                onChange={e => update('order_type_id', e.target.value)}
              >
                <option value="">Select type…</option>
                {orderTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Course Name" required>
              <input
                className="form-input" placeholder="e.g. Intro to Psychology"
                value={formData.course_name} onChange={e => update('course_name', e.target.value)}
              />
            </Field>
          </div>
          <div className="v2-form-grid">
            <Field label="Subject" required style={{ position: 'relative' }}>
              <input
                className="form-input" placeholder="Search subject…"
                value={subjectSearch || formData.subject_name}
                onChange={e => {
                  searchSubjects(e.target.value);
                  update('subject_name', ''); update('subject_id', '');
                }}
                onFocus={() => {
                  if (subjects.length > 0) setShowSubjectDropdown(true);
                  else searchSubjects('');
                }}
              />
              {showSubjectDropdown && subjects.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, maxHeight: 220, overflowY: 'auto', zIndex: 50,
                  boxShadow: C.shadow,
                }}>
                  {subjects.map(s => (
                    <div
                      key={s.id}
                      onClick={() => {
                        update('subject_id', s.id);
                        update('subject_name', s.name);
                        setSubjectSearch('');
                        setShowSubjectDropdown(false);
                      }}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                        borderBottom: `1px solid ${C.border}`, color: C.textPrimary,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Education Level" required>
              <select
                className="form-select" value={formData.education_level_id}
                onChange={e => update('education_level_id', e.target.value)}
              >
                <option value="">Select level…</option>
                {educationLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Upload Files" hint="Max 10 files · 30MB each · PDF, DOC, DOCX, images, etc.">
            <FileUploadZone
              files={files}
              onChange={handleFileChange}
              onRemove={removeFile}
            />
          </Field>
        </Card>
      )}

      {/* ── Step 2: Schedule & Plan ────────────────────────── */}
      {currentStep === 1 && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle>Schedule &amp; Pricing</SectionTitle>
            {isOnlineClass ? (
              <>
                <Field label="Class Type" required>
                  <div className="v2-form-grid">
                    {[{ value: 'full_class', label: 'Full Class' }, { value: 'partial_class', label: 'Partial Class' }].map(opt => (
                      <RadioCard
                        key={opt.value}
                        selected={formData.class_type === opt.value}
                        onClick={() => {
                          update('class_type', opt.value);
                          if (!formData.class_start_date) update('class_start_date', formatDate(new Date()));
                        }}
                      >
                        {opt.label}
                      </RadioCard>
                    ))}
                  </div>
                </Field>
                <div className="v2-form-grid">
                  <Field label="Start Date" required>
                    <DatePicker
                      selected={parseDate(formData.class_start_date)}
                      onChange={date => update('class_start_date', formatDate(date))}
                      className="form-input"
                      dateFormat="MM/dd/yy"
                      placeholderText="MM/DD/YY"
                    />
                  </Field>
                  <Field label="Last Day of Class" required>
                    <DatePicker
                      selected={parseDate(formData.due_date)}
                      onChange={date => update('due_date', formatDate(date))}
                      className="form-input"
                      dateFormat="MM/dd/yy"
                      placeholderText="MM/DD/YY"
                      minDate={parseDate(formData.class_start_date) || new Date()}
                    />
                  </Field>
                </div>
                {formData.class_type === 'partial_class' && (
                  <Field label="Number of working weeks" required>
                    <input
                      className="form-input" type="number" min="1"
                      placeholder="Enter number of weeks"
                      value={formData.partial_weeks}
                      onChange={e => update('partial_weeks', e.target.value)}
                      style={{ maxWidth: 300 }}
                    />
                  </Field>
                )}
                {formData.class_type === 'full_class' && formData.class_start_date && formData.due_date && (
                  <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>
                    Duration: ~{getEffectiveWeeks()} week(s)
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="v2-form-grid">
                  <Field label="Due Date" required>
                    <DatePicker
                      selected={parseDate(formData.due_date)}
                      onChange={date => update('due_date', formatDate(date))}
                      className="form-input"
                      dateFormat="MM/dd/yy"
                      placeholderText="MM/DD/YY"
                      minDate={new Date()}
                    />
                  </Field>
                  {qtyConfig.label && (
                    <Field label={qtyConfig.label} required>
                      <input
                        className="form-input" type="number" min="1"
                        placeholder={qtyConfig.placeholder}
                        value={formData.num_pages}
                        onChange={e => update('num_pages', e.target.value)}
                      />
                    </Field>
                  )}
                </div>
                {isQuizExamTestType && (
                  <Field label="Mode" required>
                    <select
                      className="form-select" value={formData.quiz_mode}
                      onChange={e => update('quiz_mode', e.target.value)}
                    >
                      <option value="">-Select-</option>
                      <option value="Online">Online</option>
                      <option value="Proctored">Proctored</option>
                    </select>
                  </Field>
                )}
              </>
            )}
          </Card>

          {/* Plan cards */}
          {pricingLoading ? (
            <Card style={{ marginBottom: 16, textAlign: 'center', padding: 30 }}>
              <div className="loading-spinner" style={{ width: 28, height: 28, margin: '0 auto' }} />
            </Card>
          ) : hasTierPricing ? (
            availableTiers.length > 1 ? (
              <div
                className="v2-plans-grid"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${availableTiers.length}, 1fr)`, gap: 14, marginBottom: 16 }}
              >
                {availableTiers.map(tier => {
                  const tp = tierPricing[tier];
                  if (!tp) return null;
                  const isSelected = selectedPlan === tier;
                  const tierLabels = isOnlineClass ? {
                    essential: { name: 'Essential Plan', desc: 'Perfect for getting started', features: ['Our Experts will work on the Class Items', '24X7 Support - Live Chat and Email', 'Highly rated writer', 'Plagiarism and AI Free Content', '1 Free Revision'] },
                    priority:  { name: 'Priority Plan',  desc: 'Most Popular Choice', recommended: true, features: ['Our Experts will work on the Class Items', '24X7 Support - Live Chat, Email, Text and WhatsApp', 'Experienced Writer with 4.5* or above rating', 'Plagiarism and AI Free Content with Turnitin Reports', 'Unlimited Revisions', 'Unlimited Attempts on Quizzes/Test To Get Highest Grades', 'Direct Communication with Writer', 'Grade Guarantee of A and B'] },
                    vip:       { name: 'VIP Plan',       desc: 'Premium Service with All Inclusions', features: ['Our Experts will work on the Class Items', '24X7 Support - Live Chat, Email, Text and WhatsApp', 'Experienced Writer with 4.5* or above rating', 'Plagiarism and AI Free Content with Turnitin Reports', 'Unlimited Revisions', 'Unlimited Attempts on Quizzes/Test To Get Highest Grades', 'Direct Communication with Writer', 'Dedicated Project manager', 'Multiple experts assigned to review the work', 'Grade Guarantee of A and B'] },
                  } : {
                    essential: { name: 'Essential Plan', desc: 'Perfect for getting started', features: ['Highly Rated Writer', 'Plag and AI free Content', '24X7 Support', 'Limited Revisions'] },
                    premium:   { name: 'Premium Plan',   desc: 'Most Popular Choice', recommended: true, features: ['Highly Rated Writer', 'Plag and AI free Content', '24X7 Support', 'Unlimited Revisions', 'Proofread by an Expert Writer'] },
                  };
                  const label = tierLabels[tier] || { name: tier, desc: '', features: [] };
                  return (
                    <PlanCard
                      key={tier}
                      selected={isSelected}
                      recommended={label.recommended}
                      name={label.name}
                      desc={label.desc}
                      price={tp.base_price}
                      features={label.features}
                      onClick={() => setSelectedPlan(tier)}
                    />
                  );
                })}
              </div>
            ) : null
          ) : (formData.due_date || formData.num_pages) ? (
            <Card style={{ marginBottom: 16, textAlign: 'center', color: C.textMuted, padding: 16 }}>
              <p style={{ margin: 0, fontSize: 13 }}>No pricing available for this combination. Try adjusting the values.</p>
            </Card>
          ) : null}

          {(selectedType?.name === 'Assignment' || selectedType?.name === 'Project') && (
            <Card style={{ marginBottom: 16 }}>
              <Field label="Type" required>
                <select
                  className="form-select" value={formData.work_type}
                  onChange={e => update('work_type', e.target.value)}
                >
                  <option value="">-Select-</option>
                  <option value="Written">Written</option>
                  <option value="Technical">Technical</option>
                  <option value="Both">Both</option>
                </select>
              </Field>
            </Card>
          )}

          {/* Price breakdown */}
          {pricing && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: C.textSecondary, fontWeight: 600 }}>
                  {rangeType === 'flat' && pricing.flat_quantity > 1
                    ? `${pricing.flat_quantity} × $${pricing.unit_price.toFixed(2)}`
                    : `${capitalize(selectedPlan)} Plan`}
                  {rangeType === 'pages' && formData.num_pages ? ` (${formData.num_pages} pages)` : ''}
                  {rangeType === 'weeks' ? ` (${getEffectiveWeeks()} weeks)` : ''}
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>
                  ${basePrice.toFixed(2)}
                </span>
              </div>
              {urgentFee > 0 && (
                <SummaryLine label="Urgent Fee" value={`+$${urgentFee.toFixed(2)}`} valueColor={C.orangeText} />
              )}
              {discount > 0 && (
                <SummaryLine label={`Discount (${couponDiscount}%)`} value={`−$${discount.toFixed(2)}`} valueColor={C.green} />
              )}
              <div style={{
                borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Total
                </span>
                <span style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>
                  ${totalPrice.toFixed(2)}
                </span>
              </div>
            </Card>
          )}

          {/* Options */}
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle>Options</SectionTitle>
            <div className="v2-form-grid">
              <Field label="Are any items due before midnight today?">
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8,
                  background: isUrgent ? C.orangeSoft : '#f6f7fb',
                  border: `1px solid ${isUrgent ? C.orange : C.border}`,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textPrimary,
                }}>
                  <input
                    type="checkbox" checked={isUrgent}
                    onChange={e => setIsUrgent(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: C.orange }}
                  />
                  Yes, add urgent fee
                </label>
              </Field>
              <Field label="Coupon Code">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input" placeholder="SAVE20"
                    value={formData.coupon_code}
                    onChange={e => { update('coupon_code', e.target.value); setCouponValid(null); }}
                  />
                  <button
                    type="button" onClick={applyCoupon}
                    style={{
                      padding: '0 14px', border: `1px solid ${C.border}`,
                      background: C.surface, borderRadius: 8, cursor: 'pointer',
                      color: C.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 700,
                    }}
                  >
                    <FiTag size={14} /> APPLY
                  </button>
                </div>
                {couponValid === true && (
                  <p style={{ color: C.green, fontSize: 12, marginTop: 6, fontWeight: 600 }}>✓ {couponDiscount}% discount applied!</p>
                )}
                {couponValid === false && (
                  <p style={{ color: C.red, fontSize: 12, marginTop: 6, fontWeight: 600 }}>✗ Invalid coupon code</p>
                )}
              </Field>
            </div>
          </Card>
        </>
      )}

      {/* ── Step 3: Review & Checkout ──────────────────────── */}
      {currentStep === 2 && (
        <>
          {isQuizExamTestType && (
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle>
                {selectedType?.name?.replace('Online ', '') || 'Quiz'} Details
              </SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {quizDetails.map((q, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 1fr 36px', gap: 10, alignItems: 'center',
                  }}>
                    <input
                      className="form-input" placeholder="e.g. Chapter 1 Quiz"
                      value={q.name}
                      onChange={e => {
                        const arr = [...quizDetails];
                        arr[i] = { ...arr[i], name: e.target.value };
                        setQuizDetails(arr);
                      }}
                    />
                    <input
                      className="form-input" placeholder="e.g. 30 mins"
                      value={q.duration}
                      onChange={e => {
                        const arr = [...quizDetails];
                        arr[i] = { ...arr[i], duration: e.target.value };
                        setQuizDetails(arr);
                      }}
                    />
                    {quizDetails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setQuizDetails(prev => prev.filter((_, idx) => idx !== i))}
                        style={{
                          background: C.redSoft, border: 'none', color: C.red,
                          width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Remove"
                      >
                        <FiX size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {quizDetails.length < 8 && (
                <button
                  type="button"
                  onClick={() => setQuizDetails(prev => [...prev, { name: '', duration: '' }])}
                  style={{
                    marginTop: 12, padding: '8px 14px', borderRadius: 8,
                    background: C.accentSoft, color: C.accent, border: 'none',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <FiPlus size={14} /> ADD {(selectedType?.name?.replace('Online ', '') || 'Quiz').toUpperCase()}
                </button>
              )}
            </Card>
          )}

          <div className="v2-detail-grid">
            <Card>
              <SectionTitle>Additional Info &amp; Instructions</SectionTitle>
              <Field>
                <textarea
                  className="form-textarea"
                  placeholder="Any specific details about the class, instructions, or login details that you want to share with us."
                  value={formData.additional_instructions}
                  onChange={e => update('additional_instructions', e.target.value)}
                  rows={5}
                />
              </Field>
              <Field label="School Login URL">
                <input
                  className="form-input" placeholder="https://school.example.com"
                  value={formData.school_url}
                  onChange={e => update('school_url', e.target.value)}
                />
              </Field>
              <Field label="School Username">
                <input
                  className="form-input" placeholder="Your school username"
                  value={formData.school_username}
                  onChange={e => update('school_username', e.target.value)}
                />
              </Field>
              <Field label="School Password">
                <input
                  type="password" className="form-input" placeholder="Your school password"
                  value={formData.school_password}
                  onChange={e => update('school_password', e.target.value)}
                />
              </Field>
            </Card>

            {/* Summary sidebar */}
            <Card>
              <SectionTitle>Order Summary</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Row label="Service"  value={selectedType?.name || '—'} mono={false} />
                <Row label="Course"   value={formData.course_name || '—'} mono={false} />
                <Row label="Subject"  value={formData.subject_name || '—'} mono={false} />
                <Row label="Level"    value={educationLevels.find(l => l.id === Number(formData.education_level_id))?.name || '—'} mono={false} />
                <Row label="Plan"     value={<span style={{ color: C.accent, fontWeight: 700 }}>{capitalize(selectedPlan)}</span>} mono={false} />
                {formData.work_type && <Row label="Type" value={formData.work_type} mono={false} />}
                {formData.quiz_mode && <Row label="Mode" value={formData.quiz_mode} mono={false} />}
                {isOnlineClass && formData.class_type && (
                  <Row label="Class" value={formData.class_type === 'full_class' ? 'Full Class' : 'Partial Class'} mono={false} />
                )}
                {isOnlineClass && formData.class_start_date && (
                  <Row label="Start" value={new Date(formData.class_start_date + 'T00:00:00').toLocaleDateString()} mono={false} />
                )}
                {formData.due_date && (
                  <Row
                    label={isOnlineClass ? 'Last Day' : 'Due Date'}
                    value={new Date(formData.due_date + 'T00:00:00').toLocaleDateString()}
                    mono={false}
                  />
                )}
                {formData.num_pages && qtyConfig.label && (
                  <Row label={qtyConfig.label} value={formData.num_pages} mono={false} />
                )}
                {isOnlineClass && (
                  <Row label="Weeks" value={getEffectiveWeeks()} mono={false} />
                )}
                <Row label="Files" value={`${files.length} file(s)`} mono={false} />
                {pricing && (
                  <>
                    <Row label="Base" value={`$${basePrice.toFixed(2)}`} mono={false} />
                    {urgentFee > 0 && (
                      <Row label="Urgent" value={<span style={{ color: C.orangeText }}>+${urgentFee.toFixed(2)}</span>} mono={false} />
                    )}
                    {discount > 0 && (
                      <Row label={`Discount`} value={<span style={{ color: C.green }}>−${discount.toFixed(2)}</span>} mono={false} />
                    )}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0 0', borderTop: `1px solid ${C.border}`, marginTop: 6,
                    }}>
                      <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                        Total
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>
                        ${totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Online-class partial payment option */}
              {(() => {
                if (!isOnlineClass) return null;
                if (totalPrice <= PARTIAL_AMOUNT) return null;
                const eligibleByPrice = totalPrice >= 455;
                let eligibleByDays = false;
                if (formData.class_start_date && formData.due_date) {
                  const start = new Date(formData.class_start_date);
                  const end = new Date(formData.due_date);
                  const days = (end - start) / (1000 * 60 * 60 * 24);
                  eligibleByDays = days >= 45;
                }
                if (!eligibleByPrice && !eligibleByDays) return null;
                return (
                  <div style={{
                    marginTop: 18, padding: 14,
                    background: C.accentSoft2 || '#eff6ff',
                    border: `1px solid ${C.accentSoft}`, borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 10, color: C.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Payment Option
                    </div>
                    <PaymentOptionRadio
                      checked={paymentType === 'full'}
                      onChange={() => setPaymentType('full')}
                      title="Pay Full Now"
                      sub={`$${totalPrice.toFixed(2)}`}
                    />
                    <PaymentOptionRadio
                      checked={paymentType === 'partial'}
                      onChange={() => setPaymentType('partial')}
                      title="Pay Partial"
                      sub={`$${PARTIAL_AMOUNT} now · $${(totalPrice - PARTIAL_AMOUNT).toFixed(2)} later`}
                    />
                  </div>
                );
              })()}
            </Card>
          </div>
        </>
      )}

      {/* ── Navigation ────────────────────────────────────── */}
      <div className="v2-step-actions">
        <button
          type="button" onClick={() => setCurrentStep(prev => prev - 1)}
          disabled={currentStep === 0}
          style={{
            padding: '11px 18px', borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: currentStep === 0 ? '#eef2f7' : C.surface,
            color: currentStep === 0 ? C.textMuted : C.textPrimary,
            cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            textTransform: 'uppercase',
          }}
        >
          <FiArrowLeft size={14} /> Back
        </button>

        {currentStep < 2 ? (
          <button
            type="button" onClick={handleNext}
            disabled={!canProceed() || submitting}
            style={{
              padding: '11px 20px', borderRadius: 10, border: 'none',
              background: C.accent, color: '#fff',
              cursor: (!canProceed() || submitting) ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              opacity: (!canProceed() || submitting) ? 0.6 : 1,
              textTransform: 'uppercase',
            }}
          >
            {submitting
              ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              : <>Next <FiArrowRight size={14} /></>}
          </button>
        ) : (
          <button
            type="button" onClick={handleSubmit}
            disabled={!canProceed() || submitting}
            style={{
              padding: '13px 22px', borderRadius: 10, border: 'none',
              background: C.accent, color: '#fff',
              cursor: (!canProceed() || submitting) ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 800, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              opacity: (!canProceed() || submitting) ? 0.6 : 1,
              textTransform: 'uppercase',
            }}
          >
            {submitting
              ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : <>
                  <FiCheck size={16} /> Proceed to Checkout
                  {totalPrice > 0 ? ` $${(paymentType === 'partial' ? PARTIAL_AMOUNT : totalPrice).toFixed(2)}` : ''}
                </>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────

function StepIndicator({ current, steps }) {
  return (
    <div className="v2-step-indicator">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="v2-step" data-state={done ? 'done' : active ? 'active' : 'pending'}>
            <div className="v2-step-circle">
              {done ? <FiCheck size={14} /> : i + 1}
            </div>
            <div className="v2-step-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 style={{
      fontSize: 13, fontWeight: 800, color: C.textPrimary, margin: '0 0 14px',
      letterSpacing: 0.5, textTransform: 'uppercase',
    }}>
      {children}
    </h3>
  );
}

function Field({ label, hint, required, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted,
          letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
        }}>
          {label} {required && <span style={{ color: C.red }}>*</span>}
        </label>
      )}
      {children}
      {hint && (
        <p style={{ color: C.textMuted, fontSize: 11, margin: '6px 0 0' }}>{hint}</p>
      )}
    </div>
  );
}

function RadioCard({ selected, onClick, children }) {
  return (
    <label
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
        border: `2px solid ${selected ? C.accent : C.border}`,
        background: selected ? C.accentSoft2 || '#eff6ff' : 'transparent',
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        border: `${selected ? 5 : 2}px solid ${selected ? C.accent : C.border}`,
      }} />
      <span style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary }}>{children}</span>
    </label>
  );
}

function PlanCard({ selected, recommended, name, desc, price, features, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${selected ? C.accent : C.border}`,
        borderRadius: 14, padding: 22, cursor: 'pointer', position: 'relative',
        background: selected ? C.accentSoft2 || '#eff6ff' : C.surface,
        transition: 'all 0.18s ease',
      }}
    >
      {recommended && (
        <Pill
          bg={C.accent} color="#fff"
          style={{
            position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, padding: '4px 12px',
          }}
        >
          Recommended
        </Pill>
      )}
      {selected && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 22, height: 22, borderRadius: '50%', background: C.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FiCheck size={14} color="#fff" />
        </div>
      )}
      <h4 style={{ marginBottom: 6, fontSize: 17, fontWeight: 800, color: C.textPrimary }}>
        {name}
      </h4>
      <p style={{ fontSize: 28, fontWeight: 800, color: C.accent, margin: '0 0 4px' }}>
        ${price?.toFixed(2) || '—'}
      </p>
      <p style={{ color: C.textMuted, fontSize: 12, margin: '0 0 14px' }}>{desc}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {features.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: C.textSecondary, lineHeight: 1.4 }}>
            <FiCheck size={13} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FileUploadZone({ files, onChange, onRemove }) {
  return (
    <>
      <div
        onClick={() => document.getElementById('file-input').click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = C.accentSoft2 || '#eff6ff'; }}
        onDragLeave={e => { e.currentTarget.style.background = C.surfaceHover; }}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.style.background = C.surfaceHover;
          onChange({ target: { files: e.dataTransfer.files } });
        }}
        style={{
          padding: 28, border: `2px dashed ${C.border}`, borderRadius: 10,
          textAlign: 'center', cursor: 'pointer', background: C.surfaceHover,
          transition: 'background 0.18s',
        }}
      >
        <FiUpload size={24} style={{ color: C.accent, marginBottom: 8 }} />
        <p style={{ color: C.textSecondary, fontSize: 13, margin: 0, fontWeight: 600 }}>
          Drag &amp; drop files here, or click to browse
        </p>
      </div>
      <input id="file-input" type="file" multiple style={{ display: 'none' }} onChange={onChange} />
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: C.surfaceHover, border: `1px solid ${C.border}`,
              borderRadius: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.textPrimary,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {(f.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <button
                type="button" onClick={() => onRemove(i)}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none',
                  background: C.redSoft, color: C.red, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="Remove file"
              >
                <FiX size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SummaryLine({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: C.textSecondary }}>{label}</span>
      <span style={{ color: valueColor || C.textPrimary, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function PaymentOptionRadio({ checked, onChange, title, sub }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', marginBottom: 6, borderRadius: 8,
      background: checked ? C.accentSoft : 'transparent',
      border: `1px solid ${checked ? C.accent : 'transparent'}`,
      cursor: 'pointer',
    }}>
      <input
        type="radio" checked={checked} onChange={onChange}
        style={{ width: 16, height: 16, accentColor: C.accent }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{title}</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{sub}</div>
      </div>
    </label>
  );
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
