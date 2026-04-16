import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiSave, FiPlus, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

const SLUG_MAP = {
  'online-class': 'Online Class',
  'assignment': 'Assignment',
  'essay': 'Essay/Paper',
  'project': 'Project',
  'discussion': 'Discussion',
  'online-exam': 'Online Exam',
  'online-quiz': 'Online Quiz',
  'test': 'Test',
};

const TIER_STYLE = (tier) => ({
  fontSize: 12, padding: '2px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'capitalize',
  background: tier === 'vip' ? '#8b5cf6' : tier === 'priority' ? 'var(--warning)' : tier === 'premium' ? 'var(--accent)' : 'var(--bg-input)',
  color: tier !== 'essential' ? '#fff' : 'inherit'
});

export default function ServicePricing() {
  const { serviceSlug } = useParams();
  const typeName = SLUG_MAP[serviceSlug] || serviceSlug;
  const { getPricingRules, getSettings, createPricingRule, updatePricingRule, deletePricingRule } = useApi();

  const [rules, setRules] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);
  const [educationLevels, setEducationLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ education_level_id: '', range_type: 'flat', from_range: '', to_range: '', price: '', plan_tier: 'essential' });

  const fetchData = async () => {
    try {
      const [priceRes, settingsRes] = await Promise.all([getPricingRules(), getSettings()]);
      setRules(priceRes.data.rules.filter(r => r.order_type_name === typeName));
      setOrderTypes(settingsRes.data.orderTypes || []);
      setEducationLevels(settingsRes.data.educationLevels || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); fetchData(); }, [serviceSlug]);

  const orderType = orderTypes.find(t => t.name === typeName);
  const hasEducationLevels = rules.some(r => r.education_level_name);
  const hasRanges = rules.some(r => r.range_type !== 'flat');

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!orderType) return;
    try {
      await createPricingRule({
        order_type_id: orderType.id,
        education_level_id: newRule.education_level_id ? parseInt(newRule.education_level_id) : null,
        range_type: newRule.range_type,
        from_range: newRule.range_type !== 'flat' ? parseInt(newRule.from_range) : null,
        to_range: newRule.range_type !== 'flat' ? parseInt(newRule.to_range) : null,
        price: parseFloat(newRule.price),
        plan_tier: newRule.plan_tier
      });
      setShowAddRule(false);
      setNewRule({ education_level_id: '', range_type: 'flat', from_range: '', to_range: '', price: '', plan_tier: 'essential' });
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Failed to add rule'); }
  };

  const handleEditRule = async (rule) => {
    try {
      await updatePricingRule(rule.id, { price: parseFloat(rule.price), from_range: rule.from_range, to_range: rule.to_range, is_active: rule.is_active });
      setEditingRule(null);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this pricing rule?')) return;
    try { await deletePricingRule(id); fetchData(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>{typeName} Pricing</h2>
        <p>Manage pricing rules for {typeName}</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4>Pricing Rules ({rules.length})</h4>
          <button className="btn btn-sm btn-primary" onClick={() => setShowAddRule(true)}><FiPlus size={14} /> Add Rule</button>
        </div>

        {showAddRule && (
          <form onSubmit={handleAddRule} style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Education Level</label>
                <select className="form-select" value={newRule.education_level_id} onChange={e => setNewRule({ ...newRule, education_level_id: e.target.value })} style={{ minWidth: 140 }}>
                  <option value="">Any Level</option>
                  {educationLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Plan Tier</label>
                <select className="form-select" value={newRule.plan_tier} onChange={e => setNewRule({ ...newRule, plan_tier: e.target.value })} style={{ minWidth: 110 }}>
                  <option value="essential">Essential</option>
                  <option value="premium">Premium</option>
                  <option value="priority">Priority</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Range Type</label>
                <select className="form-select" value={newRule.range_type} onChange={e => setNewRule({ ...newRule, range_type: e.target.value })} style={{ minWidth: 100 }}>
                  <option value="flat">Flat</option>
                  <option value="weeks">Weeks</option>
                  <option value="pages">Pages</option>
                </select>
              </div>
              {newRule.range_type !== 'flat' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>From</label>
                    <input type="number" className="form-input" value={newRule.from_range} onChange={e => setNewRule({ ...newRule, from_range: e.target.value })} required style={{ width: 70 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>To</label>
                    <input type="number" className="form-input" value={newRule.to_range} onChange={e => setNewRule({ ...newRule, to_range: e.target.value })} required style={{ width: 70 }} />
                  </div>
                </>
              )}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Price ($)</label>
                <input type="number" step="0.01" className="form-input" value={newRule.price} onChange={e => setNewRule({ ...newRule, price: e.target.value })} required style={{ width: 90 }} />
              </div>
              <button type="submit" className="btn btn-sm btn-primary"><FiPlus size={12} /> Add</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddRule(false)}>Cancel</button>
            </div>
          </form>
        )}

        {rules.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No pricing rules configured for {typeName}.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {hasEducationLevels && <th>Education Level</th>}
                  <th>Tier</th>
                  {hasRanges && <th>Type</th>}
                  {hasRanges && <th>Range</th>}
                  <th>Price</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id}>
                    {editingRule?.id === r.id ? (
                      <>
                        {hasEducationLevels && <td>{r.education_level_name || <span style={{ color: 'var(--text-muted)' }}>Any</span>}</td>}
                        <td><span style={TIER_STYLE(r.plan_tier)}>{r.plan_tier}</span></td>
                        {hasRanges && <td>{r.range_type}</td>}
                        {hasRanges && (
                          <td>
                            {r.range_type !== 'flat' ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="number" className="form-input" value={editingRule.from_range} onChange={e => setEditingRule({ ...editingRule, from_range: e.target.value })} style={{ width: 60, padding: '2px 6px' }} />
                                <span>-</span>
                                <input type="number" className="form-input" value={editingRule.to_range} onChange={e => setEditingRule({ ...editingRule, to_range: e.target.value })} style={{ width: 60, padding: '2px 6px' }} />
                              </div>
                            ) : '—'}
                          </td>
                        )}
                        <td><input type="number" step="0.01" className="form-input" value={editingRule.price} onChange={e => setEditingRule({ ...editingRule, price: e.target.value })} style={{ width: 80, padding: '2px 6px' }} /></td>
                        <td>
                          <select className="form-select" value={editingRule.is_active} onChange={e => setEditingRule({ ...editingRule, is_active: parseInt(e.target.value) })} style={{ padding: '2px 6px', fontSize: 12 }}>
                            <option value={1}>Yes</option>
                            <option value={0}>No</option>
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm btn-primary" onClick={() => handleEditRule(editingRule)}><FiSave size={12} /></button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditingRule(null)}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {hasEducationLevels && <td>{r.education_level_name || <span style={{ color: 'var(--text-muted)' }}>Any</span>}</td>}
                        <td><span style={TIER_STYLE(r.plan_tier)}>{r.plan_tier}</span></td>
                        {hasRanges && <td><span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--bg-input)', borderRadius: 4 }}>{r.range_type}</span></td>}
                        {hasRanges && <td>{r.range_type !== 'flat' ? `${r.from_range} - ${r.to_range}` : '—'}</td>}
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>${parseFloat(r.price).toFixed(2)}</td>
                        <td><span className={`badge-status ${r.is_active ? 'badge-active' : 'badge-cancelled'}`}>{r.is_active ? 'Yes' : 'No'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditingRule({ ...r })}><FiEdit2 size={12} /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRule(r.id)}><FiTrash2 size={12} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
