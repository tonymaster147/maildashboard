const router = require('express').Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateTutor } = require('../middleware/validate');

// All admin routes require admin role
router.use(verifyToken, requireRole('admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/toggle-status', adminController.toggleUserStatus);

// Tutor management
router.get('/tutors', adminController.getAllTutors);
router.post('/tutors', validateTutor, adminController.createTutor);
router.put('/tutors/:id', adminController.updateTutor);
router.delete('/tutors/:id', adminController.deleteTutor);

// Order management
router.get('/orders', adminController.getAllOrders);
router.put('/orders/:id/status', adminController.updateOrderStatus);
router.put('/orders/:id/assign', adminController.assignTutors);
router.put('/orders/:id/reopen-chat', adminController.reopenChat);

// Chat monitoring
router.get('/chats', adminController.getAllChats);
router.get('/chats/flagged', adminController.getFlaggedMessages);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/plans/:id', adminController.updatePlan);
router.post('/coupons', adminController.createCoupon);
router.delete('/coupons/:id', adminController.deleteCoupon);

// Notifications
router.get('/notifications', adminController.getNotifications);
router.put('/notifications/:id/read', adminController.markNotificationRead);

// Reports
router.get('/reports', adminController.getReports);

// Banned Words
router.get('/banned-words', adminController.getBannedWords);
router.post('/banned-words', adminController.addBannedWord);
router.delete('/banned-words/:id', adminController.deleteBannedWord);

// Sales User management
router.get('/sales-users', adminController.getAllSalesUsers);
router.post('/sales-users', adminController.createSalesUser);
router.put('/sales-users/:id', adminController.updateSalesUser);
router.delete('/sales-users/:id', adminController.deleteSalesUser);
router.get('/sales-users/:id/permissions', adminController.getSalesPermissions);

module.exports = router;
