import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getChatMessages } from '../services/api';
import { connectSocket, getSocket, disconnectSocket } from '../services/socket';
import { FiSend } from 'react-icons/fi';

export default function Chat() {
  const { orderId } = useParams();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Load existing messages
    getChatMessages(orderId).then(res => {
      setMessages(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Connect socket
    const socket = connectSocket(token);
    socket.emit('joinRoom', parseInt(orderId));

    socket.on('newMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('userTyping', (data) => {
      if (data.user_id !== user.id) setTyping(data.name);
    });

    socket.on('userStopTyping', () => {
      setTyping(null);
    });

    return () => {
      socket.emit('leaveRoom', parseInt(orderId));
      socket.off('newMessage');
      socket.off('userTyping');
      socket.off('userStopTyping');
    };
  }, [orderId, token, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
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
          <h3 style={{ fontSize: 16 }}>Chat - Order #{orderId}</h3>
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
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender_role === 'user' && msg.sender_id === user.id ? 'message-sent' : 'message-received'} ${msg.is_flagged ? 'message-flagged' : ''}`}>
            {msg.sender_role !== 'user' || msg.sender_id !== user.id ? (
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: msg.sender_role === 'admin' ? 'var(--info)' : 'var(--accent)' }}>
                {msg.sender_name} ({msg.sender_role})
              </div>
            ) : null}
            <div>{msg.message}</div>
            <div className="message-meta">{new Date(msg.created_at).toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input type="text" placeholder="Type a message..." value={newMessage} onChange={handleTyping} autoFocus />
        <button type="submit" className="btn btn-primary" disabled={!newMessage.trim()}>
          <FiSend size={16} />
        </button>
      </form>
    </div>
  );
}
