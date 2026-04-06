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
export const getUnreadCount = () => api.get('/chat/unread');
export const markAllRead = () => api.post('/chat/mark-all-read');
export const getUnreadPerOrder = () => api.get('/chat/unread-per-order');

// Settings
export const getSettings = () => api.get('/admin/settings');
export const updatePlan = (id, data) => api.put(`/admin/plans/${id}`, data);
export const createCoupon = (data) => api.post('/admin/coupons', data);
export const deleteCoupon = (id) => api.delete(`/admin/coupons/${id}`);

// Notifications
export const getNotifications = () => api.get('/admin/notifications');
export const markNotificationRead = (id) => api.put(`/admin/notifications/${id}/read`);

export const getOrderDetail = (id) => api.get(`/orders/${id}`);
export const getOrderFiles = (orderId) => api.get(`/files/order/${orderId}`);
export const uploadFiles = (formData) => api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteFile = (id) => api.delete(`/files/${id}`);

// Banned Words
export const getBannedWords = () => api.get('/admin/banned-words');
export const addBannedWord = (data) => api.post('/admin/banned-words', data);
export const deleteBannedWord = (id) => api.delete(`/admin/banned-words/${id}`);

// Reports
export const getReports = (params) => api.get('/admin/reports', { params });

// Sales User management (admin)
export const getAllSalesUsers = () => api.get('/admin/sales-users');
export const createSalesUser = (data) => api.post('/admin/sales-users', data);
export const updateSalesUser = (id, data) => api.put(`/admin/sales-users/${id}`, data);
export const deleteSalesUser = (id) => api.delete(`/admin/sales-users/${id}`);
export const getSalesPermissions = (id) => api.get(`/admin/sales-users/${id}/permissions`);

// Sales login
export const salesLogin = (data) => api.post('/auth/sales/login', data);

// Sales user accessing admin features (uses /api/sales/ prefix)
export const salesApi = {
  getDashboard: () => api.get('/sales/dashboard'),
  getUsers: (params) => api.get('/sales/users', { params }),
  getTutors: () => api.get('/sales/tutors'),
  createTutor: (data) => api.post('/sales/tutors', data),
  updateTutor: (id, data) => api.put(`/sales/tutors/${id}`, data),
  deleteTutor: (id) => api.delete(`/sales/tutors/${id}`),
  getOrders: (params) => api.get('/sales/orders', { params }),
  updateOrderStatus: (id, data) => api.put(`/sales/orders/${id}/status`, data),
  assignTutors: (id, data) => api.put(`/sales/orders/${id}/assign`, data),
  reopenChat: (id) => api.put(`/sales/orders/${id}/reopen-chat`),
  getChats: () => api.get('/sales/chats'),
  getFlaggedMessages: () => api.get('/sales/chats/flagged'),
  getReports: (params) => api.get('/sales/reports', { params }),
  getSettings: () => api.get('/sales/settings'),
  updatePlan: (id, data) => api.put(`/sales/plans/${id}`, data),
  createCoupon: (data) => api.post('/sales/coupons', data),
  deleteCoupon: (id) => api.delete(`/sales/coupons/${id}`),
  getNotifications: () => api.get('/sales/notifications'),
  markNotificationRead: (id) => api.put(`/sales/notifications/${id}/read`),
  getBannedWords: () => api.get('/sales/banned-words'),
  addBannedWord: (data) => api.post('/sales/banned-words', data),
  deleteBannedWord: (id) => api.delete(`/sales/banned-words/${id}`),
  getMyPermissions: () => api.get('/sales/my-permissions'),
};

export default api;
