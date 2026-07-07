// Sales Dashboard — payment-reminder calendar + to-dos + needs-attention +
// recent orders for sales_lead / sales_executive. No revenue figures.
// Reminders come live from installments; the sales person's status + comments
// on each are stored per person (materialized on first action).

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FiClock, FiAlertTriangle, FiCalendar, FiMessageSquare, FiCheckCircle,
  FiShoppingBag, FiChevronLeft, FiChevronRight, FiPlus, FiTrash2,
  FiSend, FiUser, FiCreditCard,
} from 'react-icons/fi';
import { salesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PaymentCollectionModal from '../components/PaymentCollectionModal';

const TYPES = {
  installment: { c: '#6366f1', label: 'Installment' },
  partial: { c: '#f59e0b', label: 'Partial' },
  unpaid: { c: '#ef4444', label: 'Unpaid' },
  paid: { c: '#22c55e', label: 'Full payment' },
  todo: { c: '#a855f7', label: 'Task' },
};
const money = (v) => (v == null ? '' : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortLabel = (e) => {
  const a = e.amount != null ? money(e.amount) + ' · ' : '';
  return a + (e.category === 'installment' ? 'Installment' : e.category === 'partial' ? 'Balance'
    : e.category === 'unpaid' ? 'Unpaid' : e.category === 'paid' ? 'Final' : 'Task');
};
const refBody = (item) => (item.id ? { task_id: item.id } : { ref_type: item.ref_type, ref_id: item.ref_id });

export default function SalesDashboard() {
  const { user } = useAuth();
  const canCollect = user?.role === 'sales_lead' || user?.role === 'admin';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const T = iso(today);

  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [todos, setTodos] = useState([]);
  const [recent, setRecent] = useState([]);
  const [viewY, setViewY] = useState(today.getFullYear());
  const [viewM, setViewM] = useState(today.getMonth());
  const [selected, setSelected] = useState(T);
  const [todoText, setTodoText] = useState('');
  const [loading, setLoading] = useState(true);
  const [payFor, setPayFor] = useState(null);          // order item awaiting payment on completion

  // Grid range for the visible month (6 weeks) so adjacent-month events show.
  const gridRange = useCallback(() => {
    const first = new Date(viewY, viewM, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 41);
    return { from: iso(start), to: iso(end) };
  }, [viewY, viewM]);

  const loadMonth = useCallback(() => {
    const { from, to } = gridRange();
    return salesApi.getSalesTasks({ from, to }).then(r => setItems(r.data.items || [])).catch(() => {});
  }, [gridRange]);
  const loadSummary = useCallback(() => salesApi.getSalesSummary().then(r => setSummary(r.data)).catch(() => {}), []);
  const loadTodos = useCallback(() => salesApi.getSalesTasks({ from: iso(new Date(today.getFullYear() - 1, 0, 1)), to: iso(new Date(today.getFullYear() + 2, 0, 1)) })
    .then(r => setTodos((r.data.items || []).filter(i => i.category === 'todo' && i.ref_type === 'manual'))).catch(() => {}), []); // eslint-disable-line
  const loadRecent = useCallback(() => salesApi.getSalesRecentOrders().then(r => setRecent(r.data.orders || [])).catch(() => {}), []);

  useEffect(() => { Promise.all([loadSummary(), loadTodos(), loadRecent()]).finally(() => setLoading(false)); }, [loadSummary, loadTodos, loadRecent]);
  useEffect(() => { loadMonth(); }, [loadMonth]);

  const refreshAll = () => { loadMonth(); loadSummary(); loadTodos(); };

  // Actions
  const toggleStatus = async (item) => {
    const status = item.status === 'done' ? 'pending' : 'done';
    try {
      await salesApi.setSalesTaskStatus({ ...refBody(item), status });
      refreshAll();
    } catch (e) {
      // Completing an unpaid/partial order needs a real payment record.
      if (e.response?.status === 409 && e.response?.data?.error === 'PAYMENT_REQUIRED') openPay(item);
    }
  };
  // Completing an unpaid/partial ORDER task opens the payment-collection dialog.
  const openPay = (item) => setPayFor(item);
  const handleComplete = (item) => {
    const payNeeded = item.status !== 'done' && item.ref_type === 'order' && (item.category === 'unpaid' || item.category === 'partial');
    if (payNeeded && !canCollect) return;   // executives can't record payment; button is disabled anyway
    if (payNeeded) openPay(item);
    else toggleStatus(item);
  };
  // The modal calls this; it throws on error so the modal shows it, and we
  // unmount + refresh on success.
  const submitPayment = async (payment) => {
    await salesApi.collectSalesTaskPayment({ ...refBody(payFor), payment });
    setPayFor(null);
    refreshAll();
  };
  const addComment = async (item, text) => { await salesApi.addSalesTaskComment({ ...refBody(item), comment: text }); refreshAll(); };
  const snooze = async (item) => { await salesApi.snoozeSalesTask(refBody(item)); refreshAll(); };
  const addTodo = async () => {
    if (!todoText.trim()) return;
    await salesApi.createSalesTask({ title: todoText.trim(), category: 'todo', due_date: selected });
    setTodoText(''); refreshAll();
  };
  const toggleTodo = async (t) => { await salesApi.setSalesTaskStatus({ task_id: t.id, status: t.status === 'done' ? 'pending' : 'done' }); refreshAll(); };
  const delTodo = async (t) => { await salesApi.deleteSalesTask(t.id); refreshAll(); };

  // Calendar cells
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
  const NA = summary?.needs_attention || {};

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner" /></div>;

  return (
    <div className="sd">
      <style>{sdStyles}</style>

      <div className="sd-top">
        <div>
          <h1>Sales Dashboard</h1>
          <p>Your payments to follow up, tasks, and conversations — all in one place.</p>
        </div>
        <div className="sd-today"><FiCalendar size={15} /> Today · <b>{today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</b></div>
      </div>

      {/* KPIs — no revenue */}
      <div className="sd-kpis">
        <Kpi color="#ef4444" icon={<FiClock />} value={K.due_today ?? 0} label="Due Today" />
        <Kpi color="#f59e0b" icon={<FiAlertTriangle />} value={K.overdue ?? 0} label="Overdue Follow-ups" />
        <Kpi color="#6366f1" icon={<FiCalendar />} value={K.due_this_week ?? 0} label="Due This Week" />
        <Kpi color="#22c55e" icon={<FiCheckCircle />} value={<>{K.tasks_done_today ?? 0}<small>/{K.tasks_assigned_today ?? 0}</small></>} label="Tasks Done Today" />
        <Kpi color="#a855f7" icon={<FiMessageSquare />} value={K.pending_chats ?? 0} label="Pending Chats" />
        <Kpi color="#84C225" icon={<FiShoppingBag />} value={K.active_orders ?? 0} label="Active Orders" />
      </div>

      {/* Needs attention */}
      <div className="sd-label">Needs Attention</div>
      <div className="sd-attn">
        <Attn color="#f59e0b" icon={<FiCreditCard />} n={NA.partial_to_collect ?? 0} t="Partial payments to collect" to="/orders" />
        <Attn color="#6366f1" icon={<FiCalendar />} n={NA.installments_due_today ?? 0} t="Installments due today" to="/orders" />
        <Attn color="#ef4444" icon={<FiAlertTriangle />} n={NA.unpaid_orders ?? 0} t="Unpaid orders to follow up" to="/orders" />
        <Attn color="#a855f7" icon={<FiMessageSquare />} n={NA.pending_chats ?? 0} t="Pending customer chats" to="/sales-chat" />
      </div>

      {/* Calendar + panel */}
      <div className="sd-grid">
        <section className="sd-card">
          <div className="sd-ch">
            <FiCalendar style={{ color: 'var(--accent)' }} />
            <div><h3>Payment Calendar</h3><div className="sub">Reminders for installments &amp; your follow-ups</div></div>
            <div className="sd-cnav">
              <button onClick={prevMonth} aria-label="Previous month"><FiChevronLeft size={16} /></button>
              <div className="mo">{new Date(viewY, viewM, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
              <button onClick={nextMonth} aria-label="Next month"><FiChevronRight size={16} /></button>
            </div>
          </div>
          <div className="sd-legend">
            {Object.entries(TYPES).map(([k, v]) => <span key={k}><i style={{ background: v.c }} />{v.label}</span>)}
          </div>
          <div className="sd-cal">
            <div className="sd-dow">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}</div>
            <div className="sd-days">
              {cells.map((c, idx) => {
                const dt = new Date(viewY, c.mo, c.d); const key = iso(dt);
                const evs = byDate[key] || [];
                const cls = ['sd-day', c.out ? 'out' : '', key === T ? 'today' : '', key === selected && !c.out ? 'sel' : ''].join(' ').trim();
                return (
                  <div key={idx} className={cls} onClick={() => !c.out && setSelected(key)}>
                    <div className="num">{c.d}{key === T && <span className="td">TODAY</span>}</div>
                    {evs.slice(0, 3).map(e => (
                      <div key={e.key} className={`ev ${e.status === 'done' ? 'done' : ''}`} title={e.title}>
                        <i style={{ background: TYPES[e.category]?.c || '#94a3b8' }} />{shortLabel(e)}
                      </div>
                    ))}
                    {evs.length > 3 && <div className="ev-more">+{evs.length - 3} more</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="sd-panel">
          <section className="sd-card">
            <div className="sd-ch">
              <FiCheckCircle style={{ color: '#5b8def' }} />
              <h3>Day Detail</h3>
              <div className="date">{new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
            </div>
            <div className="sd-remlist">
              {daySel.length === 0 ? (
                <div className="sd-empty"><FiCalendar size={30} /><div>No reminders on this day.</div><div className="s">Pick another date or add a task below.</div></div>
              ) : daySel.map(item => (
                <ReminderCard key={item.key} item={item} canCollect={canCollect} onToggle={() => handleComplete(item)} onSnooze={() => snooze(item)} onComment={(txt) => addComment(item, txt)} />
              ))}
            </div>
          </section>

          <section className="sd-card" style={{ marginTop: 16 }}>
            <div className="sd-ch">
              <FiCheckCircle style={{ color: '#a855f7' }} />
              <h3>My To-Do</h3>
              <div className="sub" style={{ marginLeft: 'auto' }}>{todos.filter(t => t.status !== 'done').length} open</div>
            </div>
            <div className="sd-todos">
              {todos.length === 0 && <div className="sd-empty" style={{ padding: 22 }}><div>No tasks yet. Add one below.</div></div>}
              {todos.map(t => (
                <div key={t.id} className={`sd-todo ${t.status === 'done' ? 'done' : ''}`}>
                  <button className="chk" onClick={() => toggleTodo(t)} aria-label="Toggle done">{t.status === 'done' && <FiCheckCircle size={13} />}</button>
                  <div className="tx">{t.title}<div className="dd">{t.due_date}</div></div>
                  <button className="del" onClick={() => delTodo(t)} aria-label="Delete"><FiTrash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="sd-todoadd">
              <input value={todoText} onChange={e => setTodoText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder={`Add a task on ${selected}…`} />
              <button className="sd-btn primary" onClick={addTodo}><FiPlus size={14} /> Add</button>
            </div>
          </section>
        </aside>
      </div>

      {/* Recent orders */}
      <div className="sd-label" style={{ marginTop: 26 }}>Recent Orders</div>
      <section className="sd-card">
        <div className="sd-tblwrap">
          <table className="sd-tbl">
            <thead><tr><th>Order</th><th>Student</th><th>Course</th><th>Amount</th><th>Status</th><th>Payment</th><th>Placed</th><th></th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 26 }}>No recent orders.</td></tr>}
              {recent.map(o => {
                const pay = o.has_installments ? ['inst', 'Installment'] : Number(o.amount_paid) <= 0 ? ['unpaid', 'Unpaid']
                  : Number(o.amount_remaining) > 0 ? ['partial', 'Partial'] : ['paid', 'Paid'];
                const st = o.status === 'completed' ? ['done', 'Completed'] : o.status === 'in_progress' ? ['prog', 'In progress']
                  : o.status === 'pending' ? ['pend', 'Pending'] : o.status === 'cancelled' ? ['pend', 'Cancelled'] : ['active', 'Active'];
                return (
                  <tr key={o.id}>
                    <td className="oc">{o.order_code || `#${o.id}`}</td>
                    <td className="mut">{o.username}</td>
                    <td>{o.course_name || o.subject_name || '—'}</td>
                    <td className="amt">{money(o.total_price)}</td>
                    <td><span className={`sd-pill ${st[0]}`}>{st[1]}</span></td>
                    <td><span className={`sd-pill ${pay[0]}`}>{pay[1]}</span></td>
                    <td className="mut">{o.created_at}</td>
                    <td style={{ textAlign: 'right' }}><Link className="sd-link" to={`/orders/${o.id}`}>Open →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payment-collection dialog — same modal the Orders page uses */}
      {payFor && (
        <PaymentCollectionModal
          title={`Record Payment — Order ${payFor.order_code || `#${payFor.order_id}`}`}
          subtitle={`${payFor.category === 'unpaid' ? 'Marking as Paid' : 'Collecting balance'}${payFor.student_name ? ` · ${payFor.student_name}` : ''}${payFor.amount != null ? ` · Balance ${money(payFor.amount)}` : ''}`}
          amountLabel="Amount collected"
          amount={payFor.amount ?? 0}
          maxAmount={payFor.amount ?? undefined}
          submitLabel="Record payment & complete"
          onSubmit={submitPayment}
          onClose={() => setPayFor(null)}
        />
      )}
    </div>
  );
}

function Kpi({ color, icon, value, label }) {
  return (
    <div className="sd-kpi">
      <div className="ic" style={{ background: color + '24', color }}>{icon}</div>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}
function Attn({ color, icon, n, t, to }) {
  return (
    <Link to={to} className="sd-attncard" style={{ borderLeftColor: color }}>
      <div className="ic" style={{ background: color + '24', color }}>{icon}</div>
      <div><div className="n">{n}</div><div className="t">{t}</div></div>
      <div className="arr">→</div>
    </Link>
  );
}

function ReminderCard({ item, canCollect, onToggle, onSnooze, onComment }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const t = TYPES[item.category] || { c: '#94a3b8', label: item.category };
  const done = item.status === 'done';
  const payNeeded = item.ref_type === 'order' && (item.category === 'unpaid' || item.category === 'partial');
  const locked = payNeeded && !done && !canCollect;   // executive can't record the payment
  const submit = (e) => { e.preventDefault(); if (text.trim()) { onComment(text.trim()); setText(''); setOpen(false); } };
  return (
    <div className={`sd-rem ${done ? 'done' : ''}`}>
      <div className="rtop">
        <button className="chk" onClick={locked ? undefined : onToggle} disabled={locked} aria-label="Mark done" title={locked ? 'Only a Sales Lead or Admin can record payment' : undefined}>{done && <FiCheckCircle size={13} />}</button>
        <div className="rbody">
          <div className="rtitle">{item.title}<span className="tag" style={{ background: t.c + '28', color: t.c }}>{t.label}</span>
            {item.general && <span className="tag" style={{ background: '#a855f728', color: '#c084fc' }}>Team</span>}
            {item.assigned && <span className="tag" style={{ background: '#3b82f628', color: '#60a5fa' }}>Assigned</span>}
            {item.overdue && <span className="tag" style={{ background: '#ef444428', color: '#f87171' }}>Overdue</span>}
          </div>
          <div className="rmeta">
            {item.student_name && <span><FiUser size={11} /> <b>{item.student_name}</b></span>}
            {item.amount != null && <span><FiCreditCard size={11} /> <b>{money(item.amount)}</b></span>}
          </div>
          {item.comments?.length > 0 && (
            <div className="rcmts">
              {item.comments.map(c => <div key={c.id} className="rcmt"><b>{c.author_name || 'You'}:</b> {c.comment}</div>)}
            </div>
          )}
          <div className="ractions">
            {locked ? (
              <button className="sd-btn" disabled title="Only a Sales Lead or Admin can record payment">🔒 Lead/Admin marks paid</button>
            ) : (
              <button className="sd-btn" onClick={onToggle}>{done ? '↺ Reopen' : (payNeeded ? '💳 Collect payment' : '✓ Mark done')}</button>
            )}
            <button className="sd-btn" onClick={() => setOpen(o => !o)}><FiMessageSquare size={13} /> Comment</button>
            {!done && <button className="sd-btn" onClick={onSnooze}><FiClock size={13} /> Snooze +1d</button>}
          </div>
          {open && (
            <form className="rcmtform" onSubmit={submit}>
              <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment…" />
              <button className="sd-btn primary" type="submit"><FiSend size={12} /></button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const sdStyles = `
.sd h1{font-size:24px;font-weight:800;margin:0;letter-spacing:-.3px;color:var(--text-primary)}
.sd .sd-top{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px;flex-wrap:wrap}
.sd .sd-top p{margin:4px 0 0;color:var(--text-secondary)}
.sd .sd-today{margin-left:auto;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:9px 13px;font-size:12.5px;color:var(--text-secondary);display:flex;gap:8px;align-items:center}
.sd .sd-today b{color:var(--text-primary)}
.sd-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:20px}
.sd-kpi{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:15px 16px}
.sd-kpi .ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;margin-bottom:10px}
.sd-kpi .v{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1;color:var(--text-primary)}
.sd-kpi .v small{color:var(--text-muted);font-weight:700;font-size:15px}
.sd-kpi .l{font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-top:6px;font-weight:600}
.sd-label{font-size:11px;font-weight:800;letter-spacing:1.2px;color:var(--text-muted);text-transform:uppercase;margin:4px 0 12px}
.sd-attn{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:26px}
.sd-attncard{display:flex;gap:13px;align-items:center;text-decoration:none;color:inherit;background:var(--bg-card);border:1px solid var(--border);border-left-width:3px;border-radius:12px;padding:15px 16px;transition:.15s}
.sd-attncard:hover{transform:translateY(-2px);border-color:var(--border-light)}
.sd-attncard .ic{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:0 0 auto}
.sd-attncard .n{font-size:20px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:var(--text-primary)}
.sd-attncard .t{font-size:12.5px;color:var(--text-secondary);margin-top:3px}
.sd-attncard .arr{margin-left:auto;color:var(--text-muted)}
.sd-grid{display:grid;grid-template-columns:1.7fr 1fr;gap:18px;align-items:start}
.sd-card{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
.sd-ch{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border)}
.sd-ch h3{margin:0;font-size:15px;font-weight:800;color:var(--text-primary)}
.sd-ch .sub{font-size:12px;color:var(--text-secondary)}
.sd-ch .date{font-size:12px;color:var(--text-secondary);margin-left:auto;font-weight:700}
.sd-cnav{display:flex;align-items:center;gap:8px;margin-left:auto}
.sd-cnav button{width:32px;height:32px;border-radius:9px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-secondary);cursor:pointer;display:grid;place-items:center}
.sd-cnav button:hover{color:var(--text-primary);border-color:var(--border-light)}
.sd-cnav .mo{min-width:130px;text-align:center;font-weight:700;font-size:14px;color:var(--text-primary);font-variant-numeric:tabular-nums}
.sd-legend{display:flex;flex-wrap:wrap;gap:14px;padding:12px 18px;border-bottom:1px solid var(--border)}
.sd-legend span{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--text-secondary);font-weight:600}
.sd-legend i{width:9px;height:9px;border-radius:3px;display:inline-block}
.sd-cal{padding:14px 16px 18px}
.sd-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px}
.sd-dow div{text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.5px;text-transform:uppercase}
.sd-days{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.sd-day{min-height:94px;border:1px solid var(--border);border-radius:11px;background:var(--bg-input);padding:7px;cursor:pointer;display:flex;flex-direction:column;gap:5px;transition:.12s}
.sd-day:hover{border-color:var(--border-light);background:var(--bg-card-hover)}
.sd-day.out{opacity:.32;cursor:default}
.sd-day.today{border-color:var(--accent);box-shadow:inset 0 0 0 1px rgba(132,194,37,.4)}
.sd-day.sel{border-color:#5b8def;box-shadow:0 0 0 2px rgba(91,141,239,.35)}
.sd-day .num{font-size:12.5px;font-weight:700;color:var(--text-secondary);font-variant-numeric:tabular-nums;display:flex;justify-content:space-between;align-items:center}
.sd-day.today .num{color:var(--accent)}
.sd-day .num .td{font-size:9px;background:var(--accent);color:#0a1628;border-radius:5px;padding:1px 5px;font-weight:800}
.sd-day .ev{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:3px 6px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(255,255,255,.05);color:var(--text-primary)}
.sd-day .ev i{width:6px;height:6px;border-radius:50%;flex:0 0 auto}
.sd-day .ev.done{opacity:.5;text-decoration:line-through}
.sd-day .ev-more{font-size:10.5px;color:var(--text-muted);font-weight:700;padding-left:6px}
.sd-remlist{padding:10px 12px 12px;display:flex;flex-direction:column;gap:9px;max-height:420px;overflow:auto}
.sd-rem{border:1px solid var(--border);border-radius:11px;padding:11px 12px;background:var(--bg-input)}
.sd-rem .rtop{display:flex;gap:11px;align-items:flex-start}
.sd-rem .chk,.sd-todo .chk{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border-light);background:transparent;cursor:pointer;flex:0 0 auto;display:grid;place-items:center;margin-top:1px;color:#0a1628}
.sd-rem.done .chk,.sd-todo.done .chk{background:#22c55e;border-color:#22c55e}
.sd-rem.done .rtitle{text-decoration:line-through;color:var(--text-muted)}
.sd-rem .rbody{flex:1;min-width:0}
.sd-rem .rtitle{font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--text-primary)}
.sd-rem .tag{font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:2px 7px;border-radius:6px}
.sd-rem .rmeta{font-size:12px;color:var(--text-secondary);margin-top:5px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.sd-rem .rmeta b{color:var(--text-primary);font-weight:700}
.sd-rem .rcmts{margin-top:9px;display:flex;flex-direction:column;gap:6px}
.sd-rem .rcmt{font-size:12px;color:var(--text-secondary);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 9px;border-left:2px solid #a855f7}
.sd-rem .rcmt b{color:var(--text-primary)}
.sd-rem .ractions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}
.sd-btn{font:inherit;font-size:11.5px;font-weight:700;border-radius:8px;padding:6px 10px;cursor:pointer;border:1px solid var(--border-light);background:var(--bg-card);color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px}
.sd-btn:hover{color:var(--text-primary);border-color:var(--accent)}
.sd-btn.primary{background:var(--accent);color:#0a1628;border:none}
.sd-btn:disabled{opacity:.55;cursor:not-allowed}
.sd-rem .chk:disabled{opacity:.45;cursor:not-allowed}
.sd-rem .rcmtform{display:flex;gap:7px;margin-top:8px}
.sd-rem .rcmtform input{flex:1;background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text-primary);font:inherit;font-size:12.5px;outline:none}
.sd-empty{padding:34px 20px;text-align:center;color:var(--text-muted)}
.sd-empty .s{font-size:12px;margin-top:4px}
.sd-todos{padding:8px 12px 4px;display:flex;flex-direction:column;gap:7px;max-height:260px;overflow:auto}
.sd-todo{display:flex;align-items:center;gap:11px;padding:9px 11px;border:1px solid var(--border);border-radius:10px;background:var(--bg-input)}
.sd-todo.done .tx{text-decoration:line-through;color:var(--text-muted)}
.sd-todo .tx{flex:1;font-size:13px;font-weight:600;color:var(--text-primary)}
.sd-todo .tx .dd{font-size:10.5px;color:var(--text-muted);font-weight:600;margin-top:2px}
.sd-todo .del{color:var(--text-muted);cursor:pointer;background:none;border:none;padding:4px;display:grid;place-items:center}
.sd-todo .del:hover{color:#ef4444}
.sd-todoadd{display:flex;gap:8px;padding:10px 12px 14px}
.sd-todoadd input{flex:1;background:var(--bg-dark);border:1px solid var(--border);border-radius:9px;padding:9px 11px;color:var(--text-primary);font:inherit;outline:none}
.sd-todoadd input:focus{border-color:var(--accent)}
.sd-tblwrap{overflow-x:auto}
.sd-tbl{width:100%;border-collapse:collapse;min-width:720px}
.sd-tbl th{text-align:left;font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--text-muted);font-weight:700;padding:12px 16px;border-bottom:1px solid var(--border)}
.sd-tbl td{padding:13px 16px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text-primary)}
.sd-tbl tr:last-child td{border-bottom:none}
.sd-tbl tbody tr:hover{background:var(--bg-card-hover)}
.sd-tbl .oc{font-weight:700;font-variant-numeric:tabular-nums}
.sd-tbl .mut{color:var(--text-secondary)}
.sd-tbl .amt{font-variant-numeric:tabular-nums;font-weight:700}
.sd-pill{font-size:10.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;padding:3px 9px;border-radius:999px;white-space:nowrap}
.sd-pill.active{background:rgba(59,130,246,.16);color:#60a5fa}
.sd-pill.prog{background:rgba(132,194,37,.16);color:#a3e635}
.sd-pill.pend{background:rgba(245,158,11,.16);color:#fbbf24}
.sd-pill.done{background:rgba(148,163,184,.18);color:#cbd5e1}
.sd-pill.paid{background:rgba(34,197,94,.16);color:#4ade80}
.sd-pill.partial{background:rgba(245,158,11,.16);color:#fbbf24}
.sd-pill.unpaid{background:rgba(239,68,68,.16);color:#f87171}
.sd-pill.inst{background:rgba(99,102,241,.16);color:#818cf8}
.sd-link{color:var(--text-secondary);text-decoration:none;font-weight:700;font-size:12.5px}
.sd-link:hover{color:var(--accent)}
@media(max-width:1180px){.sd-kpis{grid-template-columns:repeat(3,1fr)}.sd-attn{grid-template-columns:repeat(2,1fr)}.sd-grid{grid-template-columns:1fr}}
`;
