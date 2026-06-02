const router = require('express').Router();
const ctrl = require('../controllers/issuesController');
const { verifyToken } = require('../middleware/auth');

// User-side endpoints. List/create/detail/reply all gated by verifyToken;
// the controller does ownership + staff checks per route.
router.get('/categories', verifyToken, (req, res) => res.json({ categories: ctrl.ALLOWED_CATEGORIES }));
router.get('/unread-count', verifyToken, ctrl.unreadCount);
router.get('/', verifyToken, ctrl.listMyIssues);
router.post('/', verifyToken, ctrl.createIssue);
router.get('/:id', verifyToken, ctrl.getIssueDetail);
router.post('/:id/messages', verifyToken, ctrl.addMessage);

module.exports = router;
