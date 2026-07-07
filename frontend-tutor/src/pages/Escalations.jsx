import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { getEscalations } from '../services/api';

const PER_PAGE = 100;

// Support tickets escalated to this tutor. Shared 3-way thread with the
// student and admin/sales; the tutor can view and reply.
export default function Escalations() {
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    getEscalations({ status: status || undefined, page, limit: PER_PAGE })
      .then(r => { setIssues(r.data.issues || []); setTotal(r.data.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status, page]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>Escalation</h2>
        <p style={{ color: 'var(--text-muted)' }}>Support tickets escalated to you</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'open', 'closed'].map(s => (
          <button key={s || 'all'} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setStatus(s); setPage(1); }}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '40vh' }}><div className="loading-spinner" /></div>
      ) : issues.length === 0 ? (
        <div className="card text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>
          <FiAlertCircle size={28} style={{ marginBottom: 8 }} />
          <p>No escalations assigned to you.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {issues.map(i => (
            <Link key={i.id} to={`/escalations/${i.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    #{i.id} — {i.subject}
                    {Number(i.unread) > 0 && <span style={{ marginLeft: 8, background: 'var(--error)', color: '#fff', fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>NEW</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    From {i.user_name}{i.order_code ? ` • Order ${i.order_code}` : ''} • {new Date(i.last_message_at || i.created_at).toLocaleString()}
                  </div>
                  {i.last_message && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.last_message}</div>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, textTransform: 'uppercase', background: i.status === 'closed' ? 'rgba(127,127,127,0.12)' : 'rgba(34,197,94,0.12)', color: i.status === 'closed' ? 'var(--text-muted)' : '#16a34a' }}>{i.status}</span>
              </div>
            </Link>
          ))}
          {total > PER_PAGE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
              <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <FiChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Page {page} of {pages} <span style={{ color: 'var(--text-muted)' }}>({total})</span>
              </span>
              <button className="btn btn-sm btn-secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                Next <FiChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
