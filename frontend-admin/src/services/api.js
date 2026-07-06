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
// Detailed reports
export const getReportsOverview = (params) => api.get('/admin/reports/overview', { params });
export const getTutorReport = (params) => api.get('/admin/reports/tutors', { params });
export const getUserReport = (params) => api.get('/admin/reports/users', { params });

// Notification feed (bell panel) — role-aware; same paths exist under /sales
export const getNotificationsFeed = () => api.get('/admin/notifications-feed');
export const getNotificationsFeedUnread = () => api.get('/admin/notifications-feed/unread-count');
export const markFeedNotificationRead = (id) => api.put(`/admin/notifications-feed/${id}/read`);
export const markAllFeedNotificationsRead = () => api.put('/admin/notifications-feed/read-all');

export const uploadTutorPhoto = (file) => {
  const fd = new FormData();
  fd.append('photo', file);
  return api.post('/admin/tutors/upload-photo', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Orders
export const getAllOrders = (params) => api.get('/admin/orders', { params });
export const getOrderFilterOptions = () => api.get('/admin/orders/filter-options');
export const updateOrderStatus = (id, data) => api.put(`/admin/orders/${id}/status`, data);
export const assignTutors = (id, data) => api.put(`/admin/orders/${id}/assign`, data);
export const reopenChat = (id) => api.put(`/admin/orders/${id}/reopen-chat`);
export const markRemainingPaid = (orderId, data) => api.post(`/admin/orders/${orderId}/mark-remaining-paid`, data);
export const createInstallmentPlan = (orderId, data) => api.post(`/admin/orders/${orderId}/installments`, data);
export const updateInstallmentPlan = (orderId, data) => api.put(`/admin/orders/${orderId}/installments`, data);
export const getInstallments = (orderId) => api.get(`/admin/orders/${orderId}/installments`);
export const deleteInstallmentPlan = (orderId) => api.delete(`/admin/orders/${orderId}/installments`);
export const markInstallmentPaid = (installmentId, data) => api.post(`/admin/installments/${installmentId}/mark-paid`, data);
export const markAllInstallmentsPaid = (orderId, data) => api.post(`/admin/orders/${orderId}/installments/mark-all-paid`, data);

// Chat
export const getAllChats = () => api.get('/admin/chats');
export const getFlaggedMessages = () => api.get('/admin/chats/flagged');
export const getChatMessages = (orderId, params) => api.get(`/chat/messages/${orderId}`, { params });
export const getUnreadCount = () => api.get('/chat/unread');
export const markAllRead = () => api.post('/chat/mark-all-read');
export const getUnreadPerOrder = () => api.get('/chat/unread-per-order');

// Settings
export const getSettings = () => api.get('/admin/settings');
export const updateNotificationEmails = (data) => api.put('/admin/notification-emails', data);
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

// Pricing Rules
export const getPricingRules = () => api.get('/admin/pricing-rules');
export const createPricingRule = (data) => api.post('/admin/pricing-rules', data);
export const updatePricingRule = (id, data) => api.put(`/admin/pricing-rules/${id}`, data);
export const deletePricingRule = (id) => api.delete(`/admin/pricing-rules/${id}`);
export const updateUrgentFee = (data) => api.put('/admin/urgent-fee', data);

// Banned Words
export const getBannedWords = () => api.get('/admin/banned-words');
export const addBannedWord = (data) => api.post('/admin/banned-words', data);
export const deleteBannedWord = (id) => api.delete(`/admin/banned-words/${id}`);

// Reports
export const getReports = (params) => api.get('/admin/reports', { params });

// Sites (multi-WP branding)
export const getSites = () => api.get('/admin/sites');
export const getSite = (id) => api.get(`/admin/sites/${id}`);
export const createSite = (data) => api.post('/admin/sites', data);
export const updateSite = (id, data) => api.put(`/admin/sites/${id}`, data);
export const deleteSite = (id) => api.delete(`/admin/sites/${id}`);
export const sendSiteTestEmail = (id, data) => api.post(`/admin/sites/${id}/test-email`, data);
export const uploadSiteLogo = (formData) => api.post('/admin/sites/upload-logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Order status lists (admin/tutor). kind = 'admin' | 'tutor'.
// `getStatuses` hits the admin CRUD endpoint and requires admin role —
// used by Settings. Read-only displays (Orders list, OrderDetail) should
// use `getPublicStatuses` so sales users can also load the dropdowns.
export const getStatuses = (kind) => api.get(`/admin/statuses/${kind}`);
export const getPublicStatuses = (kind) => api.get(`/public/statuses/${kind}`);
export const createStatus = (kind, data) => api.post(`/admin/statuses/${kind}`, data);
export const updateStatus = (kind, id, data) => api.patch(`/admin/statuses/${kind}/${id}`, data);
export const deleteStatus = (kind, id) => api.delete(`/admin/statuses/${kind}/${id}`);

export const getOrderCode = (id) => api.get(`/orders/${id}/code`);

// Issues — admin endpoints
export const getIssuesUnreadCount = () => api.get('/admin/issues/unread-count');
export const getAllIssues = (params) => api.get('/admin/issues', { params });
export const getIssue = (id) => api.get(`/admin/issues/${id}`);
export const addIssueMessage = (id, data) => api.post(`/admin/issues/${id}/messages`, data);
export const escalateIssue = (id, data) => api.post(`/admin/issues/${id}/escalate`, data);
export const closeIssue = (id) => api.patch(`/admin/issues/${id}/close`);
export const reopenIssue = (id) => api.patch(`/admin/issues/${id}/reopen`);

export const uploadChatAttachment = (orderId, file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post(`/chat/upload/${orderId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};

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
  getOrderFilterOptions: () => api.get('/sales/orders/filter-options'),
  updateOrderStatus: (id, data) => api.put(`/sales/orders/${id}/status`, data),
  assignTutors: (id, data) => api.put(`/sales/orders/${id}/assign`, data),
  reopenChat: (id) => api.put(`/sales/orders/${id}/reopen-chat`),
  markRemainingPaid: (orderId, data) => api.post(`/sales/orders/${orderId}/mark-remaining-paid`, data),
  createInstallmentPlan: (orderId, data) => api.post(`/sales/orders/${orderId}/installments`, data),
  updateInstallmentPlan: (orderId, data) => api.put(`/sales/orders/${orderId}/installments`, data),
  getInstallments: (orderId) => api.get(`/sales/orders/${orderId}/installments`),
  deleteInstallmentPlan: (orderId) => api.delete(`/sales/orders/${orderId}/installments`),
  markInstallmentPaid: (installmentId, data) => api.post(`/sales/installments/${installmentId}/mark-paid`, data),
  markAllInstallmentsPaid: (orderId, data) => api.post(`/sales/orders/${orderId}/installments/mark-all-paid`, data),
  getChats: () => api.get('/sales/chats'),
  getFlaggedMessages: () => api.get('/sales/chats/flagged'),
  getIssuesUnreadCount: () => api.get('/sales/issues/unread-count'),
  getAllIssues: (params) => api.get('/sales/issues', { params }),
  getIssue: (id) => api.get(`/sales/issues/${id}`),
  addIssueMessage: (id, data) => api.post(`/sales/issues/${id}/messages`, data),
  escalateIssue: (id, data) => api.post(`/sales/issues/${id}/escalate`, data),
  closeIssue: (id) => api.patch(`/sales/issues/${id}/close`),
  reopenIssue: (id) => api.patch(`/sales/issues/${id}/reopen`),
  getReports: (params) => api.get('/sales/reports', { params }),
  getReportsOverview: (params) => api.get('/sales/reports/overview', { params }),
  getTutorReport: (params) => api.get('/sales/reports/tutors', { params }),
  getUserReport: (params) => api.get('/sales/reports/users', { params }),
  getSettings: () => api.get('/sales/settings'),
  updateNotificationEmails: (data) => api.put('/sales/notification-emails', data),
  updatePlan: (id, data) => api.put(`/sales/plans/${id}`, data),
  createCoupon: (data) => api.post('/sales/coupons', data),
  deleteCoupon: (id) => api.delete(`/sales/coupons/${id}`),
  getNotifications: () => api.get('/sales/notifications'),
  markNotificationRead: (id) => api.put(`/sales/notifications/${id}/read`),
  getNotificationsFeed: () => api.get('/sales/notifications-feed'),
  getNotificationsFeedUnread: () => api.get('/sales/notifications-feed/unread-count'),
  markFeedNotificationRead: (id) => api.put(`/sales/notifications-feed/${id}/read`),
  markAllFeedNotificationsRead: () => api.put('/sales/notifications-feed/read-all'),
  getPricingRules: () => api.get('/sales/pricing-rules'),
  createPricingRule: (data) => api.post('/sales/pricing-rules', data),
  updatePricingRule: (id, data) => api.put(`/sales/pricing-rules/${id}`, data),
  deletePricingRule: (id) => api.delete(`/sales/pricing-rules/${id}`),
  updateUrgentFee: (data) => api.put('/sales/urgent-fee', data),
  getBannedWords: () => api.get('/sales/banned-words'),
  addBannedWord: (data) => api.post('/sales/banned-words', data),
  deleteBannedWord: (id) => api.delete(`/sales/banned-words/${id}`),
  getMyPermissions: () => api.get('/sales/my-permissions'),
};

export default api;
