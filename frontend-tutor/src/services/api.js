import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tutor_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/login')) {
      localStorage.removeItem('tutor_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const tutorLogin = (data) => api.post('/auth/tutor/login', data);
export const getTasks = (params = {}) => api.get('/tutor/tasks', { params });
export const getTaskDetail = (id) => api.get(`/tutor/tasks/${id}`);
export const getOrderCode = (id) => api.get(`/orders/${id}/code`);
export const completeTask = (id) => api.put(`/tutor/tasks/${id}/complete`);
export const updateTutorTaskStatus = (id, tutor_status_code) => api.patch(`/tutor/tasks/${id}/status`, { tutor_status_code });
export const getPublicStatuses = (kind) => api.get(`/public/statuses/${kind}`);

export const uploadChatAttachment = (orderId, file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post(`/chat/upload/${orderId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const uploadWorkFiles = (id, formData) => api.post(`/tutor/tasks/${id}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getChatMessages = (orderId) => api.get(`/chat/messages/${orderId}`);
export const getNotifications = () => api.get('/tutor/notifications');
export const getUnreadCount = () => api.get('/chat/unread');
export const markAllRead = () => api.post('/chat/mark-all-read');
export const getUnreadPerOrder = () => api.get('/chat/unread-per-order');

export default api;
