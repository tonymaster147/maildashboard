// Admin — Sales Activity monitor. Read-only view of any sales person's payment
// calendar, task status (done / in-progress / pending / overdue), 7-day
// productivity, and the comments they've written. No mutations.

import { useState, useEffect, useCallback } from 'react';
import {
  FiCalendar, FiCheckCircle, FiClock, FiAlertTriangle, FiMessageSquare,
  FiChevronLeft, FiChevronRight, FiUser, FiCreditCard, FiPlus, FiX, FiUserPlus,
} from 'react-icons/fi';
import {
  getSalesActivityPeople, getSalesActivitySummary, getSalesActivityTasks,
  assignSalesReminder, createSalesActivityTask,
} from '../services/api';

const TYPES = {
  installment: { c: '#6366f1', label: 'Installment' },
  partial: { c: '#f59e0b', label: 'Partial' },
  unpaid: { c: '#ef4444', label: 'Unpaid' },
  paid: { c: '#22c55e', label: 'Full payment' },
  todo: { c: '#a855f7', label: 'Task' },
};
const STATUS = {
  done: { cls: 'done', label: 'Done' },
  in_progress: { cls: 'prog', label: 'In progress' },
  pending: { cls: 'pend', label: 'Pending' },
  overdue: { cls: 'over', label: 'Overdue' },
};
const AVATAR = ['#f97316', '#10b981', '#a855f7', '#3b82f6', '#ef4444', '#14b8a6', '#f59e0b'];
const money = (v) => (v == null ? '' : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const initials = (name) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const shortLabel = (e) => {
  const a = e.amount != null ? money(e.amount) + ' · ' : '';
  return a + (e.category === 'installment' ? 'Installment' : e.category === 'partial' ? 'Balance'
    : e.category === 'unpaid' ? 'Unpaid' : e.category === 'paid' ? 'Final' : 'Task');
};

export default function AdminSalesActivity() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const T = iso(today);

  const [people, setPeople] = useState([]);
  const [selId, setSelId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [viewY, setViewY] = useState(today.getFullYear());
  const [viewM, setViewM] = useState(today.getMonth());
  const [selected, setSelected] = useState(T);
  const [loading, setLoading] = useState(true);
  const [taskOpen, setTaskOpen] = useState(false);
  const [tForm, setTForm] = useState({ title: '', category: 'todo', due_date: T, amount: '', target: 'general' });
  const [tSaving, setTSaving] = useState(false);
  const [tErr, setTErr] = useState('');

  const gridRange = useCallback(() => {
    const first = new Date(viewY, viewM, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 41);
    return { from: iso(start), to: iso(end) };
  }, [viewY, viewM]);

  const loadPeople = useCallback(() => getSalesActivityPeople().then(r => setPeople(r.data.people || [])).catch(() => {}), []);
  const loadSummary = useCallback(() => { if (selId) getSalesActivitySummary(selId).then(r => setSummary(r.data)).catch(() => setSummary(null)); }, [selId]);
  const loadTasks = useCallback(() => {
    if (!selId) return;
    const { from, to } = gridRange();
    getSalesActivityTasks(selId, { from, to }).then(r => setItems(r.data.items || [])).catch(() => setItems([]));
  }, [selId, gridRange]);

  useEffect(() => {
    getSalesActivityPeople().then(r => {
      const list = r.data.people || [];
      setPeople(list);
      if (list.length) setSelId(list[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  const reload = () => { loadPeople(); loadSummary(); loadTasks(); };

  const assignItem = async (item, salesUserId) => {
    if (!salesUserId) return;
    try {
      await assignSalesReminder({ ref_type: item.ref_type, ref_id: item.ref_id, sales_user_id: Number(salesUserId) });
      reload();
    } catch (e) { alert(e.response?.data?.error || 'Failed to assign'); }
  };

  const submitTask = async (e) => {
    e.preventDefault();
    setTErr('');
    if (!tForm.title.trim()) { setTErr('Title is required.'); return; }
    const payload = {
      title: tForm.title.trim(), category: tForm.category, due_date: tForm.due_date,
      amount: tForm.amount === '' ? null : tForm.amount,
    };
    if (tForm.target === 'general') payload.is_general = true;
    else payload.sales_user_id = Number(tForm.target);
    setTSaving(true);
    try {
      await createSalesActivityTask(payload);
      setTaskOpen(false);
      setTForm({ title: '', category: 'todo', due_date: T, amount: '', target: 'general' });
      reload();
    } catch (err) {
      setTErr(err.response?.data?.error || 'Failed to create task');
    } finally { setTSaving(false); }
  };

  const selPerson = people.find(p => p.id === selId);

  // calendar cells
  const first = new Date(viewY, viewM, 1);
  const startDow = first.getDay();
  const dim = new Date(viewY, viewM + 1, 0).getDate();
  const prevDim = new Date(viewY, viewM, 0).getDate();
  const cells = [];
  for (let i = startDow - 1; i >= 0; i--) cells.push({ d: prevDim - i, out: true, mo: viewM - 1 });
  for (let d = 1; d <= dim; d++) cells.push({ d, out: false, mo: viewM });
  while (cells.length < 42) cells.push({ d: cells.length - (startDow + dim) + 1, out: true, mo: viewM + 1 });
  const byDate = {};
  items.forEach(it => { (byDate[it.due_date] = byDate[it.due_date] || []).push(it); });
  const daySel = byDate[selected] || [];
  const prevMonth = () => { let m = viewM - 1, y = viewY; if (m < 0) { m = 11; y--; } setViewM(m); setViewY(y); };
  const nextMonth = () => { let m = viewM + 1, y = viewY; if (m > 11) { m = 0; y++; } setViewM(m); setViewY(y); };

  const K = summary?.kpis || {};
  const BD = summary?.today_breakdown || {};
  const prod = summary?.productivity || [];
  const comments = summary?.recent_comments || [];
  const maxProd = Math.max(1, ...prod.map(p => p.value));
  const bdTotal = (BD.done || 0) + (BD.in_progress || 0) + (BD.pending || 0) + (BD.overdue || 0);
  const avColor = (id) => AVATAR[(people.findIndex(p => p.id === id) + AVATAR.length) % AVATAR.length];

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner" /></div>;

  return (
    <div className="sa">
      <style>{saStyles}</style>

      <div className="sa-top">
        <div style={{ flex: 1 }}>
          <h1>Sales Activity</h1>
          <p>Monitor each sales person's payment calendar, task progress, and notes.</p>
        </div>
        <button className="sa-newbtn" onClick={() => { setTErr(''); setTaskOpen(true); }}>
          <FiPlus size={15} /> New Task
        </button>
      </div>

      {people.length === 0 ? (
        <div className="sa-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No active sales users yet.</div>
      ) : (
        <>
          <div className="sa-label">Sales Team — pick a person to inspect</div>
          <div className="sa-team">
            {people.map(p => (
              <button key={p.id} className={`sa-person ${p.id === selId ? 'sel' : ''}`} onClick={() => { setSelId(p.id); setSelected(T); setViewY(today.getFullYear()); setViewM(today.getMonth()); }}>
                <div className="av" style={{ background: avColor(p.id) }}>{initials(p.name)}</div>
                <div className="meta"><div className="pn">{p.name}</div><div className="pr">{p.role === 'sales_lead' ? 'Sales Lead' : 'Sales Executive'}</div></div>
                <div className="frac"><div className="lb">Today</div><b>{p.done_today}</b><small>/{p.assigned_today} done</small></div>
              </button>
            ))}
          </div>

          {/* KPIs */}
          <div className="sa-kpis">
            <Kpi color="#6366f1" v={K.assigned_today ?? 0} l="Assigned Today" />
            <Kpi color="#22c55e" v={K.done_today ?? 0} l="Done Today" />
            <Kpi color="#3b82f6" v={K.in_progress ?? 0} l="In Progress" />
            <Kpi color="#ef4444" v={K.overdue ?? 0} l="Overdue" />
            <Kpi color="#84C225" v={`${K.completion ?? 0}%`} l="Completion (today)" />
          </div>

          {/* Calendar + day detail */}
          <div className="sa-grid">
            <section className="sa-card">
              <div className="sa-ch">
                <FiCalendar style={{ color: '#818cf8' }} />
                <div><h3>{selPerson ? selPerson.name.split(' ')[0] + "'s Calendar" : 'Calendar'}</h3><div className="sub">Read-only · coloured by payment type</div></div>
                <div className="sa-cnav">
                  <button onClick={prevMonth} aria-label="Previous month"><FiChevronLeft size={16} /></button>
                  <div className="mo">{new Date(viewY, viewM, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
                  <button onClick={nextMonth} aria-label="Next month"><FiChevronRight size={16} /></button>
                </div>
              </div>
              <div className="sa-legend">
                {Object.entries(TYPES).map(([k, v]) => <span key={k}><i style={{ background: v.c }} />{v.label}</span>)}
                <span style={{ marginLeft: 'auto' }}><i style={{ background: 'transparent', outline: '2px solid #22c55e', outlineOffset: 1, borderRadius: '50%' }} />ring = done</span>
              </div>
              <div className="sa-cal">
                <div className="sa-dow">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}</div>
                <div className="sa-days">
                  {cells.map((c, idx) => {
                    const dt = new Date(viewY, c.mo, c.d); const key = iso(dt);
                    const evs = byDate[key] || [];
                    const cls = ['sa-day', c.out ? 'out' : '', key === T ? 'today' : '', key === selected && !c.out ? 'sel' : ''].join(' ').trim();
                    return (
                      <div key={idx} className={cls} onClick={() => !c.out && setSelected(key)}>
                        <div className="num">{c.d}{key === T && <span className="td">TODAY</span>}</div>
                        {evs.slice(0, 3).map(e => (
                          <div key={e.key} className={`ev ${e.status === 'done' ? 'done' : ''}`} title={e.title}>
                            <i style={{ background: TYPES[e.category]?.c || '#94a3b8', outline: e.status === 'done' ? '2px solid #22c55e' : 'none', outlineOffset: 1 }} />{shortLabel(e)}
                          </div>
                        ))}
                        {evs.length > 3 && <div className="ev-more">+{evs.length - 3} more</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="sa-card">
              <div className="sa-ch">
                <FiCheckCircle style={{ color: '#818cf8' }} />
                <h3>Day Detail</h3>
                <div className="date">{new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
              </div>
              <div className="sa-remlist">
                {daySel.length === 0 ? (
                  <div className="sa-empty"><FiCalendar size={30} /><div>No tasks on this day.</div></div>
                ) : daySel.map(item => {
                  const t = TYPES[item.category] || { c: '#94a3b8', label: item.category };
                  const st = item.overdue ? STATUS.overdue : (STATUS[item.status] || STATUS.pending);
                  return (
                    <div className="sa-rem" key={item.key}>
                      <div className="rtitle">{item.title}<span className="tag" style={{ background: t.c + '28', color: t.c }}>{t.label}</span>
                        {item.general && <span className="tag" style={{ background: '#a855f728', color: '#c084fc' }}>Team</span>}
                        {item.assigned && <span className="tag" style={{ background: '#3b82f628', color: '#60a5fa' }}>Assigned</span>}
                      </div>
                      <div className="rmeta">
                        {item.student_name && <span><FiUser size={11} /> <b>{item.student_name}</b></span>}
                        {item.amount != null && <span><FiCreditCard size={11} /> <b>{money(item.amount)}</b></span>}
                        <span className={`sa-status ${st.cls}`}>{st.label}</span>
                      </div>
                      {item.comments?.length > 0 ? (
                        <div className="rcmts">{item.comments.map(c => <div key={c.id} className="rcmt"><b>{c.author_name || 'Sales'}:</b> {c.comment}</div>)}</div>
                      ) : <div className="no-cmt">No comments added.</div>}
                      <div className="rfoot">
                        <span className="cc">💬 {item.comments?.length || 0} comment{(item.comments?.length || 0) === 1 ? '' : 's'}</span>
                        {(item.ref_type === 'order' || item.ref_type === 'installment') && (
                          <label className="sa-assign"><FiUserPlus size={12} />
                            <select defaultValue="" onChange={e => { assignItem(item, e.target.value); e.target.value = ''; }}>
                              <option value="" disabled>Assign to…</option>
                              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>

          {/* Three widgets */}
          <div className="sa-three">
            <section className="sa-card pad">
              <h3 className="w-h">Today's Task Status</h3>
              <div className="sub">{bdTotal} task{bdTotal === 1 ? '' : 's'} assigned today</div>
              <div className="sa-stack">
                {bdTotal === 0 ? <i style={{ width: '100%', background: 'var(--border)' }} /> : (
                  <>
                    {BD.done > 0 && <i style={{ width: `${BD.done / bdTotal * 100}%`, background: '#22c55e' }} />}
                    {BD.in_progress > 0 && <i style={{ width: `${BD.in_progress / bdTotal * 100}%`, background: '#3b82f6' }} />}
                    {BD.pending > 0 && <i style={{ width: `${BD.pending / bdTotal * 100}%`, background: '#f59e0b' }} />}
                    {BD.overdue > 0 && <i style={{ width: `${BD.overdue / bdTotal * 100}%`, background: '#ef4444' }} />}
                  </>
                )}
              </div>
              <div className="sa-key">
                <div><span className="dk" style={{ background: '#22c55e' }} />Done<b>{BD.done || 0}</b></div>
                <div><span className="dk" style={{ background: '#3b82f6' }} />In progress<b>{BD.in_progress || 0}</b></div>
                <div><span className="dk" style={{ background: '#f59e0b' }} />Pending<b>{BD.pending || 0}</b></div>
                <div><span className="dk" style={{ background: '#ef4444' }} />Overdue<b>{BD.overdue || 0}</b></div>
              </div>
            </section>

            <section className="sa-card pad">
              <h3 className="w-h">7-Day Productivity</h3>
              <div className="sub">Tasks marked done per day</div>
              <div className="sa-bars">
                {prod.map((p, i) => (
                  <div className="col" key={i}>
                    <div className="val">{p.value}</div>
                    <div className="stem"><i style={{ height: `${p.value / maxProd * 100}%` }} /></div>
                    <div className="lbl">{p.label[0]}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="sa-card">
              <div className="sa-ch"><FiMessageSquare style={{ color: '#818cf8' }} /><h3>Recent Comments</h3></div>
              <div className="sa-feed">
                {comments.length === 0 ? (
                  <div className="sa-empty" style={{ padding: 24 }}><div>No comments yet from {selPerson ? selPerson.name.split(' ')[0] : 'this person'}.</div></div>
                ) : comments.map(c => (
                  <div className="fi" key={c.id}>
                    <div className="fav" style={{ background: avColor(selId) }}>{(c.author_name || 'S')[0]}</div>
                    <div><div className="ft"><b>{c.author_name || 'Sales'}</b> <span className="fq">on</span> {(c.title || '').split(' — ')[1] || c.title}</div>
                      <div className="ft fq">"{c.comment}"</div>
                      <div className="fm">{c.created_at}</div></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {/* New task — assign to one person or make it a team-wide general task */}
      {taskOpen && (
        <div className="sa-modal-bg" onClick={() => !tSaving && setTaskOpen(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-h">
              <h3>New task</h3>
              <button className="sa-x" onClick={() => setTaskOpen(false)} disabled={tSaving}><FiX size={16} /></button>
            </div>
            <form onSubmit={submitTask} className="sa-modal-b">
              {tErr && <div className="sa-modal-err">{tErr}</div>}
              <label>Task
                <input value={tForm.title} onChange={e => setTForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Call overdue leads" autoFocus />
              </label>
              <label>Assign to
                <select value={tForm.target} onChange={e => setTForm(f => ({ ...f, target: e.target.value }))}>
                  <option value="general">🌐 General — all sales people</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role === 'sales_lead' ? 'Lead' : 'Exec'})</option>)}
                </select>
              </label>
              <div className="sa-modal-row">
                <label>Category
                  <select value={tForm.category} onChange={e => setTForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="todo">Task</option>
                    <option value="unpaid">Unpaid follow-up</option>
                    <option value="partial">Partial</option>
                    <option value="installment">Installment</option>
                  </select>
                </label>
                <label>Due date
                  <input type="date" value={tForm.due_date} onChange={e => setTForm(f => ({ ...f, due_date: e.target.value }))} />
                </label>
              </div>
              <label>Amount (optional)
                <input type="number" step="0.01" min="0" value={tForm.amount} onChange={e => setTForm(f => ({ ...f, amount: e.target.value }))} placeholder="—" />
              </label>
              <div className="sa-modal-foot">
                <button type="button" className="sa-mbtn" onClick={() => setTaskOpen(false)} disabled={tSaving}>Cancel</button>
                <button type="submit" className="sa-mbtn primary" disabled={tSaving}>{tSaving ? 'Creating…' : 'Create & notify'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ color, v, l }) {
  return (
    <div className="sa-kpi">
      <div className="v" style={{ color }}>{v}</div>
      <div className="l"><i style={{ background: color }} />{l}</div>
    </div>
  );
}

const saStyles = `
.sa h1{font-size:24px;font-weight:800;margin:0;letter-spacing:-.3px;color:var(--text-primary)}
.sa .sa-top{margin-bottom:22px;display:flex;align-items:flex-start;gap:16px}
.sa .sa-top p{margin:4px 0 0;color:var(--text-secondary)}
.sa-newbtn{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(135deg,var(--accent),var(--accent-hover));color:#0a1628;border:none;border-radius:10px;padding:10px 16px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}
.sa-newbtn:hover{filter:brightness(1.05)}
.sa-assign{margin-left:auto;display:inline-flex;align-items:center;gap:5px;color:var(--text-muted)}
.sa-assign select{background:var(--bg-input);border:1px solid var(--border);border-radius:7px;color:var(--text-secondary);font:inherit;font-size:11.5px;font-weight:700;padding:4px 6px;cursor:pointer;outline:none}
.sa-assign select:hover{border-color:var(--accent)}
.sa-modal-bg{position:fixed;inset:0;background:rgba(4,10,22,.72);display:grid;place-items:center;z-index:400;padding:20px}
.sa-modal{width:100%;max-width:440px;background:var(--bg-card);border:1px solid var(--border);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.5);overflow:hidden}
.sa-modal-h{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border)}
.sa-modal-h h3{margin:0;font-size:16px;font-weight:800;color:var(--text-primary)}
.sa-x{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-secondary);cursor:pointer;display:grid;place-items:center}
.sa-modal-b{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.sa-modal-err{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:9px 11px;font-size:12.5px;font-weight:600}
.sa-modal-b label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted)}
.sa-modal-b input,.sa-modal-b select{background:var(--bg-dark);border:1px solid var(--border);border-radius:9px;padding:9px 11px;color:var(--text-primary);font:inherit;font-size:14px;outline:none;text-transform:none;letter-spacing:0;font-weight:500}
.sa-modal-b input:focus,.sa-modal-b select:focus{border-color:var(--accent)}
.sa-modal-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sa-modal-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:4px}
.sa-mbtn{font:inherit;font-size:12.5px;font-weight:700;border-radius:9px;padding:9px 15px;cursor:pointer;border:1px solid var(--border);background:var(--bg-input);color:var(--text-secondary)}
.sa-mbtn.primary{background:linear-gradient(135deg,var(--accent),var(--accent-hover));color:#0a1628;border:none}
.sa-label{font-size:11px;font-weight:800;letter-spacing:1.2px;color:var(--text-muted);text-transform:uppercase;margin:4px 0 12px}
.sa-card{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
.sa-card.pad{padding:18px}
.sa-team{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.sa-person{display:flex;gap:12px;align-items:center;background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:14px;cursor:pointer;transition:.15s;text-align:left;font:inherit}
.sa-person:hover{border-color:var(--border-light);transform:translateY(-2px)}
.sa-person.sel{border-color:#6366f1;box-shadow:0 0 0 2px rgba(99,102,241,.3)}
.sa-person .av{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-weight:800;font-size:15px;color:#fff;flex:0 0 auto}
.sa-person .meta{min-width:0}
.sa-person .pn{font-weight:700;font-size:14px;color:var(--text-primary)}
.sa-person .pr{font-size:11.5px;color:var(--text-muted)}
.sa-person .frac{margin-left:auto;text-align:right}
.sa-person .frac .lb{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px}
.sa-person .frac b{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--text-primary)}
.sa-person .frac small{color:var(--text-muted);font-weight:700}
.sa-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:22px}
.sa-kpi{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:16px}
.sa-kpi .v{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
.sa-kpi .l{font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-top:7px;font-weight:600}
.sa-kpi .l i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle}
.sa-grid{display:grid;grid-template-columns:1.7fr 1fr;gap:18px;align-items:start}
.sa-ch{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border)}
.sa-ch h3{margin:0;font-size:15px;font-weight:800;color:var(--text-primary)}
.sa-ch .sub{font-size:12px;color:var(--text-secondary)}
.sa-ch .date{font-size:12px;color:var(--text-secondary);margin-left:auto;font-weight:700}
.sa-cnav{display:flex;align-items:center;gap:8px;margin-left:auto}
.sa-cnav button{width:32px;height:32px;border-radius:9px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-secondary);cursor:pointer;display:grid;place-items:center}
.sa-cnav button:hover{color:var(--text-primary);border-color:var(--border-light)}
.sa-cnav .mo{min-width:130px;text-align:center;font-weight:700;font-size:14px;color:var(--text-primary);font-variant-numeric:tabular-nums}
.sa-legend{display:flex;flex-wrap:wrap;gap:14px;padding:12px 18px;border-bottom:1px solid var(--border)}
.sa-legend span{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--text-secondary);font-weight:600}
.sa-legend i{width:9px;height:9px;border-radius:3px;display:inline-block}
.sa-cal{padding:14px 16px 18px}
.sa-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px}
.sa-dow div{text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase}
.sa-days{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.sa-day{min-height:92px;border:1px solid var(--border);border-radius:11px;background:var(--bg-input);padding:7px;cursor:pointer;display:flex;flex-direction:column;gap:5px;transition:.12s}
.sa-day:hover{border-color:var(--border-light);background:var(--bg-card-hover)}
.sa-day.out{opacity:.32;cursor:default}
.sa-day.today{border-color:var(--accent);box-shadow:inset 0 0 0 1px rgba(132,194,37,.4)}
.sa-day.sel{border-color:#6366f1;box-shadow:0 0 0 2px rgba(99,102,241,.35)}
.sa-day .num{font-size:12.5px;font-weight:700;color:var(--text-secondary);font-variant-numeric:tabular-nums;display:flex;justify-content:space-between;align-items:center}
.sa-day.today .num{color:var(--accent)}
.sa-day .num .td{font-size:9px;background:var(--accent);color:#0a1628;border-radius:5px;padding:1px 5px;font-weight:800}
.sa-day .ev{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:3px 6px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(255,255,255,.05);color:var(--text-primary)}
.sa-day .ev i{width:6px;height:6px;border-radius:50%;flex:0 0 auto}
.sa-day .ev.done{opacity:.55;text-decoration:line-through}
.sa-day .ev-more{font-size:10.5px;color:var(--text-muted);font-weight:700;padding-left:6px}
.sa-remlist{padding:10px 12px 12px;display:flex;flex-direction:column;gap:9px;max-height:460px;overflow:auto}
.sa-rem{border:1px solid var(--border);border-radius:11px;padding:12px;background:var(--bg-input)}
.sa-rem .rtitle{font-weight:700;font-size:13.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--text-primary)}
.sa-rem .tag{font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:2px 7px;border-radius:6px}
.sa-rem .rmeta{font-size:12px;color:var(--text-secondary);margin-top:5px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.sa-rem .rmeta b{color:var(--text-primary);font-weight:700}
.sa-status{font-size:10.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;padding:3px 9px;border-radius:999px}
.sa-status.done{background:rgba(34,197,94,.16);color:#4ade80}
.sa-status.prog{background:rgba(59,130,246,.16);color:#60a5fa}
.sa-status.pend{background:rgba(245,158,11,.16);color:#fbbf24}
.sa-status.over{background:rgba(239,68,68,.16);color:#f87171}
.sa-rem .rcmts{margin-top:9px;display:flex;flex-direction:column;gap:6px}
.sa-rem .rcmt{font-size:12px;color:var(--text-secondary);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 9px;border-left:2px solid #6366f1}
.sa-rem .rcmt b{color:var(--text-primary)}
.sa-rem .no-cmt{font-size:11.5px;color:var(--text-muted);margin-top:8px;font-style:italic}
.sa-rem .rfoot{margin-top:10px}
.sa-rem .cc{font-size:11.5px;color:var(--text-muted);font-weight:700}
.sa-empty{padding:36px 20px;text-align:center;color:var(--text-muted)}
.sa-three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:18px}
.sa-three .w-h{margin:0;font-size:15px;color:var(--text-primary)}
.sa-three .sub{color:var(--text-secondary);font-size:12px;margin-top:2px}
.sa-stack{display:flex;height:14px;border-radius:8px;overflow:hidden;margin:14px 0 12px;background:var(--bg-input)}
.sa-stack i{display:block;height:100%}
.sa-key{display:flex;flex-direction:column;gap:8px}
.sa-key div{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text-secondary)}
.sa-key b{margin-left:auto;color:var(--text-primary);font-variant-numeric:tabular-nums}
.sa-key .dk{width:10px;height:10px;border-radius:3px}
.sa-bars{display:flex;align-items:flex-end;gap:10px;height:120px;padding:16px 4px 0}
.sa-bars .col{flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;height:100%}
.sa-bars .stem{width:100%;display:flex;align-items:flex-end;justify-content:center;flex:1}
.sa-bars .stem i{width:64%;background:linear-gradient(180deg,#818cf8,#6366f1);border-radius:6px 6px 0 0;min-height:3px}
.sa-bars .lbl{font-size:11px;color:var(--text-muted);font-weight:700}
.sa-bars .val{font-size:11px;color:var(--text-secondary);font-variant-numeric:tabular-nums}
.sa-feed{padding:10px 14px 14px;display:flex;flex-direction:column;gap:10px;max-height:300px;overflow:auto}
.sa-feed .fi{display:flex;gap:11px}
.sa-feed .fav{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff;flex:0 0 auto}
.sa-feed .ft{font-size:12.5px;color:var(--text-primary)}
.sa-feed .fq{color:var(--text-secondary)}
.sa-feed .fm{font-size:11px;color:var(--text-muted);margin-top:2px}
@media(max-width:1180px){.sa-team{grid-template-columns:repeat(2,1fr)}.sa-kpis{grid-template-columns:repeat(2,1fr)}.sa-grid{grid-template-columns:1fr}.sa-three{grid-template-columns:1fr}}
`;
