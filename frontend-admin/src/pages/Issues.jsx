import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiEye, FiMessageSquare, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

const PER_PAGE = 100;

export default function Issues() {
  const { getAllIssues } = useApi();
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = (p = page) => {
    setLoading(true);
    getAllIssues({ status: status || undefined, search: search || undefined, page: p, limit: PER_PAGE })
      .then(r => { setIssues(r.data.issues || []); setTotal(r.data.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="page-header">
        <h2>Escalation</h2>
        <p>Support tickets from students</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['', 'All'], ['open', 'Open'], ['closed', 'Closed']].map(([v, label]) => (
          <button key={v || 'all'} className={`btn btn-sm ${status === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setStatus(v); setPage(1); }}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" placeholder="Search issues..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && (page === 1 ? load(1) : setPage(1))} style={{ maxWidth: 300 }} />
        <button className="btn btn-secondary" onClick={() => (page === 1 ? load(1) : setPage(1))}><FiSearch size={16} /></button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ padding: 40 }}><div className="loading-spinner" /></div>
      ) : issues.length === 0 ? (
        <div className="card text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No issues to show.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>ID</th><th>Subject</th><th>User</th><th>Category</th><th>Status</th><th>Last activity</th><th>Actions</th></tr></thead>
            <tbody>
              {issues.map(i => {
                const lastByUser = i.last_message_role === 'user';
                return (
                  <tr key={i.id}>
                    <td>#{i.id}</td>
                    <td style={{ fontWeight: 500 }}>{i.subject}</td>
                    <td>{i.user_name}</td>
                    <td>{i.category}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.3,
                        background: i.status === 'open' ? 'rgba(34,197,94,0.12)' : 'rgba(127,127,127,0.12)',
                        color: i.status === 'open' ? '#16a34a' : 'var(--text-muted)'
                      }}>{i.status}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <div>{new Date(i.last_message_at || i.created_at).toLocaleString()}</div>
                      {i.last_message_role && (
                        <div style={{ marginTop: 2, color: lastByUser ? '#d97706' : 'var(--text-muted)' }}>
                          <FiMessageSquare size={10} style={{ verticalAlign: 'middle' }} /> Last: {lastByUser ? 'User' : (i.last_message_role.replace('_', ' '))}
                        </div>
                      )}
                    </td>
                    <td>
                      <Link to={`/issues/${i.id}`} className="btn btn-sm btn-outline"><FiEye size={13} /></Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total > PER_PAGE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '14px 4px 2px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {pages} · {total} tickets</span>
              <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><FiChevronLeft size={16} /></button>
              <button className="btn btn-sm btn-secondary" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}><FiChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
