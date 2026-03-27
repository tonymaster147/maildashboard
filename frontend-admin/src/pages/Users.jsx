import { useState, useEffect } from 'react';
import { getAllUsers, toggleUserStatus } from '../services/api';
import { FiSearch, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchUsers = (s = '') => {
    setLoading(true);
    getAllUsers({ search: s }).then(res => { setUsers(res.data.users); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(search);
  };

  const handleToggle = async (id, currentStatus) => {
    await toggleUserStatus(id, { is_active: !currentStatus });
    fetchUsers(search);
  };

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
            <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td style={{ fontWeight: 500 }}>{u.username}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.email || '—'}</td>
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
        </div>
      )}
    </div>
  );
}
