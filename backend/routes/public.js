const router = require('express').Router();
const sitesController = require('../controllers/sitesController');
const statusesController = require('../controllers/statusesController');
const { resolveSite } = require('../middleware/siteResolver');
const { getClientIp, normalizeIp, lookupGeo } = require('../utils/geoip');

// Public site branding — used by user frontend to brand auth pages per WordPress site
router.get('/site', resolveSite, sitesController.getPublicBranding);

// Public geo lookup — used to auto-select phone country code on signup
router.get('/geo', async (req, res) => {
  try {
    const ip = normalizeIp(getClientIp(req));
    const geo = await lookupGeo(ip);
    res.json({ ip, country: geo.country, countryCode: geo.countryCode });
  } catch (err) {
    res.json({ ip: null, country: null, countryCode: null });
  }
});

// Public read-only status list (active only). Used by admin/tutor frontends
// to populate filter chips and dropdowns. :kind = 'admin' | 'tutor'.
router.get('/statuses/:kind', statusesController.list);

module.exports = router;
