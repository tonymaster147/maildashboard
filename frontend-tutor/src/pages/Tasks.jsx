import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTasks } from '../services/api';
import { FiEye, FiMessageSquare, FiClock, FiCheckCircle, FiTrendingUp } from 'react-icons/fi';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getTasks(filter).then(res => { setTasks(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [filter]);

  const active = tasks.filter(t => ['active', 'in_progress'].includes(t.status)).length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header"><h2>My Tasks</h2><p>View and manage your assigned tasks</p></div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--info)' }}><FiTrendingUp /></div>
          <div className="stat-value">{tasks.length}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}><FiClock /></div>
          <div className="stat-value">{active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}><FiCheckCircle /></div>
          <div className="stat-value">{completed}</div>
          <div className="stat-label">Completed</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['', 'active', 'in_progress', 'completed'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>{s || 'All'}</button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 40px' }}><div style={{ fontSize: 48, marginBottom: 16 }}>📋</div><h3>No tasks assigned</h3><p style={{ color: 'var(--text-secondary)' }}>New tasks will appear here when assigned by admin</p></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Order</th><th>Course</th><th>Type</th><th>Subject</th><th>User</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td>#{t.id}</td>
                  <td style={{ fontWeight: 500 }}>{t.course_name}</td>
                  <td>{t.order_type_name}</td>
                  <td>{t.subject_name}</td>
                  <td>{t.username}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.num_weeks} weeks</td>
                  <td><span className={`badge-status badge-${t.status}`}>{t.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Link to={`/tasks/${t.id}`} className="btn btn-sm btn-outline"><FiEye size={12} /></Link>
                      {t.chat_enabled && <Link to={`/chat/${t.id}`} className="btn btn-sm btn-secondary"><FiMessageSquare size={12} /></Link>}
                    </div>
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
