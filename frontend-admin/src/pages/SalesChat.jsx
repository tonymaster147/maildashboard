import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { salesApi, getChatMessages, getUnreadPerOrder, markAllRead, uploadChatAttachment } from '../services/api';
import { connectSocket, getSocket } from '../services/socket';
import { FiSend, FiMessageCircle, FiSearch } from 'react-icons/fi';
import { AttachButton, AttachPreview, AttachmentBubble } from '../components/ChatAttachment';

function useNotificationSound() {
  return useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      setTimeout(() => ctx.close(), 500);
    } catch (e) {}
  }, []);
}

export default function SalesChat() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [typing, setTyping] = useState(null);
  const [search, setSearch] = useState('');
  const [unreadMap, setUnreadMap] = useState({});
  const bottomRef = useRef(null);
  const selectedOrderRef = useRef(null);
  const playSound = useNotificationSound();

  // Keep ref in sync so socket listener always has current value
  useEffect(() => { selectedOrderRef.current = selectedOrder; }, [selectedOrder]);

  // Fetch orders that have chat enabled + unread counts
  useEffect(() => {
    Promise.all([
      salesApi.getOrders({ limit: 200 }),
      getUnreadPerOrder().catch(() => ({ data: {} }))
    ]).then(([res, unreadRes]) => {
      const orderList = res.data.orders || res.data || [];
      // Conversations with unread student messages first (stable sort)
      const umap = unreadRes.data || {};
      const enabled = orderList.filter(o => o.chat_enabled);
      enabled.sort((a, b) => ((umap[b.id] || 0) > 0 ? 1 : 0) - ((umap[a.id] || 0) > 0 ? 1 : 0));
      setOrders(enabled);
      setUnreadMap(umap);
      setLoading(false);
      markAllRead().catch(() => {});
    }).catch(() => setLoading(false));
  }, []);

  // Connect socket - use ref to avoid stale closure
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    socket.emit('adminMonitorAll');

    // newMessage only arrives for the currently-selected (joined) order room
    // 2-way channel: admin/sales only sees user + admin/sales messages
    const handleNewMessage = (msg) => {
      const current = selectedOrderRef.current;
      if (current && msg.order_id === current.id && msg.channel === 'support') {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    // chatNotification arrives for ALL orders — play sound + update badge
    const handleChatNotif = (data) => {
      const current = selectedOrderRef.current;
      if (!current || data.order_id !== current.id) {
        setUnreadMap(prev => ({ ...prev, [data.order_id]: (prev[data.order_id] || 0) + 1 }));
        playSound();
      }
    };

    const handleTyping = (data) => {
      if (data.user_id !== user.id) setTyping(data.name);
    };
    const handleStopTyping = () => setTyping(null);

    socket.on('newMessage', handleNewMessage);
    socket.on('chatNotification', handleChatNotif);
    socket.on('userTyping', handleTyping);
    socket.on('userStopTyping', handleStopTyping);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('chatNotification', handleChatNotif);
      socket.off('userTyping', handleTyping);
      socket.off('userStopTyping', handleStopTyping);
    };
  }, [token, user.id]);

  // Load messages when order selected
  useEffect(() => {
    if (!selectedOrder) return;
    setChatLoading(true);
    const socket = getSocket();
    if (socket) socket.emit('joinRoom', selectedOrder.id);

    // Clear unread for this order
    setUnreadMap(prev => { const next = { ...prev }; delete next[selectedOrder.id]; return next; });

    getChatMessages(selectedOrder.id)
      .then(res => { setMessages(res.data); setChatLoading(false); })
      .catch(() => setChatLoading(false));

    return () => {
      if (socket) socket.emit('leaveRoom', selectedOrder.id);
    };
  }, [selectedOrder]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (pendingFile) {
      setUploading(true);
      try {
        const { data } = await uploadChatAttachment(selectedOrder.id, pendingFile);
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
      socket.emit('sendMessage', { order_id: selectedOrder.id, message: newMessage });
      socket.emit('stopTyping', { order_id: selectedOrder.id });
    }
    setNewMessage('');
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    const socket = getSocket();
    if (socket && selectedOrder) {
      socket.emit('typing', { order_id: selectedOrder.id, name: user.name });
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => socket.emit('stopTyping', { order_id: selectedOrder.id }), 2000);
    }
  };

  const filteredOrders = orders.filter(o =>
    !search || `#${o.id} ${o.order_code || ''} ${o.title || ''} ${o.user_email || ''} ${o.username || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const isMySentMessage = (msg) => {
    return (msg.sender_role === 'sales_lead' || msg.sender_role === 'sales_executive') && msg.sender_id === user.id;
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2>Customer Chat</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Chat with customers about their orders</p>
      </div>
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 180px)' }}>
        {/* Order list sidebar */}
        <div className="card" style={{ width: 320, minWidth: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0 0 12px 0' }}>
            <div style={{ position: 'relative' }}>
              <FiSearch size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search orders..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 32, fontSize: 13 }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filteredOrders.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No orders with chat enabled</div>
            )}
            {filteredOrders.map(order => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginBottom: 4,
                  background: selectedOrder?.id === order.id ? 'var(--accent-muted, rgba(99,102,241,0.15))' : 'transparent',
                  borderLeft: selectedOrder?.id === order.id ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Order {order.order_code || `#${order.id}`}</span>
                  {unreadMap[order.id] > 0 && (
                    <span style={{ background: 'var(--error)', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{unreadMap[order.id]}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{order.title || order.subject || 'Untitled'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span className={`badge-status ${order.status === 'completed' ? 'badge-completed' : order.status === 'in_progress' ? 'badge-active' : 'badge-pending'}`} style={{ fontSize: 10 }}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          {!selectedOrder ? (
            <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
              <FiMessageCircle size={48} />
              <p>Select an order to start chatting</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600 }}>Order {selectedOrder.order_code || `#${selectedOrder.id}`} — {selectedOrder.title || selectedOrder.subject || 'Chat'}</div>
                {typing && <p style={{ color: 'var(--accent)', fontSize: 12, margin: 0 }}>{typing} is typing...</p>}
              </div>
              <div className="chat-messages" style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {chatLoading ? (
                  <div className="flex-center" style={{ padding: 40 }}><div className="loading-spinner"></div></div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No messages yet. Start the conversation!</div>
                ) : (
                  messages.map(msg => {
                    const own = isMySentMessage(msg);
                    return (
                      <div key={msg.id} className={`message ${own ? 'message-sent' : 'message-received'} ${msg.is_flagged ? 'message-flagged' : ''}`}>
                        {!own && (
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: msg.sender_role === 'admin' ? '#3b82f6' : msg.sender_role === 'tutor' ? 'var(--accent)' : msg.sender_role === 'sales_lead' ? '#f59e0b' : msg.sender_role === 'sales_executive' ? '#f97316' : 'var(--info)' }}>
                            {msg.sender_name} ({msg.sender_role === 'sales_lead' ? 'Sales Lead' : msg.sender_role === 'sales_executive' ? 'Sales Exec' : msg.sender_role})
                          </div>
                        )}
                        {msg.attachment_url ? <AttachmentBubble msg={msg} isOwn={own} /> : <div>{msg.message}</div>}
                        <div className="message-meta">{new Date(msg.created_at).toLocaleTimeString()}</div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                <AttachPreview file={pendingFile} onRemove={() => setPendingFile(null)} />
                <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AttachButton onPick={setPendingFile} disabled={uploading} />
                  <input
                    type="text"
                    className="form-input"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
