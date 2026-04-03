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
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000
  });

  // Re-join rooms after reconnection (server loses room membership on disconnect)
  socket.on('connect', () => {
    if (socket._adminMonitor) {
      socket.emit('adminMonitorAll');
    }
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
