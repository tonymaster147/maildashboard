import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrderTypes, getSubjects, getEducationLevels, validateCoupon, calculatePrice, createPaymentSession, uploadFiles, createDraftOrder, updateDraftOrder } from '../services/api';
import { FiUpload, FiX, FiCheck, FiArrowRight, FiArrowLeft, FiTag } from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const STEPS = ['Service Details', 'Schedule & Plan', 'Review & Checkout'];

// Only show these 3 education levels in the order form
const ALLOWED_LEVELS = ['High School', 'Undergraduate', 'Graduate'];

// Determine what the quantity field means per service type
const getQuantityConfig = (typeName) => {
  if (!typeName) return { label: 'Pages', placeholder: 'Number of pages', needsDueDate: true };
  const n = typeName.toLowerCase();
  if (n.includes('online class')) return { label: null, placeholder: null, needsDueDate: true, weeksOnly: true };
  if (n.includes('quiz')) return { label: 'Number of Quizzes', placeholder: 'How many quizzes?', needsDueDate: true };
  if (n.includes('exam')) return { label: 'Number of Exams', placeholder: 'How many exams?', needsDueDate: true };
  if (n.includes('test')) return { label: 'Number of Tests', placeholder: 'How many tests?', needsDueDate: true };
  if (n.includes('discussion')) return { label: 'Number of Discussions', placeholder: 'How many discussions?', needsDueDate: true };
  // Assignment, Essay/Paper, Project → pages
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
    additional_instructions: '', school_url: '', school_username: '',
    school_password: '', coupon_code: ''
  });
  const [files, setFiles] = useState([]);
  const [file2, setFile2] = useState(null);
  const [couponValid, setCouponValid] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  // Dynamic pricing state — fetch all available tiers so user can pick
  const [tierPricing, setTierPricing] = useState({});  // { essential: {...}, premium: {...}, ... }
  const [selectedPlan, setSelectedPlan] = useState('essential');
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    Promise.all([getOrderTypes(), getEducationLevels()])
      .then(([types, levels]) => {
        setOrderTypes(types.data);
        // Only keep 3 allowed levels
        setEducationLevels(levels.data.filter(l => ALLOWED_LEVELS.includes(l.name)));
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const searchSubjects = useCallback(async (search) => {
    setSubjectSearch(search);
    if (search.length >= 1) {
      const res = await getSubjects(search);
      setSubjects(res.data);
      setShowSubjectDropdown(true);
    } else {
      setShowSubjectDropdown(false);
    }
  }, []);

  const update = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Reset plan selection when service type changes
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

  // Calculate weeks from today to due date
  const calcWeeksFromDueDate = () => {
    if (!formData.due_date) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(formData.due_date);
    const diffMs = due - today;
    if (diffMs <= 0) return 1; // minimum 1 week for same-day or past dates
    return Math.max(Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)), 1);
  };

  const fetchPrice = useCallback(async () => {
    if (!formData.order_type_id) return;

    const numWeeks = calcWeeksFromDueDate();
    const numPages = formData.num_pages ? parseInt(formData.num_pages) : 0;

    // Need at least a due date or pages
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
      coupon_code: couponValid ? formData.coupon_code : undefined
    };

    const results = await Promise.allSettled(
      tiers.map(tier => calculatePrice({ ...params, plan_tier: tier }))
    );

    const newPricing = {};
    tiers.forEach((tier, i) => {
      if (results[i].status === 'fulfilled') {
        newPricing[tier] = results[i].value.data;
      }
    });
    setTierPricing(newPricing);

    // Auto-select first available tier if current selection isn't available
    if (!newPricing[selectedPlan] && Object.keys(newPricing).length > 0) {
      setSelectedPlan(Object.keys(newPricing)[0]);
    }

    setPricingLoading(false);
  }, [formData.order_type_id, formData.education_level_id, formData.due_date, formData.num_pages, isUrgent, couponValid, formData.coupon_code, orderTypes, selectedPlan]);

  // Re-calculate price when on step 2 and inputs change
  useEffect(() => {
    if (currentStep === 1) {
      fetchPrice();
    }
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

  // Computed values available to all steps
  const selectedType = orderTypes.find(t => t.id === Number(formData.order_type_id));
  const qtyConfig = getQuantityConfig(selectedType?.name);
  const availableTiers = getTiersForType(selectedType?.name);

  // Computed values from selected plan's pricing
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
      case 1: return pricing && totalPrice > 0 && formData.due_date;
      case 2: return pricing && totalPrice > 0;
      default: return false;
    }
  };

  const handleNext = async () => {
    try {
      setSubmitting(true);
      setError('');

      const payload = {
        ...formData,
        start_date: formatDate(new Date()),
        end_date: formData.due_date,
        num_weeks: calcWeeksFromDueDate(),
        source_url: window.location.origin,
        // Include pricing data when leaving the schedule step
        ...(currentStep === 1 && pricing ? {
          num_pages: formData.num_pages ? parseInt(formData.num_pages) : null,
          price: basePrice,
          total_price: totalPrice,
          urgent_fee: urgentFee,
          discount_amount: discount,
          pricing_rule_id: pricing.pricing_rule_id
        } : {})
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

      // 1. Upload files first if any were selected
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

      // Update draft with final pricing data
      await updateDraftOrder(draftOrderId, {
        ...formData,
        start_date: formatDate(new Date()),
        end_date: formData.due_date,
        num_weeks: calcWeeksFromDueDate(),
        num_pages: formData.num_pages ? parseInt(formData.num_pages) : null,
        urgent_fee: urgentFee,
        source_url: window.location.origin,
        price: basePrice,
        total_price: totalPrice,
        discount_amount: discount,
        pricing_rule_id: pricing?.pricing_rule_id || null,
        temp_file_ids: tempFileIds
      });

      // 2. Proceed to Stripe Checkout
      const res = await createPaymentSession({
        order_id: draftOrderId
      });

      window.location.href = res.data.url;
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to process order');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>Create New Order</h2>
        <p>Fill in the details to get started with your project</p>
      </div>

      <div className="multistep-container">
        {/* Step Indicator */}
        <div className="step-indicator">
          {STEPS.map((label, i) => (
            <div key={i} className={`step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}>
              <div className="step-number">{i < currentStep ? '✓' : i + 1}</div>
              <div className="step-label">{label}</div>
            </div>
          ))}
        </div>

        {error && <div className="toast toast-error" style={{ position: 'relative', marginBottom: 20 }}>{error}</div>}

        {/* Step 1: Service Details */}
        {currentStep === 0 && (
          <div className="step-content card">
            <h3 style={{ marginBottom: 24 }}>Service Details</h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Type of Service *</label>
                <select className="form-select" value={formData.order_type_id} onChange={e => update('order_type_id', e.target.value)}>
                  <option value="">Select type...</option>
                  {orderTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Course Name *</label>
                <input className="form-input" placeholder="e.g. Intro to Psychology" value={formData.course_name} onChange={e => update('course_name', e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Subject *</label>
                <input className="form-input" placeholder="Search subject..." value={subjectSearch || formData.subject_name} onChange={e => { searchSubjects(e.target.value); update('subject_name', ''); update('subject_id', ''); }} onFocus={() => subjectSearch && setShowSubjectDropdown(true)} />
                {showSubjectDropdown && subjects.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', maxHeight: 200, overflowY: 'auto', zIndex: 50 }}>
                    {subjects.map(s => (
                      <div key={s.id} onClick={() => { update('subject_id', s.id); update('subject_name', s.name); setSubjectSearch(''); setShowSubjectDropdown(false); }} style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--border)' }} onMouseEnter={e => e.target.style.background = 'var(--bg-card-hover)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                        {s.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Education Level *</label>
                <select className="form-select" value={formData.education_level_id} onChange={e => update('education_level_id', e.target.value)}>
                  <option value="">Select level...</option>
                  {educationLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            {/* File Upload */}
            <div className="form-group">
              <label className="form-label">Upload Files (max 10, 30MB each)</label>
              <div className="file-upload-zone" onClick={() => document.getElementById('file-input').click()} onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }} onDragLeave={e => e.currentTarget.classList.remove('dragover')} onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); const dt = e.dataTransfer; handleFileChange({ target: { files: dt.files } }); }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <p style={{ color: 'var(--text-secondary)' }}>Drag & drop files here or click to browse</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>PDF, DOC, DOCX, Images, etc.</p>
              </div>
              <input id="file-input" type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
              {files.length > 0 && (
                <div className="file-list">
                  {files.map((f, i) => (
                    <div key={i} className="file-item">
                      <div><div className="file-name">{f.name}</div><div className="file-size">{(f.size / 1024 / 1024).toFixed(2)} MB</div></div>
                      <button onClick={() => removeFile(i)} className="btn btn-sm btn-danger" style={{ padding: '4px 8px' }}><FiX size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Schedule & Plan */}
        {currentStep === 1 && (
          <div className="step-content">
            {/* Due Date & Quantity */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 24 }}>Schedule & Pricing</h3>
              <div className="grid-2">
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="form-label">Due Date *</label>
                  <DatePicker
                    selected={parseDate(formData.due_date)}
                    onChange={date => update('due_date', formatDate(date))}
                    className="form-input"
                    dateFormat="MM/dd/yy"
                    placeholderText="MM/DD/YY"
                    minDate={new Date()}
                  />
                </div>
                {qtyConfig.label && (
                  <div className="form-group">
                    <label className="form-label">{qtyConfig.label} *</label>
                    <input className="form-input" type="number" min="1" placeholder={qtyConfig.placeholder} value={formData.num_pages} onChange={e => update('num_pages', e.target.value)} />
                  </div>
                )}
              </div>
              {qtyConfig.weeksOnly && formData.due_date && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Duration: ~{calcWeeksFromDueDate()} week(s) from today</p>
              )}

            </div>

            {/* Plan Selection Cards */}
            {pricingLoading ? (
              <div className="flex-center" style={{ padding: 30 }}><div className="loading-spinner" style={{ width: 28, height: 28 }}></div></div>
            ) : hasTierPricing ? (
              availableTiers.length > 1 ? (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${availableTiers.length}, 1fr)`, gap: 16, marginBottom: 20 }}>
                  {availableTiers.map(tier => {
                    const tp = tierPricing[tier];
                    if (!tp) return null;
                    const isSelected = selectedPlan === tier;
                    const tierLabels = {
                      essential: { name: 'Essential Plan', desc: 'Perfect for getting started', features: ['Highly Rated Writer', 'Plag and AI free Content', '24X7 Support', 'Limited Revisions'] },
                      premium: { name: 'Premium Plan', desc: 'Most Popular Choice', recommended: true, features: ['Highly Rated Writer', 'Plag and AI free Content', '24X7 Support', 'Unlimited Revisions', 'Proofread by an Expert Writer'] },
                      priority: { name: 'Priority Plan', desc: 'Faster turnaround time', recommended: true, features: ['Highly Rated Writer', 'Plag and AI free Content', '24X7 Support', 'Priority Matching', 'Faster Turnaround'] },
                      vip: { name: 'VIP Plan', desc: 'Best-in-class experience', features: ['Top Rated Writer', 'Plag and AI free Content', '24X7 Support', 'Priority Matching', 'Faster Turnaround', 'Dedicated Support Agent'] }
                    };
                    const label = tierLabels[tier] || { name: tier, desc: '', features: [] };
                    return (
                      <div
                        key={tier}
                        onClick={() => setSelectedPlan(tier)}
                        style={{
                          border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
                          borderRadius: 12, padding: 24, cursor: 'pointer', position: 'relative',
                          background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {label.recommended && (
                          <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Recommended
                          </div>
                        )}
                        {isSelected && (
                          <div style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiCheck size={14} color="#fff" />
                          </div>
                        )}
                        <h4 style={{ marginBottom: 8, fontSize: 18 }}>{label.name}</h4>
                        <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>
                          ${tp.base_price?.toFixed(2) || '—'}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{label.desc}</p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {label.features.map(f => (
                            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                              <FiCheck size={14} color="var(--success)" /> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : null /* single-tier types (exam/quiz/test) skip plan cards */
            ) : (formData.due_date || formData.num_pages) ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 8, marginBottom: 20 }}>
                <p>No pricing available for this combination. Try adjusting the values.</p>
              </div>
            ) : null}

            {/* Type - Assignment specific */}
            {selectedType?.name === 'Assignment' && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Type *</label>
                  <select className="form-select" value={formData.work_type} onChange={e => update('work_type', e.target.value)}>
                    <option value="">-Select-</option>
                    <option value="Written">Written</option>
                    <option value="Technical">Technical</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>
            )}

            {/* Price Breakdown */}
            {pricing && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {rangeType === 'flat' && pricing.flat_quantity > 1
                      ? `${pricing.flat_quantity} x $${pricing.unit_price.toFixed(2)}`
                      : `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan`}
                    {rangeType === 'pages' && formData.num_pages ? ` (${formData.num_pages} pages)` : ''}
                    {rangeType === 'weeks' ? ` (${calcWeeksFromDueDate()} weeks)` : ''}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>${basePrice.toFixed(2)}</span>
                </div>
                {urgentFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Urgent Fee</span>
                    <span style={{ color: 'var(--warning)', fontWeight: 600 }}>+${urgentFee.toFixed(2)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Discount ({couponDiscount}%)</span>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Options */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 16 }}>Options</h4>
              <div className="grid-2">
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Are any of the items due before midnight today?</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                    <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                    Yes, add urgent fee
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">Coupon Code</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" placeholder="SAVE20" value={formData.coupon_code} onChange={e => { update('coupon_code', e.target.value); setCouponValid(null); }} />
                    <button className="btn btn-secondary" onClick={applyCoupon}><FiTag size={16} /></button>
                  </div>
                  {couponValid === true && <p style={{ color: 'var(--success)', fontSize: 12, marginTop: 4 }}>✓ {couponDiscount}% discount applied!</p>}
                  {couponValid === false && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>✗ Invalid coupon code</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Checkout */}
        {currentStep === 2 && (
          <div className="step-content">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Left column: Additional Info & Instructions */}
              <div className="card">
                <h4 style={{ marginBottom: 16 }}>Additional Info & Instructions</h4>
                <div className="form-group">
                  <textarea className="form-textarea" placeholder="Any specific details about the Class, Instructions, or Login details that you want to convey us" value={formData.additional_instructions} onChange={e => update('additional_instructions', e.target.value)} rows={5} />
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">School Login URL</label>
                  <input className="form-input" placeholder="https://school.example.com" value={formData.school_url} onChange={e => update('school_url', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">School Username</label>
                  <input className="form-input" placeholder="Your school username" value={formData.school_username} onChange={e => update('school_username', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">School Password</label>
                  <input type="password" className="form-input" placeholder="Your school password" value={formData.school_password} onChange={e => update('school_password', e.target.value)} />
                </div>
              </div>

              {/* Right column: Order Summary */}
              <div className="order-summary">
                <h3 style={{ marginBottom: 20 }}>Order Summary</h3>
                <div className="summary-row"><span className="label">Service</span><span>{selectedType?.name}</span></div>
                <div className="summary-row"><span className="label">Course</span><span>{formData.course_name}</span></div>
                <div className="summary-row"><span className="label">Subject</span><span>{formData.subject_name}</span></div>
                <div className="summary-row"><span className="label">Level</span><span>{educationLevels.find(l => l.id === Number(formData.education_level_id))?.name}</span></div>
                <div className="summary-row"><span className="label">Plan</span><span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{selectedPlan}</span></div>
                {formData.work_type && <div className="summary-row"><span className="label">Type</span><span>{formData.work_type}</span></div>}
                {formData.due_date && <div className="summary-row"><span className="label">Due Date</span><span>{new Date(formData.due_date + 'T00:00:00').toLocaleDateString()}</span></div>}
                {formData.num_pages && qtyConfig.label && <div className="summary-row"><span className="label">{qtyConfig.label}</span><span>{formData.num_pages}</span></div>}
                {qtyConfig.weeksOnly && formData.due_date && <div className="summary-row"><span className="label">Weeks</span><span>{calcWeeksFromDueDate()}</span></div>}
                <div className="summary-row"><span className="label">Files</span><span>{files.length} file(s)</span></div>
                {pricing && (
                  <>
                    <div className="summary-row"><span className="label">Base Price</span><span>${basePrice.toFixed(2)}</span></div>
                    {urgentFee > 0 && <div className="summary-row"><span className="label">Urgent Fee</span><span style={{ color: 'var(--warning)' }}>+${urgentFee.toFixed(2)}</span></div>}
                    {discount > 0 && <div className="summary-row"><span className="label">Discount ({couponDiscount}%)</span><span style={{ color: 'var(--success)' }}>-${discount.toFixed(2)}</span></div>}
                    <div className="summary-row total"><span className="label">Total</span><span className="value">${totalPrice.toFixed(2)}</span></div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="step-actions">
          <button className="btn btn-secondary" onClick={() => setCurrentStep(prev => prev - 1)} disabled={currentStep === 0}>
            <FiArrowLeft size={16} /> Back
          </button>
          {currentStep < 2 ? (
            <button className="btn btn-primary" onClick={handleNext} disabled={!canProceed() || submitting}>
              {submitting ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div> : <>Next <FiArrowRight size={16} /></>}
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={!canProceed() || submitting}>
              {submitting ? <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div> : <><FiCheck size={18} /> Proceed to Checkout {totalPrice > 0 ? `$${totalPrice.toFixed(2)}` : ''}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
