import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getEscalation, addEscalationMessage } from '../services/api';

export default function EscalationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [issue, setIssue] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    setLoading(true);
    getEscalation(id)
      .then(r => { setIssue(r.data.issue); setMessages(r.data.messages || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  // Silent refresh so new replies from student/staff appear live.
  useEffect(() => {
    const t = setInterval(() => {
      getEscalation(id)
        .then(r => { setIssue(r.data.issue); setMessages(prev => ((r.data.messages || []).length !== prev.length ? r.data.messages : prev)); })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await addEscalationMessage(id, { message: reply.trim() });
      setReply('');
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner" /></div>;
  if (!issue) return <div className="card text-center"><h3>Escalation not found</h3></div>;
  const isClosed = issue.status === 'closed';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to="/escalations" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>#{issue.id} — {issue.subject}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {issue.category} • From {issue.user_name} • Opened {new Date(issue.created_at).toLocaleString()}
            {issue.order_code ? ` • Order ${issue.order_code}` : ''}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 10, textTransform: 'uppercase', background: isClosed ? 'rgba(127,127,127,0.12)' : 'rgba(34,197,94,0.12)', color: isClosed ? 'var(--text-muted)' : '#16a34a' }}>{issue.status}</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 500, overflowY: 'auto' }}>
          {messages.map(m => {
            const own = m.sender_role === 'tutor' && m.sender_id === user.id;
            const fromUser = m.sender_role === 'user';
            return (
              <div key={m.id} style={{
                alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: 10, whiteSpace: 'pre-wrap',
                background: fromUser ? 'rgba(245,158,11,0.10)' : own ? 'rgba(132,194,37,0.12)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${fromUser ? 'rgba(245,158,11,0.3)' : own ? 'rgba(132,194,37,0.3)' : 'rgba(99,102,241,0.25)'}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: fromUser ? '#d97706' : own ? '#16a34a' : '#6366f1' }}>
                  {m.sender_name} ({m.sender_role.replace('_', ' ')})
                </div>
                <div style={{ fontSize: 14 }}>{m.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(m.created_at).toLocaleString()}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {isClosed ? (
        <div className="card text-center" style={{ padding: 16, color: 'var(--text-muted)' }}>This ticket is closed by support.</div>
      ) : (
        <form onSubmit={send} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea className="form-input" rows={3} value={reply} onChange={e => setReply(e.target.value)} placeholder="Type your reply…" disabled={sending} style={{ resize: 'vertical' }} />
          <button type="submit" className="btn btn-primary" disabled={sending || !reply.trim()} style={{ alignSelf: 'flex-end' }}>
            {sending ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><FiSend size={14} /> Send Reply</>}
          </button>
        </form>
      )}
    </div>
  );
}
