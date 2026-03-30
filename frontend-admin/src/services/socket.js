import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
let socket = null;

export const connectSocket = (token) => {
  if (socket) return socket;
  
  // ensure we use the base url (remove /api if present)
  const baseUrl = SOCKET_URL.replace(/\/api$/, '');
  
  socket = io(baseUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
