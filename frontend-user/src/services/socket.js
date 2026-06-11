import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';

let socket = null;
let socketToken = null;

export const connectSocket = (token) => {
  // Reuse the existing socket even while it's still connecting or auto-
  // reconnecting. The old check (`socket?.connected`) created a brand-new
  // socket whenever the current one was mid-handshake — orphaning the first
  // socket together with every listener attached to it (chat badge, bell
  // notifications), which made live updates silently stop until a refresh.
  if (socket && socketToken === token) return socket;

  // Token changed (re-login) — drop the old connection cleanly.
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socketToken = token;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
};

export const getSocket = () => socket;

export default { connectSocket, disconnectSocket, getSocket };
