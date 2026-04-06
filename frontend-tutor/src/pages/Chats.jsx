import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTasks, getUnreadPerOrder, markAllRead } from '../services/api';
import { getSocket } from '../services/socket';
import { FiMessageSquare } from 'react-icons/fi';

export default function Chats() {
  const [tasks, setTasks] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTasks(),
      getUnreadPerOrder()
    ]).then(([tasksRes, unreadRes]) => {
      const chatTasks = tasksRes.data.filter(t => t.status === 'active' || t.status === 'in_progress');
      setTasks(chatTasks);
      setUnreadMap(unreadRes.data || {});
      setLoading(false);
      // Mark all as read AFTER we've captured the unread counts for display
      markAllRead().catch(() => {});
    }).catch(() => setLoading(false));
  }, []);

  // Real-time: update per-order unread when chatNotification arrives
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data) => {
      setUnreadMap(prev => ({ ...prev, [data.order_id]: (prev[data.order_id] || 0) + 1 }));
    };
    socket.on('chatNotification', handler);
    return () => socket.off('chatNotification', handler);
  }, []);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>💬 Chats</h2>
        <p className="subtitle">Message students about your assigned tasks</p>
      </div>

      {tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <p style={{ color: 'var(--text-muted)' }}>No active tasks with chat available yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {tasks.map(task => {
            const unread = unreadMap[task.id] || 0;
            const hasUnread = unread > 0;

            return (
              <Link to={`/chat/${task.id}`} key={task.id} className="card"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', textDecoration: 'none', color: 'inherit',
                  transition: 'all 0.2s', cursor: 'pointer',
                  background: hasUnread ? 'rgba(99, 102, 241, 0.06)' : undefined,
                  borderLeft: hasUnread ? '3px solid #6366f1' : '3px solid transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = hasUnread ? '#6366f1' : 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = hasUnread ? '#6366f1' : 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    background: hasUnread ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '50%', width: 42, height: 42,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                  }}>
                    <FiMessageSquare size={20} style={{ color: 'var(--accent)' }} />
                    {hasUnread && (
                      <span style={{
                        position: 'absolute', top: -4, right: -4,
                        background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 700,
                        borderRadius: '50%', width: 20, height: 20,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'pulse 2s infinite', border: '2px solid #fff'
                      }}>{unread}</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: hasUnread ? 700 : 600, fontSize: 15, color: 'var(--text-primary)' }}>
                      Order #{task.id} — {task.course_name}
                      {hasUnread && <span style={{ fontSize: 11, color: '#6366f1', marginLeft: 8 }}>New message</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                      {task.subject_name || 'N/A'} • <span style={{ textTransform: 'capitalize' }}>{task.status}</span>
                    </div>
                  </div>
                </div>
                <div className="btn btn-sm btn-primary" style={{ pointerEvents: 'none' }}>Open Chat</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
