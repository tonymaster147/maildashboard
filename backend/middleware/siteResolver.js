const db = require('../config/db');

let cache = { list: null, ts: 0 };
const TTL_MS = 60 * 1000;

async function loadSites() {
  if (cache.list && Date.now() - cache.ts < TTL_MS) return cache.list;
  const [rows] = await db.query('SELECT id, site_key, name, nickname, logo_url, url, is_active FROM sites WHERE is_active = 1');
  cache.list = rows;
  cache.ts = Date.now();
  return rows;
}

function invalidateSiteCache() {
  cache = { list: null, ts: 0 };
}

function normalizeHost(urlStr) {
  if (!urlStr) return '';
  try {
    const u = new URL(urlStr);
    // Use host (hostname + port) so localhost:5176 is distinct from localhost:5173.
    // Default HTTP/HTTPS ports are dropped by URL parsing, so production matches still work.
    return u.host.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return String(urlStr).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/**
 * Resolve the originating WordPress site from Origin/Referer headers.
 * Attaches req.site = { id, site_key, name, url } or null if no match.
 */
async function resolveSite(req, res, next) {
  try {
    const originHeader = req.get('origin') || req.get('referer') || '';
    const host = normalizeHost(originHeader);
    if (!host) { req.site = null; return next(); }

    const sites = await loadSites();
    const match = sites.find(s => normalizeHost(s.url) === host);
    req.site = match || null;
  } catch (e) {
    console.error('resolveSite error:', e.message);
    req.site = null;
  }
  next();
}

module.exports = { resolveSite, invalidateSiteCache };
