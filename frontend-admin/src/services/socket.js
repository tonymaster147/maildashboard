import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
let socket = null;
let socketToken = null;

export const connectSocket = (token) => {
  // Reuse the existing socket even while it's still connecting or auto-
  // reconnecting. The old check (`socket?.connected`) tore the socket down
  // (removeAllListeners + disconnect) whenever a component called this
  // mid-handshake — killing every live badge/notification listener that
  // Layout had attached, until a full page refresh re-registered them.
  if (socket && socketToken === token) return socket;

  // Token changed (re-login) — drop the old connection cleanly.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socketToken = token;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    console.log('🔌 Admin socket connected');
    if (socket._adminMonitor) {
      socket.emit('adminMonitorAll');
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
};
