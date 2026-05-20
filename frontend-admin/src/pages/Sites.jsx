import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiMail, FiUpload, FiX, FiSave, FiGlobe } from 'react-icons/fi';
import * as adminApi from '../services/api';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const resolveLogo = (url) => !url ? '' : (url.startsWith('http') ? url : `${API_ORIGIN}${url}`);

const EMPTY_FORM = {
  name: '', url: '', nickname: '', site_key: '', logo_url: '',
  from_name: '', from_email: '',
  smtp_host: '', smtp_port: 587, smtp_secure: false,
  smtp_user: '', smtp_pass: '',
  is_active: true,
  meta_title_login: '', meta_desc_login: '',
  meta_title_signup: '', meta_desc_signup: '',
  meta_title_dashboard: '', meta_desc_dashboard: '',
  head_scripts: '', body_scripts: ''
};

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passTouched, setPassTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testEmail, setTestEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSites();
      setSites(res.data.sites || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPassTouched(false);
    setShowModal(true);
  };

  const openEdit = (site) => {
    setEditingId(site.id);
    setForm({
      name: site.name || '',
      url: site.url || '',
      nickname: site.nickname || '',
      site_key: site.site_key || '',
      logo_url: site.logo_url || '',
      from_name: site.from_name || '',
      from_email: site.from_email || '',
      smtp_host: site.smtp_host || '',
      smtp_port: site.smtp_port || 587,
      smtp_secure: !!site.smtp_secure,
      smtp_user: site.smtp_user || '',
      smtp_pass: '',
      is_active: !!site.is_active,
      meta_title_login: site.meta_title_login || '',
      meta_desc_login: site.meta_desc_login || '',
      meta_title_signup: site.meta_title_signup || '',
      meta_desc_signup: site.meta_desc_signup || '',
      meta_title_dashboard: site.meta_title_dashboard || '',
      meta_desc_dashboard: site.meta_desc_dashboard || '',
      head_scripts: site.head_scripts || '',
      body_scripts: site.body_scripts || ''
    });
    setPassTouched(false);
    setShowModal(true);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await adminApi.uploadSiteLogo(fd);
      setForm(f => ({ ...f, logo_url: res.data.url }));
    } catch (err) {
      alert(err.response?.data?.error || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.url) { alert('Name and URL are required'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId && !passTouched) delete payload.smtp_pass;
      if (editingId) {
        await adminApi.updateSite(editingId, payload);
      } else {
        await adminApi.createSite(payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save site');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (site) => {
    if (!confirm(`Deactivate site "${site.name}"?`)) return;
    try { await adminApi.deleteSite(site.id); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const handleTest = async (site) => {
    if (testingId === site.id) {
      if (!testEmail) { alert('Enter an email'); return; }
      try {
        await adminApi.sendSiteTestEmail(site.id, { to: testEmail });
        alert('✅ Test email sent');
        setTestingId(null); setTestEmail('');
      } catch (err) {
        alert('❌ ' + (err.response?.data?.error || 'Failed to send'));
      }
    } else {
      setTestingId(site.id); setTestEmail('');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2>Sites</h2>
          <p style={{ color: 'var(--text-secondary)' }}>WordPress sites that embed the frontend. Each site gets its own email branding.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><FiPlus size={16} /> Add Site</button>
      </div>

      {loading ? (
        <div className="flex-center"><div className="loading-spinner"></div></div>
      ) : sites.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <FiGlobe size={40} style={{ color: 'var(--text-secondary)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-secondary)' }}>No sites yet. Add your first WordPress site above.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Logo</th>
                <th>Name</th>
                <th>URL</th>
                <th>From Email</th>
                <th>SMTP</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map(site => (
                <tr key={site.id}>
                  <td>
                    {site.logo_url ? (
                      <img src={resolveLogo(site.logo_url)} alt={site.name} style={{ height: 32, maxWidth: 80, objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, background: 'var(--bg-input)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <FiGlobe size={16} />
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{site.name}</div>
                    {site.nickname && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{site.nickname}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{site.site_key}</div>
                  </td>
                  <td><a href={site.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 13 }}>{site.url}</a></td>
                  <td style={{ fontSize: 13 }}>{site.from_email || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={{ fontSize: 13 }}>
                    {site.smtp_host ? (
                      <>
                        <div>{site.smtp_host}:{site.smtp_port}</div>
                        <div style={{ fontSize: 11, color: site.smtp_pass_set ? 'var(--success)' : 'var(--warning)' }}>
                          {site.smtp_pass_set ? '✓ password set' : '⚠ no password'}
                        </div>
                      </>
                    ) : <span style={{ color: 'var(--text-muted)' }}>Not configured</span>}
                  </td>
                  <td>
                    <span className={`badge-status ${site.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                      {site.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {testingId === site.id ? (
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <input type="email" placeholder="recipient@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 180 }} />
                        <button className="btn btn-sm btn-primary" onClick={() => handleTest(site)}><FiMail size={12} /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setTestingId(null); setTestEmail(''); }}><FiX size={12} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" title="Test email" onClick={() => handleTest(site)} disabled={!site.smtp_host || !site.smtp_pass_set}><FiMail size={14} /></button>
                        <button className="btn btn-sm btn-secondary" title="Edit" onClick={() => openEdit(site)}><FiEdit2 size={14} /></button>
                        <button className="btn btn-sm btn-danger" title="Deactivate" onClick={() => handleDelete(site)}><FiTrash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 720, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>{editingId ? 'Edit Site' : 'Add Site'}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowModal(false)}><FiX size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Site Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="DreamGrades" required />
                </div>
                <div className="form-group">
                  <label className="form-label">URL *</label>
                  <input className="form-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://dreamgrades.com" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Nickname</label>
                  <input className="form-input" value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} placeholder="DG" />
                </div>
                <div className="form-group">
                  <label className="form-label">Site Key</label>
                  <input className="form-input" value={form.site_key} onChange={e => setForm(f => ({ ...f, site_key: e.target.value }))} placeholder="auto-generated from name" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Logo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  {form.logo_url && (
                    <img src={resolveLogo(form.logo_url)} alt="logo" style={{ height: 48, maxWidth: 120, objectFit: 'contain', background: 'var(--bg-input)', padding: 4, borderRadius: 4 }} />
                  )}
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                    <FiUpload size={14} /> {logoUploading ? 'Uploading...' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={logoUploading} />
                  </label>
                  {form.logo_url && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(f => ({ ...f, logo_url: '' }))}>Clear</button>
                  )}
                </div>
                <input className="form-input" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="or paste an image URL" />
              </div>

              <h4 style={{ margin: '20px 0 12px', fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email Identity</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">From Name</label>
                  <input className="form-input" value={form.from_name} onChange={e => setForm(f => ({ ...f, from_name: e.target.value }))} placeholder="DreamGrades Support" />
                </div>
                <div className="form-group">
                  <label className="form-label">From Email</label>
                  <input type="email" className="form-input" value={form.from_email} onChange={e => setForm(f => ({ ...f, from_email: e.target.value }))} placeholder="noreply@dreamgrades.com" />
                </div>
              </div>

              <h4 style={{ margin: '20px 0 12px', fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>SMTP / Google Workspace</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">SMTP Host</label>
                  <input className="form-input" value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input type="number" className="form-input" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">&nbsp;</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', paddingTop: 8 }}>
                    <input type="checkbox" checked={form.smtp_secure} onChange={e => setForm(f => ({ ...f, smtp_secure: e.target.checked }))} />
                    Secure (SSL)
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">SMTP Username</label>
                  <input className="form-input" value={form.smtp_user} onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))} placeholder="user@dreamgrades.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">SMTP Password{editingId && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>(leave blank to keep)</span>}</label>
                  <input type="password" className="form-input" value={form.smtp_pass} onChange={e => { setForm(f => ({ ...f, smtp_pass: e.target.value })); setPassTouched(true); }} placeholder={editingId ? '••••••••' : 'App password or SMTP key'} />
                </div>
              </div>

              <h4 style={{ margin: '20px 0 12px', fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>SEO Meta Tags (per page)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Login Page</div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Meta Title</label>
                    <input className="form-input" value={form.meta_title_login} maxLength={255} onChange={e => setForm(f => ({ ...f, meta_title_login: e.target.value }))} placeholder="Sign in to DreamGrades" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Meta Description</label>
                    <textarea className="form-input" rows="2" maxLength={500} value={form.meta_desc_login} onChange={e => setForm(f => ({ ...f, meta_desc_login: e.target.value }))} placeholder="Access your DreamGrades account..." />
                  </div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Signup Page</div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Meta Title</label>
                    <input className="form-input" value={form.meta_title_signup} maxLength={255} onChange={e => setForm(f => ({ ...f, meta_title_signup: e.target.value }))} placeholder="Create your DreamGrades account" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Meta Description</label>
                    <textarea className="form-input" rows="2" maxLength={500} value={form.meta_desc_signup} onChange={e => setForm(f => ({ ...f, meta_desc_signup: e.target.value }))} placeholder="Join thousands of students..." />
                  </div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Dashboard Page</div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Meta Title</label>
                    <input className="form-input" value={form.meta_title_dashboard} maxLength={255} onChange={e => setForm(f => ({ ...f, meta_title_dashboard: e.target.value }))} placeholder="My DreamGrades Dashboard" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Meta Description</label>
                    <textarea className="form-input" rows="2" maxLength={500} value={form.meta_desc_dashboard} onChange={e => setForm(f => ({ ...f, meta_desc_dashboard: e.target.value }))} placeholder="Manage your orders, tutors, and payments..." />
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '20px 0 12px', fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Custom Tracking Scripts</h4>
              <div className="form-group">
                <label className="form-label">Head Scripts <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>(Google Analytics, GSC verification, Tag Manager)</span></label>
                <textarea className="form-input" rows="4" value={form.head_scripts} onChange={e => setForm(f => ({ ...f, head_scripts: e.target.value }))} placeholder={'<script src="https://www.googletagmanager.com/gtag/js?id=G-XXX"></script>\n<script>...</script>'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Inserted into &lt;head&gt;. Paste raw HTML tags as Google/Facebook provide them.</div>
              </div>
              <div className="form-group">
                <label className="form-label">Body Scripts <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>(Tawk.to, Crisp, LiveChat widgets)</span></label>
                <textarea className="form-input" rows="4" value={form.body_scripts} onChange={e => setForm(f => ({ ...f, body_scripts: e.target.value }))} placeholder={'<script>(function(d){...})();</script>'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Inserted at end of &lt;body&gt;. Used for chat widgets and pixels.</div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span className="form-label" style={{ margin: 0 }}>Active</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}><FiSave size={14} /> {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Site')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
