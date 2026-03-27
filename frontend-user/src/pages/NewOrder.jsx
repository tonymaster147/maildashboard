import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrderTypes, getSubjects, getEducationLevels, getPlans, validateCoupon, createPaymentSession, uploadFiles } from '../services/api';
import { FiUpload, FiX, FiCheck, FiArrowRight, FiArrowLeft, FiTag } from 'react-icons/fi';

const STEPS = ['Service Details', 'Schedule', 'Plan Selection', 'Review & Pay'];

export default function NewOrder() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Lookup data
  const [orderTypes, setOrderTypes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    order_type_id: '', course_name: '', subject_id: '', subject_name: '',
    education_level_id: '', start_date: '', end_date: '', num_weeks: 0,
    plan_id: '', additional_instructions: '', school_url: '', school_username: '',
    school_password: '', urgent_fee: 0, coupon_code: ''
  });
  const [files, setFiles] = useState([]);
  const [couponValid, setCouponValid] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  useEffect(() => {
    Promise.all([getOrderTypes(), getEducationLevels(), getPlans()])
      .then(([types, levels, plansData]) => {
        setOrderTypes(types.data);
        setEducationLevels(levels.data);
        setPlans(plansData.data);
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

  const calcWeeks = () => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const diff = Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000));
      update('num_weeks', Math.max(diff, 0));
    }
  };

  useEffect(() => { calcWeeks(); }, [formData.start_date, formData.end_date]);

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

  const selectedPlan = plans.find(p => p.id === Number(formData.plan_id));
  const basePrice = selectedPlan ? parseFloat(selectedPlan.price) : 0;
  const urgentFee = parseFloat(formData.urgent_fee || 0);
  const discount = couponValid ? (basePrice * couponDiscount / 100) : 0;
  const totalPrice = basePrice + urgentFee - discount;

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.order_type_id && formData.course_name && formData.subject_id && formData.education_level_id;
      case 1: return formData.start_date && formData.end_date;
      case 2: return formData.plan_id;
      case 3: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      let tempFileIds = [];

      // 1. Upload files first if any were selected
      if (files.length > 0) {
        const uploadFormData = new FormData();
        files.forEach(f => uploadFormData.append('files', f));
        
        const uploadRes = await uploadFiles(uploadFormData);
        if (uploadRes.data && uploadRes.data.files) {
          tempFileIds = uploadRes.data.files.map(f => f.id);
        }
      }

      // 2. Proceed to Stripe Checkout with temp_file_ids
      const orderTypeName = orderTypes.find(t => t.id === Number(formData.order_type_id))?.name;
      const res = await createPaymentSession({
        order_data: { 
          ...formData, 
          order_type_name: orderTypeName, 
          urgent_fee: urgentFee,
          temp_file_ids: tempFileIds 
        }
      });
      
      window.location.href = res.data.url;
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to process order or upload files');
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

        {/* Step 2: Schedule */}
        {currentStep === 1 && (
          <div className="step-content card">
            <h3 style={{ marginBottom: 24 }}>Schedule</h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input type="date" className="form-input" value={formData.start_date} onChange={e => update('start_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input type="date" className="form-input" value={formData.end_date} onChange={e => update('end_date', e.target.value)} min={formData.start_date} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Number of Weeks</label>
              <input className="form-input" type="number" value={formData.num_weeks} readOnly style={{ background: 'var(--bg-card)', color: 'var(--accent)', fontWeight: 600, fontSize: 18 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Auto-calculated from dates</p>
            </div>
          </div>
        )}

        {/* Step 3: Plan Selection */}
        {currentStep === 2 && (
          <div className="step-content">
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 24 }}>Select Your Plan</h3>
              <div className="plans-grid">
                {plans.map(plan => {
                  let features = [];
                  try { features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features || []; } catch { features = []; }
                  return (
                    <div key={plan.id} className={`plan-card ${Number(formData.plan_id) === plan.id ? 'selected' : ''}`} onClick={() => update('plan_id', plan.id)}>
                      <div className="plan-name">{plan.name}</div>
                      <div className="plan-price">${parseFloat(plan.price).toFixed(2)}</div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>{plan.description}</p>
                      <ul className="plan-features">
                        {features.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginBottom: 16 }}>Extra Options</h4>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Urgent Fee (USD)</label>
                  <input type="number" className="form-input" placeholder="0.00" value={formData.urgent_fee} onChange={e => update('urgent_fee', e.target.value)} min="0" step="0.01" />
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
              <div className="form-group">
                <label className="form-label">Additional Instructions</label>
                <textarea className="form-textarea" placeholder="Any special requirements or instructions..." value={formData.additional_instructions} onChange={e => update('additional_instructions', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review & Pay */}
        {currentStep === 3 && (
          <div className="step-content">
            <div className="grid-2">
              <div className="card">
                <h3 style={{ marginBottom: 20 }}>School Credentials</h3>
                <div className="form-group">
                  <label className="form-label">School Login URL</label>
                  <input className="form-input" placeholder="https://school.example.com" value={formData.school_url} onChange={e => update('school_url', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="form-input" placeholder="Your school username" value={formData.school_username} onChange={e => update('school_username', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-input" placeholder="Your school password" value={formData.school_password} onChange={e => update('school_password', e.target.value)} />
                </div>
              </div>

              <div className="order-summary">
                <h3 style={{ marginBottom: 20 }}>Order Summary</h3>
                <div className="summary-row"><span className="label">Service</span><span>{orderTypes.find(t => t.id === Number(formData.order_type_id))?.name}</span></div>
                <div className="summary-row"><span className="label">Course</span><span>{formData.course_name}</span></div>
                <div className="summary-row"><span className="label">Subject</span><span>{formData.subject_name}</span></div>
                <div className="summary-row"><span className="label">Level</span><span>{educationLevels.find(l => l.id === Number(formData.education_level_id))?.name}</span></div>
                <div className="summary-row"><span className="label">Plan</span><span>{selectedPlan?.name}</span></div>
                <div className="summary-row"><span className="label">Duration</span><span>{formData.num_weeks} weeks</span></div>
                <div className="summary-row"><span className="label">Files</span><span>{files.length} file(s)</span></div>
                <div className="summary-row"><span className="label">Plan Price</span><span>${basePrice.toFixed(2)}</span></div>
                {urgentFee > 0 && <div className="summary-row"><span className="label">Urgent Fee</span><span style={{ color: 'var(--warning)' }}>+${urgentFee.toFixed(2)}</span></div>}
                {discount > 0 && <div className="summary-row"><span className="label">Discount ({couponDiscount}%)</span><span style={{ color: 'var(--success)' }}>-${discount.toFixed(2)}</span></div>}
                <div className="summary-row total"><span className="label">Total</span><span className="value">${totalPrice.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="step-actions">
          <button className="btn btn-secondary" onClick={() => setCurrentStep(prev => prev - 1)} disabled={currentStep === 0}>
            <FiArrowLeft size={16} /> Previous
          </button>
          {currentStep < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setCurrentStep(prev => prev + 1)} disabled={!canProceed()}>
              Next <FiArrowRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div> : <><FiCheck size={18} /> Pay ${totalPrice.toFixed(2)}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
