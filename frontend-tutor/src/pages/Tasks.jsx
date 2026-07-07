import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTasks, getPublicStatuses } from '../services/api';
import { FiEye, FiMessageSquare, FiClock, FiCheckCircle, FiTrendingUp, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const PER_PAGE = 100;

const TUTOR_BADGE_STYLE = (code) => ({
  padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
  background: code === 'completed' ? 'rgba(34,197,94,0.12)' : code === 'work_stopped' ? 'rgba(245,158,11,0.12)' : code === 'in_progress' ? 'rgba(59,130,246,0.12)' : 'rgba(127,127,127,0.12)',
  color:      code === 'completed' ? '#16a34a'             : code === 'work_stopped' ? '#d97706'             : code === 'in_progress' ? '#2563eb'             : 'var(--text-muted)',
  border: '1px solid currentColor'
});

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');           // tutor_status_code
  const [tutorStatuses, setTutorStatuses] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: PER_PAGE };
    if (filter) params.tutor_status_code = filter;
    getTasks(params)
      .then(res => { setTasks(res.data.tasks || []); setTotal(res.data.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter, page]);
  useEffect(() => { getPublicStatuses('tutor').then(res => setTutorStatuses((res.data.statuses || []).filter(s => s.is_active))).catch(() => {}); }, []);

  const active = tasks.filter(t => t.tutor_status_code === 'in_progress').length;
  const completed = tasks.filter(t => t.tutor_status_code === 'completed').length;

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const paged = tasks;

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header"><h2>My Tasks</h2><p>View and manage your assigned tasks</p></div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--info)' }}><FiTrendingUp /></div>
          <div className="stat-value">{total}</div>
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button key="all" className={`btn btn-sm ${filter === '' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilter(''); setPage(1); }}>All</button>
        {tutorStatuses.map(s => (
          <button key={s.code} className={`btn btn-sm ${filter === s.code ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilter(s.code); setPage(1); }}>{s.name}</button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 40px' }}><div style={{ fontSize: 48, marginBottom: 16 }}>📋</div><h3>No tasks assigned</h3><p style={{ color: 'var(--text-secondary)' }}>New tasks will appear here when assigned by admin</p></div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead><tr><th>Order</th><th>Course</th><th>Type</th><th>Subject</th><th>User</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.map(t => (
                  <tr key={t.id}>
                    <td>{t.order_code || `#${t.id}`}</td>
                    <td style={{ fontWeight: 500 }}>{t.course_name}</td>
                    <td>{t.order_type_name}</td>
                    <td>{t.subject_name}</td>
                    <td>{t.username}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.num_weeks} weeks</td>
                    <td>
                      {t.tutor_status_code
                        ? <span style={TUTOR_BADGE_STYLE(t.tutor_status_code)}>{t.tutor_status_name}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Link to={`/tasks/${t.id}`} className="btn btn-sm btn-outline"><FiEye size={12} /></Link>
                        {!!t.chat_enabled && <Link to={`/chat/${t.id}`} className="btn btn-sm btn-secondary"><FiMessageSquare size={12} /></Link>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
              <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <FiChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages} <span style={{ color: 'var(--text-muted)' }}>({total} tasks)</span>
              </span>
              <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <FiChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
