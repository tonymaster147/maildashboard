const router = require('express').Router();
const chatController = require('../controllers/chatController');
const { verifyToken } = require('../middleware/auth');
const { validateMessage } = require('../middleware/validate');

router.get('/messages/:orderId', verifyToken, chatController.getMessages);
router.post('/send', verifyToken, validateMessage, chatController.sendMessage);
router.get('/unread', verifyToken, chatController.getUnreadCount);
router.post('/mark-all-read', verifyToken, chatController.markAllRead);
router.get('/unread-per-order', verifyToken, chatController.getUnreadPerOrder);

module.exports = router;
