import { io } from 'socket.io-client';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';
let socket = null;
let socketToken = null;

// Reuse the existing socket even while it's still connecting or auto-
// reconnecting — the old `socket?.connected` check spawned a second socket
// mid-handshake and orphaned the first one along with its listeners, which
// made live badges silently stop until a refresh.
export const connectSocket = (token) => {
  if (socket && socketToken === token) return socket;
  if (socket) { socket.disconnect(); socket = null; }
  socketToken = token;
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
};
export const disconnectSocket = () => { if (socket) { socket.disconnect(); socket = null; socketToken = null; } };
export const getSocket = () => socket;
