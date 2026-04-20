const router = require('express').Router();
const sitesController = require('../controllers/sitesController');
const { resolveSite } = require('../middleware/siteResolver');

// Public site branding — used by user frontend to brand auth pages per WordPress site
router.get('/site', resolveSite, sitesController.getPublicBranding);

module.exports = router;
