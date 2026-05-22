/**
 * Resolve the public-facing IP for a request and look up its country
 * via the free ip-api.com service. Falls back gracefully on errors.
 */

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.connection?.remoteAddress || null;
}

function normalizeIp(ip) {
  if (!ip) return null;
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}

async function lookupGeo(ip) {
  if (!ip || isPrivateIp(ip)) return { country: null, countryCode: null };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { country: null, countryCode: null };
    const data = await res.json();
    if (data.status === 'success') {
      return { country: data.country || null, countryCode: data.countryCode || null };
    }
    return { country: null, countryCode: null };
  } catch (err) {
    console.warn('[geoip] lookup failed:', err.message);
    return { country: null, countryCode: null };
  }
}

async function lookupCountry(ip) {
  const { country } = await lookupGeo(ip);
  return country;
}

module.exports = { getClientIp, normalizeIp, lookupCountry, lookupGeo };
