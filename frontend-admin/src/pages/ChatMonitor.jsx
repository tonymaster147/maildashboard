import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiMessageCircle, FiAlertTriangle, FiEye } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { connectSocket } from '../services/socket';
import { getUnreadPerOrder } from '../services/api';

const PER_PAGE = 100;

export default function ChatMonitor() {
  const [chats, setChats] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const sentinelRef = useRef(null);
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
      getAllChats({ page: 1, limit: PER_PAGE }),
      getFlaggedMessages(),
      getUnreadPerOrder().catch(() => ({ data: {} }))
    ]).then(([c, f, u]) => {
      // Orders with unread student messages first (stable sort). Only the first
      // page is float-sorted; later pages append in server order (newest-first)
      // so rows don't jump around as you scroll.
      const umap = u.data || {};
      const first = c.data.chats || [];
      const sorted = [...first].sort((a, b) => ((umap[b.order_id] || 0) > 0 ? 1 : 0) - ((umap[a.order_id] || 0) > 0 ? 1 : 0));
      setChats(sorted); setFlagged(f.data); setUnreadMap(umap);
      pageRef.current = 1;
      hasMoreRef.current = !!c.data.hasMore;
      setHasMore(!!c.data.hasMore);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    getAllChats({ page: next, limit: PER_PAGE })
      .then(c => {
        const rows = c.data.chats || [];
        setChats(prev => {
          const seen = new Set(prev.map(x => x.order_id));
          return [...prev, ...rows.filter(x => !seen.has(x.order_id))];
        });
        pageRef.current = next;
        hasMoreRef.current = !!c.data.hasMore;
        setHasMore(!!c.data.hasMore);
      })
      .catch(() => {})
      .finally(() => { loadingMoreRef.current = false; setLoadingMore(false); });
  }, [getAllChats]);

  // Infinite scroll down — observe a sentinel below the table.
  useEffect(() => {
    if (tab !== 'all') return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [tab, loadMore]);

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
        <button className={`btn btn-sm ${tab === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('all')}><FiMessageCircle size={14} /> All Chats ({chats.length}{hasMore ? '+' : ''})</button>
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
                      <span style={{ fontWeight: unread > 0 ? 700 : 400 }}>{c.order_code || `#${c.order_id}`}</span>
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
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2, display: 'inline-block' }} />
            </div>
          )}
          {!hasMore && chats.length > 0 && (
            <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>End of conversations</div>
          )}
        </div>
      )}

      {tab === 'flagged' && (
        <div className="table-container">
          <table>
            <thead><tr><th>Order</th><th>Sender</th><th>Role</th><th>Message</th><th>Reason</th><th>Date</th></tr></thead>
            <tbody>
              {flagged.map(m => (
                <tr key={m.id}>
                  <td>{m.order_code || `#${m.order_id}`}</td>
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
