import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiMessageCircle, FiAlertTriangle, FiEye } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { connectSocket } from '../services/socket';
import { getUnreadPerOrder } from '../services/api';

export default function ChatMonitor() {
  const [chats, setChats] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const { getAllChats, getFlaggedMessages } = useApi();
  const { token } = useAuth();

  const playSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 600;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => ctx.close(), 600);
    } catch (e) {}
  }, []);

  useEffect(() => {
    Promise.all([
      getAllChats(),
      getFlaggedMessages(),
      getUnreadPerOrder().catch(() => ({ data: {} }))
    ]).then(([c, f, u]) => {
      setChats(c.data); setFlagged(f.data); setUnreadMap(u.data || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Live notifications: flagged messages + new chat messages
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    const handleFlagged = (msg) => {
      setFlagged(prev => [msg, ...prev]);
      playSound();
    };

    const handleChatNotif = (data) => {
      setUnreadMap(prev => ({ ...prev, [data.order_id]: (prev[data.order_id] || 0) + 1 }));
    };

    socket.on('flaggedMessage', handleFlagged);
    socket.on('chatNotification', handleChatNotif);
    return () => {
      socket.off('flaggedMessage', handleFlagged);
      socket.off('chatNotification', handleChatNotif);
    };
  }, [token, playSound]);

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
              {chats.map(c => {
                const unread = unreadMap[c.order_id] || 0;
                const hasFlag = c.flagged_count > 0;
                return (
                  <tr key={c.order_id} style={{
                    ...(hasFlag ? { background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid var(--error)' } : {}),
                    ...(unread > 0 && !hasFlag ? { background: 'rgba(99, 102, 241, 0.08)', borderLeft: '3px solid var(--accent)' } : {})
                  }}>
                    <td>
                      <span style={{ fontWeight: unread > 0 ? 700 : 400 }}>#{c.order_id}</span>
                      {unread > 0 && (
                        <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700, marginLeft: 8 }}>{unread} new</span>
                      )}
                    </td>
                    <td>{c.username}</td>
                    <td>{c.course_name}</td>
                    <td style={{ fontWeight: 600 }}>{c.message_count}</td>
                    <td>{hasFlag ? <span style={{ color: 'var(--error)', fontWeight: 600 }}>{c.flagged_count}</span> : '0'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '—'}</td>
                    <td><Link to={`/chats/${c.order_id}`} className="btn btn-sm btn-outline" onClick={() => setUnreadMap(prev => { const next = { ...prev }; delete next[c.order_id]; return next; })}><FiEye size={14} /></Link></td>
                  </tr>
                );
              })}
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
