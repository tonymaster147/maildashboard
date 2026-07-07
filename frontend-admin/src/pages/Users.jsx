import { useState, useEffect } from 'react';
import { toggleUserStatus } from '../services/api';
import { FiSearch, FiToggleLeft, FiToggleRight, FiEye, FiEyeOff, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

const PER_PAGE = 100;

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');   // the applied search term
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const { getAllUsers } = useApi();

  useEffect(() => {
    setLoading(true);
    getAllUsers({ search: applied || undefined, page, limit: PER_PAGE })
      .then(res => { setUsers(res.data.users); setTotal(res.data.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [applied, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(search);
  };

  const handleToggle = async (id, currentStatus) => {
    await toggleUserStatus(id, { is_active: !currentStatus });
    getAllUsers({ search: applied || undefined, page, limit: PER_PAGE })
      .then(res => { setUsers(res.data.users); setTotal(res.data.total || 0); }).catch(() => {});
  };

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="page-header"><h2>User Management</h2><p>Manage platform users</p></div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input className="form-input" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <button className="btn btn-secondary"><FiSearch size={16} /></button>
      </form>
      {loading ? <div className="flex-center"><div className="loading-spinner"></div></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>ID</th><th>Username</th><th>Name</th><th>Access Code</th><th>Email</th><th>Phone</th><th>Country</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td style={{ fontWeight: 500 }}>{u.username}</td>
                  <td>{u.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <AccessCodeCell code={u.access_code} />
                  <td style={{ color: 'var(--text-muted)' }}>{u.email || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.country || '—'}</td>
                  <td><span className={`badge-status ${u.is_active ? 'badge-active' : 'badge-cancelled'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleToggle(u.id, u.is_active)}>
                      {u.is_active ? <FiToggleRight size={16} color="var(--success)" /> : <FiToggleLeft size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > PER_PAGE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '14px 4px 2px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Page {page} of {pages} · {total} users
              </span>
              <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <FiChevronLeft size={16} />
              </button>
              <button className="btn btn-sm btn-secondary" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                <FiChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Access code cell — masked by default, click the eye to reveal. Shows "—"
// for users created before the access code was stored in recoverable form.
function AccessCodeCell({ code }) {
  const [show, setShow] = useState(false);
  if (!code) {
    return <td style={{ color: 'var(--text-muted)' }} title="Not available — set before codes were viewable">—</td>;
  }
  return (
    <td>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, letterSpacing: 0.5 }}>
          {show ? code : '•'.repeat(Math.min(code.length, 8))}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => setShow(s => !s)}
          title={show ? 'Hide access code' : 'Show access code'}
          style={{ padding: '2px 7px' }}
        >
          {show ? <FiEyeOff size={14} /> : <FiEye size={14} />}
        </button>
      </div>
    </td>
  );
}
