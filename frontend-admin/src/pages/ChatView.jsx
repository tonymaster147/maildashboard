import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getChatMessages } from '../services/api';
import { FiArrowLeft } from 'react-icons/fi';

export default function ChatView() {
  const { orderId } = useParams();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    getChatMessages(orderId, { channel: 'all' }).then(res => { setMessages(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [orderId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/chats" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <h2>Chat - Order #{orderId}</h2>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{messages.length} messages</span>
      </div>
      <div className="chat-container" style={{ height: 'calc(100vh - 180px)' }}>
        <div className="chat-messages">
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
              <div>{msg.message}</div>
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
