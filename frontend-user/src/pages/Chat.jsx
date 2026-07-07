// Chat — v2 styled. Every socket effect, channel filter, typing event, and
// attachment upload from the legacy page is preserved verbatim. Only the
// visual chrome changed: bubbles now use the shared <ChatBubble>, and the
// container layout uses v2 classes (.v2-chat-*).

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getChatMessages, uploadChatAttachment, getOrderCode, getOrderDetail } from '../services/api';
import { connectSocket, getSocket } from '../services/socket';
import { FiSend, FiArrowLeft, FiUser, FiHeadphones } from 'react-icons/fi';
import { AttachButton, AttachPreview, AttachmentBubble } from '../components/ChatAttachment';
import { C } from '../theme/tokens';
import { ChatBubble } from '../components/ui';

const CHANNEL_META = {
  tutor:   { label: 'Tutor Chat',   color: C.indigo, bg: C.indigoSoft, icon: FiUser },
  support: { label: 'Support Chat', color: C.green,  bg: C.greenSoft,  icon: FiHeadphones },
};

export default function Chat() {
  const { orderId, channel } = useParams(); // channel = 'tutor' or 'support'
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(null);
  const [orderCode, setOrderCode] = useState(null);
  // null = unknown (loading), true/false once the order detail arrives.
  // Only enforced for the tutor channel — support is always available.
  const [hasTutor, setHasTutor] = useState(null);

  useEffect(() => {
    getOrderCode(orderId).then(r => setOrderCode(r.data.order_code)).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    if (channel !== 'tutor') { setHasTutor(true); return; }
    getOrderDetail(orderId)
      .then(r => setHasTutor((r.data?.tutors || []).length > 0))
      .catch(() => setHasTutor(true)); // fail open — backend still guards sends
  }, [orderId, channel]);

  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);       // .v2-chat-messages scroll container
  const restoreDistRef = useRef(null);  // set while prepending older history
  const loadingOlderRef = useRef(false);
  const channelRef = useRef(channel);
  useEffect(() => { channelRef.current = channel; }, [channel]);

  const meta = CHANNEL_META[channel] || CHANNEL_META.support;

  useEffect(() => {
    // Load the newest 100 messages for this channel (older load on scroll-up).
    getChatMessages(orderId, { channel, limit: 100 }).then(res => {
      setMessages(res.data.messages || []);
      setHasMore(!!res.data.hasMore);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Connect socket
    const socket = connectSocket(token);
    socket.emit('joinRoom', parseInt(orderId));

    const handleNewMsg = (msg) => {
      // Only show messages for THIS channel
      if (msg.order_id === parseInt(orderId) && msg.channel === channelRef.current) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('newMessage', handleNewMsg);

    socket.on('userTyping', (data) => {
      if (data.user_id !== user.id) setTyping(data.name);
    });
    socket.on('userStopTyping', () => setTyping(null));

    return () => {
      socket.emit('leaveRoom', parseInt(orderId));
      socket.off('newMessage', handleNewMsg);
      socket.off('userTyping');
      socket.off('userStopTyping');
    };
  }, [orderId, channel, token, user.id]);

  // Keep the viewport anchored: on a normal append (new/initial message) stick
  // to the bottom; while prepending older history, preserve the reading spot.
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

  // Scroll-up (older) infinite load — YouTube-style, 100 at a time.
  const loadOlder = async () => {
    if (loadingOlderRef.current || !hasMore || messages.length === 0) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = scrollRef.current;
    restoreDistRef.current = el ? el.scrollHeight - el.scrollTop : null;
    try {
      const res = await getChatMessages(orderId, { channel, before: messages[0].id, limit: 100 });
      const older = res.data.messages || [];
      setHasMore(!!res.data.hasMore);
      if (older.length === 0) { restoreDistRef.current = null; }
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

  const handleSend = async (e) => {
    e.preventDefault();

    // Attachment takes priority
    if (pendingFile) {
      setUploading(true);
      try {
        const { data } = await uploadChatAttachment(parseInt(orderId), pendingFile, channel);
        setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
        setPendingFile(null);
      } catch (err) {
        alert(err.response?.data?.error || 'Upload failed');
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!newMessage.trim()) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('sendMessage', {
        order_id: parseInt(orderId),
        message: newMessage,
        channel,
      });
      socket.emit('stopTyping', { order_id: parseInt(orderId) });
    }
    setNewMessage('');
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    const socket = getSocket();
    if (socket) {
      socket.emit('typing', { order_id: parseInt(orderId), name: user.username });
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => {
        socket.emit('stopTyping', { order_id: parseInt(orderId) });
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  // Tutor channel with no tutor assigned — block the room (backend rejects
  // sends anyway; this gives a clear explanation instead of a dead input).
  if (channel === 'tutor' && hasTutor === false) {
    return (
      <div className="v2-chat-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 40, maxWidth: 420 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: C.indigoSoft, color: C.indigo,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <FiUser size={26} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, margin: '0 0 8px' }}>
            No tutor assigned yet
          </h3>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, margin: '0 0 20px' }}>
            Tutor chat opens as soon as a tutor is assigned to order{' '}
            <strong style={{ fontFamily: 'ui-monospace, monospace', color: C.textSecondary }}>
              {orderCode || `#${orderId}`}
            </strong>. Until then, our support team is happy to help.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={`/chat/support/${orderId}`} style={{
              padding: '11px 18px', borderRadius: 10, background: C.green, color: '#fff',
              textDecoration: 'none', fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', gap: 8, textTransform: 'uppercase',
            }}>
              <FiHeadphones size={14} /> Support Chat
            </Link>
            <Link to="/chats" style={{
              padding: '11px 18px', borderRadius: 10, border: `1px solid ${C.border}`,
              background: C.surface, color: C.textPrimary,
              textDecoration: 'none', fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
              display: 'inline-flex', alignItems: 'center', gap: 8, textTransform: 'uppercase',
            }}>
              <FiArrowLeft size={14} /> Back to Chats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v2-chat-container">
      {/* ── Header ── */}
      <div className="v2-chat-header">
        <Link
          to="/chats"
          aria-label="Back to chats"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#f1f5f9', color: C.textSecondary,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none', flexShrink: 0,
          }}
        >
          <FiArrowLeft size={16} />
        </Link>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', background: meta.bg, color: meta.color,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <meta.icon size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3 }}>
            ORDER ID:{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace', color: C.textSecondary, fontWeight: 700 }}>
              {orderCode || `#${orderId}`}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: meta.color, letterSpacing: 0.2, marginTop: 2 }}>
            {meta.label}
          </div>
          {typing && (
            <div style={{ fontSize: 11, color: C.accent, marginTop: 2, fontWeight: 600 }}>
              {typing} is typing…
            </div>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="v2-chat-messages" ref={scrollRef} onScroll={handleScroll}>
        {loadingOlder && (
          <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
            <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2, display: 'inline-block' }} />
          </div>
        )}
        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: C.textMuted, padding: 40, textAlign: 'center', height: '100%',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: meta.bg, color: meta.color,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <meta.icon size={22} />
            </div>
            <p style={{ fontSize: 14, color: C.textPrimary, fontWeight: 600, margin: '0 0 4px' }}>
              No messages yet
            </p>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
              Start the conversation below.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map(msg => {
            const isOwn = msg.sender_role === 'user' && msg.sender_id === user.id;
            const attachmentNode = msg.attachment_url
              ? <AttachmentBubble msg={msg} isOwn={isOwn} />
              : null;
            return (
              <ChatBubble
                key={msg.id}
                mine={isOwn}
                channel={channel}
                senderName={msg.sender_name}
                senderRole={msg.sender_role}
                message={msg.message}
                attachment={attachmentNode}
                timestamp={msg.created_at}
                flagged={msg.is_flagged}
              />
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className="v2-chat-input-area">
        <AttachPreview file={pendingFile} onRemove={() => setPendingFile(null)} />
        <form onSubmit={handleSend} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        }}>
          <AttachButton onPick={setPendingFile} disabled={uploading} />
          <input
            type="text"
            placeholder={pendingFile ? 'Press send to upload attachment' : 'Type a message…'}
            value={newMessage}
            onChange={handleTyping}
            disabled={!!pendingFile || uploading}
            autoFocus
            style={{
              flex: 1,
              padding: '10px 14px',
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              fontSize: 14,
              outline: 'none',
              background: C.surface,
              color: C.textPrimary,
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={uploading || (!pendingFile && !newMessage.trim())}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: meta.color, color: '#fff', border: 'none',
              cursor: (uploading || (!pendingFile && !newMessage.trim())) ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              opacity: (uploading || (!pendingFile && !newMessage.trim())) ? 0.55 : 1,
              flexShrink: 0,
            }}
            title="Send"
          >
            {uploading
              ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              : <FiSend size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
