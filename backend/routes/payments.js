const router = require('express').Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/auth');

router.post('/create-session', verifyToken, paymentController.createCheckoutSession);
router.post('/create-intent', verifyToken, paymentController.createPaymentIntent);
router.post('/create-remaining-intent', verifyToken, paymentController.createRemainingPaymentIntent);
router.post('/fulfill-intent', verifyToken, paymentController.fulfillPaymentIntent);
router.post('/pay-remaining', verifyToken, paymentController.payRemainingBalance);
router.get('/partial-eligibility', verifyToken, paymentController.checkPartialEligibility);
router.get('/history', verifyToken, paymentController.getPaymentHistory);
router.get('/verify', verifyToken, paymentController.verifyPayment);

module.exports = router;
