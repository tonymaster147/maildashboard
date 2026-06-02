// Race-safe allocator for orders.order_code = `{prefix}{NNN}`.
//   prefix = sanitized uppercase site nickname; 'DFLT' when no site.
//   Counter is stored in order_code_counters and incremented inside a
//   transaction with row-level locking (FOR UPDATE) so concurrent inserts
//   never collide.

const db = require('../config/db');

function sanitizePrefix(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'DFLT';
}

async function resolvePrefix(siteId) {
  if (!siteId) return 'DFLT';
  const [rows] = await db.query('SELECT nickname FROM sites WHERE id = ?', [siteId]);
  return sanitizePrefix(rows[0]?.nickname);
}

/**
 * Generate the next order_code for a given site_id (nullable).
 * Returns the formatted code, e.g. "MMT013".
 */
async function nextOrderCode(siteId) {
  const prefix = await resolvePrefix(siteId);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Seed row if missing (no-op if exists), then lock and increment
    await conn.query(
      'INSERT INTO order_code_counters (prefix, last_number) VALUES (?, 0) ON DUPLICATE KEY UPDATE last_number = last_number',
      [prefix]
    );
    const [rows] = await conn.query('SELECT last_number FROM order_code_counters WHERE prefix = ? FOR UPDATE', [prefix]);
    const next = (rows[0]?.last_number || 0) + 1;
    await conn.query('UPDATE order_code_counters SET last_number = ? WHERE prefix = ?', [next, prefix]);
    await conn.commit();
    return `${prefix}${String(next).padStart(3, '0')}`;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Lookup the existing order_code for an id. Falls back to `#<id>` if the
 * order is missing or pre-dates the order_code backfill. Used to build email
 * subjects, notifications, Stripe charge descriptions — anywhere we want the
 * human-friendly code in user-facing copy.
 */
async function formatOrderRef(orderId) {
  if (!orderId) return '#?';
  const [rows] = await db.query('SELECT order_code FROM orders WHERE id = ?', [orderId]);
  return rows[0]?.order_code || `#${orderId}`;
}

module.exports = { nextOrderCode, formatOrderRef };
