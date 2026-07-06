const router = require('express').Router();
const tutorController = require('../controllers/tutorController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// All tutor routes require tutor role
router.use(verifyToken, requireRole('tutor'));

router.get('/tasks', tutorController.getTasks);
router.get('/tasks/:id', tutorController.getTaskDetail);
router.put('/tasks/:id/complete', tutorController.completeTask);
router.patch('/tasks/:id/status', tutorController.updateTutorStatus);
router.post('/tasks/:id/upload', upload.array('files', 10), handleUploadError, tutorController.uploadWorkFiles);
router.get('/notifications', tutorController.getNotifications);

// Escalations — support tickets escalated to this tutor
const issuesController = require('../controllers/issuesController');
router.get('/escalations', issuesController.listTutorEscalations);
router.get('/escalations/unread-count', issuesController.unreadCount);
router.get('/escalations/:id', issuesController.getIssueDetail);
router.post('/escalations/:id/messages', issuesController.addMessage);

// Notification feed (bell panel) — role-aware, mirrors the student feed
const staffNotifications = require('../controllers/staffNotificationsController');
router.get('/notifications-feed', staffNotifications.list);
router.get('/notifications-feed/unread-count', staffNotifications.unreadCount);
router.put('/notifications-feed/read-all', staffNotifications.markAllRead);
router.put('/notifications-feed/:id/read', staffNotifications.markRead);


module.exports = router;
