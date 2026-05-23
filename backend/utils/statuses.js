// In-memory cache of status code → id mappings. Refreshed on startup and
// whenever Settings adds/edits a status row. Code lookups must be O(1) since
// most controllers touch them.

const db = require('../config/db');

const cache = { admin: new Map(), tutor: new Map() };
let loaded = false;

async function load() {
  const [adm] = await db.query('SELECT id, code FROM admin_statuses');
  const [tut] = await db.query('SELECT id, code FROM tutor_statuses');
  cache.admin.clear();
  cache.tutor.clear();
  adm.forEach(r => cache.admin.set(r.code, r.id));
  tut.forEach(r => cache.tutor.set(r.code, r.id));
  loaded = true;
}

async function ensureLoaded() { if (!loaded) await load(); }

async function adminId(code) { await ensureLoaded(); return cache.admin.get(code) || null; }
async function tutorId(code) { await ensureLoaded(); return cache.tutor.get(code) || null; }
function invalidate() { loaded = false; }

/**
 * Promote a partial-payment admin status to the full-payment counterpart once a
 * remaining balance is cleared. Preserves the assigned/unassigned axis.
 * No-op for orders not in a `paid_partial_*` state (already full, completed,
 * cancelled, etc).
 */
async function promotePartialToFullIfCleared(orderId, conn = null) {
  await ensureLoaded();
  const runner = conn || require('../config/db');
  const [rows] = await runner.query(
    `SELECT a.code AS admin_code
       FROM orders o
       LEFT JOIN admin_statuses a ON o.admin_status_id = a.id
      WHERE o.id = ?`,
    [orderId]
  );
  if (rows.length === 0) return;
  const current = rows[0].admin_code;
  const map = {
    paid_partial_unassigned: 'paid_full_unassigned',
    paid_partial_assigned:   'paid_full_assigned'
  };
  const nextCode = map[current];
  if (!nextCode) return;
  const nextId = cache.admin.get(nextCode);
  if (!nextId) return;
  await runner.query('UPDATE orders SET admin_status_id = ? WHERE id = ?', [nextId, orderId]);
}

module.exports = { load, ensureLoaded, adminId, tutorId, invalidate, promotePartialToFullIfCleared };
