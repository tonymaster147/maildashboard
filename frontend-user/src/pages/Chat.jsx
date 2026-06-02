import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getChatMessages, uploadChatAttachment, getOrderCode } from '../services/api';
import { connectSocket, getSocket } from '../services/socket';
import { FiSend } from 'react-icons/fi';
import { AttachButton, AttachPreview, AttachmentBubble } from '../components/ChatAttachment';

export default function Chat() {
  const { orderId, channel } = useParams(); // channel = 'tutor' or 'support'
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(null);
  const [orderCode, setOrderCode] = useState(null);

  useEffect(() => { getOrderCode(orderId).then(r => setOrderCode(r.data.order_code)).catch(() => {}); }, [orderId]);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(channel);
  useEffect(() => { channelRef.current = channel; }, [channel]);

  const channelLabel = channel === 'tutor' ? 'Tutor' : 'Support';
  const channelColor = channel === 'tutor' ? '#6366f1' : '#84c225';

  useEffect(() => {
    // Load existing messages filtered by channel
    getChatMessages(orderId, channel).then(res => {
      setMessages(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Connect socket
    const socket = connectSocket(token);
    socket.emit('joinRoom', parseInt(orderId));

    const handleNewMsg = (msg) => {
      // Only show messages for THIS channel
      if (msg.order_id === parseInt(orderId) && msg.channel === channelRef.current) {
        setMessages(prev => {
          // Avoid duplicates (sender gets their own message back)
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();

    // Attachment takes priority (text + file in same submit → send file, keep text)
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
        channel
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

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div>
          <h3 style={{ fontSize: 16 }}>
            Order {orderCode || `#${orderId}`} — <span style={{ color: channelColor }}>{channelLabel} Chat</span>
          </h3>
          {typing && <p style={{ color: 'var(--accent)', fontSize: 12 }}>{typing} is typing...</p>}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map(msg => {
          const isOwn = msg.sender_role === 'user' && msg.sender_id === user.id;
          return (
            <div key={msg.id} className={`message ${isOwn ? 'message-sent' : 'message-received'} ${msg.is_flagged ? 'message-flagged' : ''}`}>
              {!isOwn ? (
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: msg.sender_role === 'tutor' ? '#6366f1' : msg.sender_role === 'admin' ? '#3b82f6' : msg.sender_role === 'sales_lead' ? '#f59e0b' : msg.sender_role === 'sales_executive' ? '#f97316' : 'var(--accent)' }}>
                  {msg.sender_name} ({msg.sender_role === 'sales_lead' ? 'Sales Lead' : msg.sender_role === 'sales_executive' ? 'Sales Exec' : msg.sender_role})
                </div>
              ) : null}
              {msg.attachment_url ? <AttachmentBubble msg={msg} isOwn={isOwn} /> : <div>{msg.message}</div>}
              <div className="message-meta">{new Date(msg.created_at).toLocaleTimeString()}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <AttachPreview file={pendingFile} onRemove={() => setPendingFile(null)} />
        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
          <AttachButton onPick={setPendingFile} disabled={uploading} />
          <input
            type="text"
            placeholder={pendingFile ? 'Press send to upload attachment' : 'Type a message...'}
            value={newMessage}
            onChange={handleTyping}
            disabled={!!pendingFile || uploading}
            autoFocus
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={uploading || (!pendingFile && !newMessage.trim())}>
            {uploading ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <FiSend size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
