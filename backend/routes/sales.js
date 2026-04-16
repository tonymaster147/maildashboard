const router = require('express').Router();
const adminController = require('../controllers/adminController');
const pricingController = require('../controllers/pricingController');
const { verifyToken, requireRole } = require('../middleware/auth');
const db = require('../config/db');

// All sales routes require sales_lead or sales_executive role
router.use(verifyToken, requireRole('sales_lead', 'sales_executive'));

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

// Users (if permitted)
router.get('/users', requirePermission('users'), adminController.getAllUsers);

// Tutors (if permitted)
router.get('/tutors', requirePermission('tutors'), adminController.getAllTutors);
router.post('/tutors', requirePermission('tutors'), adminController.createTutor);
router.put('/tutors/:id', requirePermission('tutors'), adminController.updateTutor);
router.delete('/tutors/:id', requirePermission('tutors'), adminController.deleteTutor);

// Orders (if permitted)
router.get('/orders', requirePermission('orders'), adminController.getAllOrders);
router.put('/orders/:id/status', requirePermission('orders'), adminController.updateOrderStatus);
router.put('/orders/:id/assign', requirePermission('orders'), adminController.assignTutors);
router.put('/orders/:id/reopen-chat', requirePermission('orders'), adminController.reopenChat);

// Chat monitoring (if permitted)
router.get('/chats', requirePermission('chats'), adminController.getAllChats);
router.get('/chats/flagged', requirePermission('chats'), adminController.getFlaggedMessages);

// Reports (if permitted)
router.get('/reports', requirePermission('reports'), adminController.getReports);

// Settings (if permitted)
router.get('/settings', requirePermission('settings'), adminController.getSettings);
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
router.put('/notifications/:id/read', adminController.markNotificationRead);

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
