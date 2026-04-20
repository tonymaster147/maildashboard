const router = require('express').Router();
const orderController = require('../controllers/orderController');
const pricingController = require('../controllers/pricingController');
const { verifyToken } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validate');
const { resolveSite } = require('../middleware/siteResolver');

router.get('/types', orderController.getOrderTypes);
router.get('/subjects', orderController.getSubjects);
router.get('/education-levels', orderController.getEducationLevels);
router.get('/plans', orderController.getPlans);
router.post('/calculate-price', verifyToken, pricingController.calculatePrice);
router.post('/validate-coupon', verifyToken, orderController.validateCoupon);
router.post('/draft', verifyToken, resolveSite, orderController.createDraftOrder);
router.put('/draft/:id', verifyToken, orderController.updateDraftOrder);
router.post('/', verifyToken, validateOrder, orderController.createOrder);
router.get('/', verifyToken, orderController.getUserOrders);
router.get('/:id', verifyToken, orderController.getOrderDetail);

module.exports = router;
