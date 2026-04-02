import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiMessageCircle, FiAlertTriangle, FiEye } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

export default function ChatMonitor() {
  const [chats, setChats] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const { getAllChats, getFlaggedMessages } = useApi();

  useEffect(() => {
    Promise.all([getAllChats(), getFlaggedMessages()]).then(([c, f]) => {
      setChats(c.data); setFlagged(f.data); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header"><h2>Chat Monitor</h2><p>View all conversations and flagged messages</p></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className={`btn btn-sm ${tab === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('all')}><FiMessageCircle size={14} /> All Chats ({chats.length})</button>
        <button className={`btn btn-sm ${tab === 'flagged' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('flagged')}><FiAlertTriangle size={14} /> Flagged ({flagged.length})</button>
      </div>

      {tab === 'all' && (
        <div className="table-container">
          <table>
            <thead><tr><th>Order</th><th>User</th><th>Course</th><th>Messages</th><th>Flagged</th><th>Last Message</th><th>Action</th></tr></thead>
            <tbody>
              {chats.map(c => (
                <tr key={c.order_id}>
                  <td>#{c.order_id}</td>
                  <td>{c.username}</td>
                  <td>{c.course_name}</td>
                  <td style={{ fontWeight: 600 }}>{c.message_count}</td>
                  <td>{c.flagged_count > 0 ? <span style={{ color: 'var(--error)', fontWeight: 600 }}>{c.flagged_count}</span> : '0'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '—'}</td>
                  <td><Link to={`/chats/${c.order_id}`} className="btn btn-sm btn-outline"><FiEye size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'flagged' && (
        <div className="table-container">
          <table>
            <thead><tr><th>Order</th><th>Sender</th><th>Role</th><th>Message</th><th>Reason</th><th>Date</th></tr></thead>
            <tbody>
              {flagged.map(m => (
                <tr key={m.id}>
                  <td>#{m.order_id}</td>
                  <td>{m.sender_name}</td>
                  <td><span className={`badge-status badge-${m.sender_role === 'tutor' ? 'active' : 'pending'}`}>{m.sender_role}</span></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message}</td>
                  <td style={{ color: 'var(--warning)', fontSize: 13 }}>{m.flag_reason}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
