import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getChatMessages, uploadChatAttachment, getOrderCode } from '../services/api';
import { connectSocket, getSocket } from '../services/socket';
import { FiSend } from 'react-icons/fi';
import { AttachButton, AttachPreview, AttachmentBubble } from '../components/ChatAttachment';

export default function Chat() {
  const { orderId } = useParams();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(null);
  const [orderCode, setOrderCode] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { getOrderCode(orderId).then(r => setOrderCode(r.data.order_code)).catch(() => {}); }, [orderId]);

  useEffect(() => {
    getChatMessages(orderId).then(res => { setMessages(res.data); setLoading(false); }).catch(() => setLoading(false));
    const socket = connectSocket(token);
    socket.emit('joinRoom', parseInt(orderId));
    socket.on('newMessage', (msg) => {
      // 2-way channel: tutor only sees tutor-channel messages
      if (msg.channel === 'tutor' || msg.sender_role === 'user' || msg.sender_role === 'tutor') {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });
    socket.on('userTyping', (data) => { if (data.user_id !== user.id) setTyping(data.name); });
    socket.on('userStopTyping', () => setTyping(null));
    return () => { socket.emit('leaveRoom', parseInt(orderId)); socket.off('newMessage'); socket.off('userTyping'); socket.off('userStopTyping'); };
  }, [orderId, token, user.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (pendingFile) {
      setUploading(true);
      try {
        const { data } = await uploadChatAttachment(parseInt(orderId), pendingFile);
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
      socket.emit('sendMessage', { order_id: parseInt(orderId), message: newMessage });
      socket.emit('stopTyping', { order_id: parseInt(orderId) });
    }
    setNewMessage('');
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    const socket = getSocket();
    if (socket) {
      socket.emit('typing', { order_id: parseInt(orderId), name: user.name });
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => socket.emit('stopTyping', { order_id: parseInt(orderId) }), 2000);
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div>
          <h3 style={{ fontSize: 16 }}>Chat - Order {orderCode || `#${orderId}`}</h3>
          {typing && <p style={{ color: 'var(--accent)', fontSize: 12 }}>{typing} is typing...</p>}
        </div>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && <div className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}><p>No messages yet</p></div>}
        {messages.map(msg => {
          const isOwn = msg.sender_role === 'tutor' && msg.sender_id === user.id;
          return (
            <div key={msg.id} className={`message ${isOwn ? 'message-sent' : 'message-received'} ${msg.is_flagged ? 'message-flagged' : ''}`}>
              {!isOwn && (
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: msg.sender_role === 'admin' ? 'var(--info)' : 'var(--accent)' }}>
                  {msg.sender_name} ({msg.sender_role})
                </div>
              )}
              {msg.attachment_url ? <AttachmentBubble msg={msg} isOwn={isOwn} /> : <div>{msg.message}</div>}
              <div className="message-meta">{new Date(msg.created_at).toLocaleTimeString()}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
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
