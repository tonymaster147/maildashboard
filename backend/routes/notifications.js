const router = require('express').Router();
const ctrl = require('../controllers/userNotificationsController');
const { verifyToken } = require('../middleware/auth');

// Student notification feed (bell panel). All routes scoped to the
// authenticated user — controller filters by req.user.id.
router.get('/', verifyToken, ctrl.list);
router.get('/unread-count', verifyToken, ctrl.unreadCount);
router.put('/read-all', verifyToken, ctrl.markAllRead);
router.put('/:id/read', verifyToken, ctrl.markRead);

module.exports = router;
