const router = require('express').Router();
const fileController = require('../controllers/fileController');
const { verifyToken } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

router.post('/upload', verifyToken, uploadLimiter, upload.array('files', 10), handleUploadError, fileController.uploadFiles);
router.get('/order/:orderId', verifyToken, fileController.getOrderFiles);
router.delete('/:id', verifyToken, fileController.deleteFile);

module.exports = router;
