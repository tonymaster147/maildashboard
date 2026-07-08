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
      window.location.href = (import.meta.env.BASE_URL || '/') + 'login';
    }
    return Promise.reject(error);
  }
);

// Public site branding (for login/signup page logo + name)
export const getPublicSite = () => api.get('/public/site');
export const getPublicGeo = () => api.get('/public/geo');
export const getPublicStatuses = (kind) => api.get(`/public/statuses/${kind}`);

export const uploadChatAttachment = (orderId, file, channel) => {
  const fd = new FormData();
  fd.append('file', file);
  if (channel) fd.append('channel', channel);
  return api.post(`/chat/upload/${orderId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// Auth
export const signup = (data) => api.post('/auth/signup', data);
export const login = (data) => api.post('/auth/login', data);
export const getProfile = () => api.get('/auth/profile');
export const changePassword = (data) => api.put('/auth/change-password', data);
export const forgotAccessCode = (data) => api.post('/auth/forgot-access-code', data);
export const requestEmailChange = (data) => api.post('/auth/request-email-change', data);
export const verifyEmailChange = (data) => api.post('/auth/verify-email-change', data);

// Orders
export const getOrderTypes = () => api.get('/orders/types');
export const getSubjects = (search = '') => api.get(`/orders/subjects?search=${search}`);
export const getEducationLevels = () => api.get('/orders/education-levels');
export const getPlans = () => api.get('/orders/plans');
export const createOrder = (data) => api.post('/orders', data);
export const getUserOrders = (params = {}) => api.get('/orders', { params: typeof params === 'string' ? { status: params } : params });
export const getOrderCode = (id) => api.get(`/orders/${id}/code`);
export const updateOrderLoginDetails = (id, data) => api.put(`/orders/${id}/login-details`, data);

// Notification feed (bell panel) — non-chat notifications: status changes,
// payment received/reminders, files, issue replies. Live pushes arrive on
// the 'notification' socket event.
export const getNotifications = () => api.get('/notifications');
export const getNotificationsUnreadCount = () => api.get('/notifications/unread-count');
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.put('/notifications/read-all');

export const getIssueCategories = () => api.get('/issues/categories');
export const getMyIssues = (params = {}) => api.get('/issues', { params });
export const getIssuesUnreadCount = () => api.get('/issues/unread-count');
export const createIssue = (data) => api.post('/issues', data);
export const getIssue = (id) => api.get(`/issues/${id}`);
export const addIssueMessage = (id, data) => api.post(`/issues/${id}/messages`, data);
export const getOrderDetail = (id) => api.get(`/orders/${id}`);
export const validateCoupon = (code) => api.post('/orders/validate-coupon', { code });
export const calculatePrice = (data) => api.post('/orders/calculate-price', data);
export const createDraftOrder = (data) => api.post('/orders/draft', data);
export const updateDraftOrder = (id, data) => api.put(`/orders/draft/${id}`, data);

// Payments
export const createPaymentSession = (data) => api.post('/payments/create-session', data);
export const createPaymentIntent = (data) => api.post('/payments/create-intent', data);
export const checkPartialEligibility = (orderId) => api.get('/payments/partial-eligibility', { params: { order_id: orderId } });
export const createRemainingPaymentIntent = (data) => api.post('/payments/create-remaining-intent', data);
export const fulfillPaymentIntent = (data) => api.post('/payments/fulfill-intent', data);
export const getOrderInstallments = (orderId) => api.get(`/orders/${orderId}/installments`);
export const payInstallment = (installmentId) => api.post(`/payments/pay-installment/${installmentId}`);
export const payAllInstallments = (orderId) => api.post(`/payments/pay-all-installments/${orderId}`);
export const payRemainingBalance = (data) => api.post('/payments/pay-remaining', data);
export const getPaymentHistory = () => api.get('/payments/history');
export const verifyPayment = (sessionId) => api.get(`/payments/verify?session_id=${sessionId}`);

// Files
export const uploadFiles = (formData) => api.post('/files/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getOrderFiles = (orderId) => api.get(`/files/order/${orderId}`);

// Chat
// params: { channel, before, after, limit } — returns { messages, hasMore }
export const getChatMessages = (orderId, params = {}) =>
  api.get(`/chat/messages/${orderId}`, { params: typeof params === 'string' ? { channel: params } : params });
export const sendMessage = (data) => api.post('/chat/send', data);
export const getUnreadCount = () => api.get('/chat/unread');
export const markAllRead = () => api.post('/chat/mark-all-read');
export const getUnreadPerOrder = () => api.get('/chat/unread-per-order');

export default api;
