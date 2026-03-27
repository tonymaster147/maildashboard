const router = require('express').Router();
const tutorController = require('../controllers/tutorController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// All tutor routes require tutor role
router.use(verifyToken, requireRole('tutor'));

router.get('/tasks', tutorController.getTasks);
router.get('/tasks/:id', tutorController.getTaskDetail);
router.put('/tasks/:id/complete', tutorController.completeTask);
router.post('/tasks/:id/upload', upload.array('files', 10), handleUploadError, tutorController.uploadWorkFiles);
router.get('/notifications', tutorController.getNotifications);

module.exports = router;
