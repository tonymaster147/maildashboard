// IssueDetail — v2 styled. Reuses the shared <ChatBubble> from Phase 5 for
// threaded messages. Reply API + close/closed banner behavior unchanged.

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiSend, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getIssue, addIssueMessage } from '../services/api';
import Notice from '../components/Notice';
import { C } from '../theme/tokens';
import { Card, Pill, ChatBubble } from '../components/ui';

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [issue, setIssue] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const load = () => {
    setLoading(true);
    getIssue(id).then(r => {
      setIssue(r.data.issue);
      setMessages(r.data.messages || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  // Silent refresh while viewing — staff replies appear live, and each
  // fetch advances user_seen_at so the ISSUES badge can't resurrect for
  // messages that arrived while this thread was open.
  useEffect(() => {
    const t = setInterval(() => {
      getIssue(id).then(r => {
        setIssue(r.data.issue);
        setMessages(prev => ((r.data.messages || []).length !== prev.length ? (r.data.messages || []) : prev));
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError('');
    try {
      await addIssueMessage(id, { message: reply.trim() });
      setReply('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div className="loading-spinner" />
      </div>
    );
  }
  if (!issue) {
    return (
      <Card style={{ textAlign: 'center', padding: 40 }}>
        <h3 style={{ color: C.textPrimary }}>Issue not found</h3>
      </Card>
    );
  }

  const isClosed = issue.status === 'closed';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link
          to="/issues"
          aria-label="Back to issues"
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: '#f1f5f9', color: C.textSecondary,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          <FiArrowLeft size={16} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3 }}>
            ISSUE #{issue.id}
          </div>
          <h2 style={{
            fontSize: 20, fontWeight: 800, color: C.textPrimary, margin: '4px 0 4px',
            letterSpacing: 0.2,
          }}>
            {issue.subject}
          </h2>
          <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Pill bg={C.accentSoft} color={C.accent}>{issue.category}</Pill>
            {issue.order_code && (
              <span>
                Order{' '}
                <span style={{ fontFamily: 'ui-monospace, monospace', color: C.textSecondary, fontWeight: 700 }}>
                  {issue.order_code}
                </span>
              </span>
            )}
            <span>·</span>
            <span>Opened {new Date(issue.created_at).toLocaleString()}</span>
          </div>
        </div>
        <Pill
          bg={isClosed ? '#eef2f7' : C.greenSoft}
          color={isClosed ? C.textMuted : C.green}
          style={{ fontSize: 11, padding: '5px 12px' }}
        >
          {issue.status}
        </Pill>
      </div>

      {/* Thread */}
      <Card padding={20} style={{ marginBottom: 14 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: 20, fontSize: 13 }}>
            <FiAlertCircle size={22} style={{ color: C.textMuted, marginBottom: 6 }} />
            <p style={{ margin: 0 }}>No messages on this issue yet.</p>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: 540, overflowY: 'auto',
          }}>
            {messages.map(m => {
              const isOwn = m.sender_role === 'user' && m.sender_id === user.id;
              return (
                <ChatBubble
                  key={m.id}
                  mine={isOwn}
                  channel="issue"
                  senderName={isOwn ? null : m.sender_name}
                  senderRole={m.sender_role}
                  message={m.message}
                  timestamp={m.created_at}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </Card>

      {/* Reply form OR closed banner */}
      {isClosed ? (
        <Notice type="info">
          This issue has been closed. To continue the discussion, please contact support.
        </Notice>
      ) : (
        <Card>
          {error && <Notice type="error">{error}</Notice>}
          <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              className="form-textarea"
              rows={3}
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Type your reply…"
              disabled={sending}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                style={{
                  padding: '10px 18px', borderRadius: 10, border: 'none',
                  background: C.accent, color: '#fff',
                  cursor: (sending || !reply.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  opacity: (sending || !reply.trim()) ? 0.6 : 1,
                }}
              >
                {sending
                  ? <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  : <><FiSend size={14} /> Send Reply</>}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
