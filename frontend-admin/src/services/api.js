import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/login')) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const adminLogin = (data) => api.post('/auth/admin/login', data);

// Dashboard
export const getDashboardStats = () => api.get('/admin/dashboard');

// Users
export const getAllUsers = (params) => api.get('/admin/users', { params });
export const toggleUserStatus = (id, data) => api.put(`/admin/users/${id}/toggle-status`, data);

// Tutors
export const getAllTutors = () => api.get('/admin/tutors');
export const createTutor = (data) => api.post('/admin/tutors', data);
export const updateTutor = (id, data) => api.put(`/admin/tutors/${id}`, data);
export const deleteTutor = (id) => api.delete(`/admin/tutors/${id}`);

// Orders
export const getAllOrders = (params) => api.get('/admin/orders', { params });
export const updateOrderStatus = (id, data) => api.put(`/admin/orders/${id}/status`, data);
export const assignTutors = (id, data) => api.put(`/admin/orders/${id}/assign`, data);
export const reopenChat = (id) => api.put(`/admin/orders/${id}/reopen-chat`);

// Chat
export const getAllChats = () => api.get('/admin/chats');
export const getFlaggedMessages = () => api.get('/admin/chats/flagged');
export const getChatMessages = (orderId) => api.get(`/chat/messages/${orderId}`);

// Settings
export const getSettings = () => api.get('/admin/settings');
export const updatePlan = (id, data) => api.put(`/admin/plans/${id}`, data);
export const createCoupon = (data) => api.post('/admin/coupons', data);
export const deleteCoupon = (id) => api.delete(`/admin/coupons/${id}`);

// Notifications
export const getNotifications = () => api.get('/admin/notifications');
export const markNotificationRead = (id) => api.put(`/admin/notifications/${id}/read`);

export const getOrderDetail = (id) => api.get(`/orders/${id}`);

// Banned Words
export const getBannedWords = () => api.get('/admin/banned-words');
export const addBannedWord = (data) => api.post('/admin/banned-words', data);
export const deleteBannedWord = (id) => api.delete(`/admin/banned-words/${id}`);

export default api;
