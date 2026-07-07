import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getChatMessages, getOrderCode } from '../services/api';
import { FiArrowLeft } from 'react-icons/fi';
import { AttachmentBubble } from '../components/ChatAttachment';

export default function ChatView() {
  const { orderId } = useParams();
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderCode, setOrderCode] = useState(null);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const restoreDistRef = useRef(null);
  const loadingOlderRef = useRef(false);

  useEffect(() => {
    getChatMessages(orderId, { channel: 'all', limit: 100 })
      .then(res => { setMessages(res.data.messages || []); setHasMore(!!res.data.hasMore); setLoading(false); })
      .catch(() => setLoading(false));
  }, [orderId]);
  useEffect(() => { getOrderCode(orderId).then(r => setOrderCode(r.data.order_code)).catch(() => {}); }, [orderId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreDistRef.current != null) {
      el.scrollTop = el.scrollHeight - restoreDistRef.current;
      restoreDistRef.current = null;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const loadOlder = async () => {
    if (loadingOlderRef.current || !hasMore || messages.length === 0) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = scrollRef.current;
    restoreDistRef.current = el ? el.scrollHeight - el.scrollTop : null;
    try {
      const res = await getChatMessages(orderId, { channel: 'all', before: messages[0].id, limit: 100 });
      const older = res.data.messages || [];
      setHasMore(!!res.data.hasMore);
      if (older.length === 0) restoreDistRef.current = null;
      setMessages(prev => {
        const seen = new Set(prev.map(m => m.id));
        return [...older.filter(m => !seen.has(m.id)), ...prev];
      });
    } catch {
      restoreDistRef.current = null;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop <= 60) loadOlder();
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/chats" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <h2>Chat - Order {orderCode || `#${orderId}`}</h2>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{messages.length}{hasMore ? '+' : ''} messages</span>
      </div>
      <div className="chat-container" style={{ height: 'calc(100vh - 180px)' }}>
        <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
          {loadingOlder && <div style={{ textAlign: 'center', padding: '6px 0 10px' }}><div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2, display: 'inline-block' }} /></div>}
          {messages.length === 0 && <div className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}><p>No messages</p></div>}
          {messages.map(msg => (
            <div key={msg.id} className={`message ${['admin', 'sales_lead', 'sales_executive'].includes(msg.sender_role) ? 'message-sent' : 'message-received'} ${Number(msg.is_flagged) ? 'message-flagged' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ color: msg.sender_role === 'admin' ? '#3b82f6' : msg.sender_role === 'tutor' ? 'var(--accent)' : msg.sender_role === 'sales_lead' ? '#f59e0b' : msg.sender_role === 'sales_executive' ? '#f97316' : 'var(--info)' }}>
                  {msg.sender_name} ({msg.sender_role === 'sales_lead' ? 'Sales Lead' : msg.sender_role === 'sales_executive' ? 'Sales Exec' : msg.sender_role})
                </span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: msg.channel === 'tutor' ? 'rgba(99,102,241,0.2)' : 'rgba(132,194,37,0.2)', color: msg.channel === 'tutor' ? '#6366f1' : '#84c225' }}>
                  {msg.channel === 'tutor' ? 'Tutor Ch.' : 'Support Ch.'}
                </span>
              </div>
              {msg.attachment_url ? <AttachmentBubble msg={msg} isOwn={['admin','sales_lead','sales_executive'].includes(msg.sender_role)} /> : <div>{msg.message}</div>}
              {Number(msg.is_flagged) ? <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>⚠️ {msg.flag_reason}</div> : null}
              <div className="message-meta">{new Date(msg.created_at).toLocaleString()}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
