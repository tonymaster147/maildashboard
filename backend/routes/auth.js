const router = require('express').Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { validateSignup, validateLogin, validateAdminLogin, validateTutorLogin } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/signup', authLimiter, validateSignup, authController.signup);
router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/admin/login', authLimiter, validateAdminLogin, authController.adminLogin);
router.post('/tutor/login', authLimiter, validateTutorLogin, authController.tutorLogin);
router.post('/sales/login', authLimiter, validateTutorLogin, authController.salesLogin);
router.post('/forgot-access-code', authLimiter, authController.forgotAccessCode);
router.put('/change-password', verifyToken, authController.changePassword);
router.get('/profile', verifyToken, authController.getProfile);

module.exports = router;
