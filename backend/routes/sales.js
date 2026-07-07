const router = require('express').Router();
const adminController = require('../controllers/adminController');
const issuesController = require('../controllers/issuesController');
const pricingController = require('../controllers/pricingController');
const { verifyToken, requireRole, attachSalesWindow } = require('../middleware/auth');
const db = require('../config/db');

// All sales routes require sales_lead or sales_executive role.
// attachSalesWindow sets req.salesCutoff (60-day window for sales_executive).
router.use(verifyToken, requireRole('sales_lead', 'sales_executive'), attachSalesWindow);

// Block direct access to an order older than a sales_executive's window.
// Handles :id, :order_id, and :installment_id (resolved to its order).
const guardOrderWindow = async (req, res, next) => {
  if (!req.salesCutoff) return next();
  try {
    let orderId = req.params.id || req.params.order_id;
    if (!orderId && req.params.installment_id) {
      const [r] = await db.query('SELECT order_id FROM order_installments WHERE id = ?', [req.params.installment_id]);
      orderId = r.length ? r[0].order_id : null;
    }
    if (!orderId) return next();
    const [rows] = await db.query('SELECT created_at FROM orders WHERE id = ?', [orderId]);
    if (rows.length && new Date(rows[0].created_at) < req.salesCutoff) {
      return res.status(403).json({ error: `This order is outside your ${req.salesWindowDays}-day access window.` });
    }
    next();
  } catch (e) {
    console.error('guardOrderWindow error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// Block direct access to an issue older than the window.
const guardIssueWindow = async (req, res, next) => {
  if (!req.salesCutoff) return next();
  try {
    const [rows] = await db.query('SELECT created_at FROM issues WHERE id = ?', [req.params.id]);
    if (rows.length && new Date(rows[0].created_at) < req.salesCutoff) {
      return res.status(403).json({ error: `This issue is outside your ${req.salesWindowDays}-day access window.` });
    }
    next();
  } catch (e) {
    console.error('guardIssueWindow error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// Middleware to check if the sales user has permission for a specific menu
const requirePermission = (menuKey) => {
  return async (req, res, next) => {
    try {
      const [perms] = await db.query(
        'SELECT id FROM sales_permissions WHERE sales_user_id = ? AND menu_key = ? AND is_allowed = 1',
        [req.user.id, menuKey]
      );
      if (perms.length === 0) {
        return res.status(403).json({ error: 'You do not have permission to access this feature.' });
      }
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

// Dashboard (if permitted)
router.get('/dashboard', requirePermission('dashboard'), adminController.getDashboardStats);

// Sales dashboard — payment-reminder calendar, to-dos, needs-attention, recent orders
const salesDash = require('../controllers/salesDashboardController');
router.get('/dashboard-summary', requirePermission('dashboard'), salesDash.getSummary);
router.get('/tasks',             requirePermission('dashboard'), salesDash.getCalendar);
router.post('/tasks',            requirePermission('dashboard'), salesDash.createTask);
router.post('/tasks/status',     requirePermission('dashboard'), salesDash.setStatus);
router.post('/tasks/collect-payment', requirePermission('dashboard'), salesDash.collectPayment);
router.post('/tasks/comment',    requirePermission('dashboard'), salesDash.addComment);
router.post('/tasks/snooze',     requirePermission('dashboard'), salesDash.snooze);
router.delete('/tasks/:id',      requirePermission('dashboard'), salesDash.deleteTask);
router.get('/recent-orders',     requirePermission('dashboard'), salesDash.getRecentOrders);

// Users (if permitted)
router.get('/users', requirePermission('users'), adminController.getAllUsers);

// Tutors (if permitted)
router.get('/tutors', requirePermission('tutors'), adminController.getAllTutors);
router.post('/tutors', requirePermission('tutors'), adminController.createTutor);
router.put('/tutors/:id', requirePermission('tutors'), adminController.updateTutor);
router.delete('/tutors/:id', requirePermission('tutors'), adminController.deleteTutor);

// Orders (if permitted)
router.get('/orders', requirePermission('orders'), adminController.getAllOrders);
router.get('/orders/filter-options', requirePermission('orders'), adminController.getOrderFilterOptions);
router.put('/orders/:id/status', requirePermission('orders'), guardOrderWindow, adminController.updateOrderStatus);
router.put('/orders/:id/assign', requirePermission('orders'), guardOrderWindow, adminController.assignTutors);
router.put('/orders/:id/reopen-chat', requirePermission('orders'), guardOrderWindow, adminController.reopenChat);

// Installment plan management (orders permission)
const paymentController = require('../controllers/paymentController');
const installmentsController = require('../controllers/installmentsController');
router.post('/orders/:order_id/mark-remaining-paid', requirePermission('orders'), guardOrderWindow, paymentController.markRemainingPaid);
router.post('/orders/:id/installments', requirePermission('orders'), guardOrderWindow, installmentsController.createInstallmentPlan);
router.put('/orders/:id/installments', requirePermission('orders'), guardOrderWindow, installmentsController.updateInstallmentPlan);
router.get('/orders/:id/installments', requirePermission('orders'), guardOrderWindow, installmentsController.getInstallments);
router.delete('/orders/:id/installments', requirePermission('orders'), guardOrderWindow, installmentsController.deleteInstallmentPlan);
router.post('/installments/:installment_id/mark-paid', requirePermission('orders'), guardOrderWindow, installmentsController.markInstallmentPaid);
router.post('/orders/:id/installments/mark-all-paid', requirePermission('orders'), guardOrderWindow, installmentsController.markAllInstallmentsPaid);

// Chat monitoring (if permitted)
router.get('/chats', requirePermission('chats'), adminController.getAllChats);
router.get('/chats/flagged', requirePermission('chats'), adminController.getFlaggedMessages);

// Reports (if permitted)
router.get('/reports', requirePermission('reports'), adminController.getReports);
// Detailed reporting suite (overview / tutors / customers)
const reportsController = require('../controllers/reportsController');
router.get('/reports/overview', requirePermission('reports'), reportsController.overview);
router.get('/reports/tutors', requirePermission('reports'), reportsController.tutorReport);
router.get('/reports/users', requirePermission('reports'), reportsController.userReport);

// Settings (if permitted)
router.get('/settings', requirePermission('settings'), adminController.getSettings);
router.put('/notification-emails', requirePermission('settings'), adminController.updateNotificationEmails);
router.put('/plans/:id', requirePermission('settings'), adminController.updatePlan);
router.post('/coupons', requirePermission('settings'), adminController.createCoupon);
router.delete('/coupons/:id', requirePermission('settings'), adminController.deleteCoupon);

// Pricing rules (if settings permitted)
router.get('/pricing-rules', requirePermission('settings'), pricingController.getPricingRules);
router.post('/pricing-rules', requirePermission('settings'), pricingController.createPricingRule);
router.put('/pricing-rules/:id', requirePermission('settings'), pricingController.updatePricingRule);
router.delete('/pricing-rules/:id', requirePermission('settings'), pricingController.deletePricingRule);
router.put('/urgent-fee', requirePermission('settings'), pricingController.updateUrgentFee);

// Notifications — always allowed for sales users
router.get('/notifications', adminController.getNotifications);
// Notification feed (bell panel) — role-aware, mirrors the student feed
const staffNotifications = require('../controllers/staffNotificationsController');
router.get('/notifications-feed', staffNotifications.list);
router.get('/notifications-feed/unread-count', staffNotifications.unreadCount);
router.put('/notifications-feed/read-all', staffNotifications.markAllRead);
router.put('/notifications-feed/:id/read', staffNotifications.markRead);

router.put('/notifications/:id/read', adminController.markNotificationRead);

// Issues
router.get('/issues/unread-count',  requirePermission('issues'), issuesController.unreadCount);
router.get('/issues',               requirePermission('issues'), issuesController.listAllIssues);
router.get('/issues/:id',           requirePermission('issues'), guardIssueWindow, issuesController.getIssueDetail);
router.post('/issues/:id/messages', requirePermission('issues'), guardIssueWindow, issuesController.addMessage);
router.post('/issues/:id/escalate', requirePermission('issues'), guardIssueWindow, issuesController.escalateToTutor);
router.patch('/issues/:id/close',   requirePermission('issues'), guardIssueWindow, issuesController.closeIssue);
router.patch('/issues/:id/reopen',  requirePermission('issues'), guardIssueWindow, issuesController.reopenIssue);

// Banned Words (if settings permitted)
router.get('/banned-words', requirePermission('settings'), adminController.getBannedWords);
router.post('/banned-words', requirePermission('settings'), adminController.addBannedWord);
router.delete('/banned-words/:id', requirePermission('settings'), adminController.deleteBannedWord);

// Get own permissions (always allowed)
router.get('/my-permissions', async (req, res) => {
  try {
    const [perms] = await db.query(
      'SELECT menu_key FROM sales_permissions WHERE sales_user_id = ? AND is_allowed = 1',
      [req.user.id]
    );
    res.json({ permissions: perms.map(p => p.menu_key) });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
