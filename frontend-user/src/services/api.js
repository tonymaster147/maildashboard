import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const signup = (data) => api.post('/auth/signup', data);
export const login = (data) => api.post('/auth/login', data);
export const getProfile = () => api.get('/auth/profile');
export const changePassword = (data) => api.put('/auth/change-password', data);
export const forgotAccessCode = (data) => api.post('/auth/forgot-access-code', data);

// Orders
export const getOrderTypes = () => api.get('/orders/types');
export const getSubjects = (search = '') => api.get(`/orders/subjects?search=${search}`);
export const getEducationLevels = () => api.get('/orders/education-levels');
export const getPlans = () => api.get('/orders/plans');
export const createOrder = (data) => api.post('/orders', data);
export const getUserOrders = (status = '') => api.get(`/orders?status=${status}`);
export const getOrderDetail = (id) => api.get(`/orders/${id}`);
export const validateCoupon = (code) => api.post('/orders/validate-coupon', { code });
export const createDraftOrder = (data) => api.post('/orders/draft', data);
export const updateDraftOrder = (id, data) => api.put(`/orders/draft/${id}`, data);

// Payments
export const createPaymentSession = (data) => api.post('/payments/create-session', data);
export const getPaymentHistory = () => api.get('/payments/history');
export const verifyPayment = (sessionId) => api.get(`/payments/verify?session_id=${sessionId}`);

// Files
export const uploadFiles = (formData) => api.post('/files/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getOrderFiles = (orderId) => api.get(`/files/order/${orderId}`);

// Chat
export const getChatMessages = (orderId) => api.get(`/chat/messages/${orderId}`);
export const sendMessage = (data) => api.post('/chat/send', data);
export const getUnreadCount = () => api.get('/chat/unread');
export const getUnreadPerOrder = () => api.get('/chat/unread-per-order');

export default api;
