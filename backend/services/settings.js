// Global app settings — thin key-value accessor over the `app_settings` table
// with a short in-memory cache so hot paths (every order/issue email) don't hit
// the DB each time. Writes update the cache immediately.

const db = require('../config/db');

// Fallback used when the table/row is missing (fresh DB, pre-migration, or a
// transient DB error) so notifications never silently lose their recipient.
const DEFAULT_ADMIN_EMAILS = 'faruqui.a4u@gmail.com';

const TTL_MS = 30_000;
const cache = new Map(); // key -> { value, ts }

async function getSetting(key, fallback = null) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.value;
  try {
    const [rows] = await db.query('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
    const value = rows.length ? rows[0].setting_value : fallback;
    cache.set(key, { value, ts: Date.now() });
    return value;
  } catch (e) {
    console.error(`getSetting(${key}) failed:`, e.message);
    return fallback;
  }
}

async function setSetting(key, value) {
  await db.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value]
  );
  cache.set(key, { value, ts: Date.now() });
}

// Parse a comma/semicolon/newline separated string into a clean, deduped list.
function parseEmailList(raw) {
  return [...new Set(
    String(raw || '')
      .split(/[,;\n]/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  )];
}

// Admin notification recipients as an array (one or many).
async function getAdminEmails() {
  const raw = await getSetting('admin_notification_emails', DEFAULT_ADMIN_EMAILS);
  const list = parseEmailList(raw);
  return list.length ? list : parseEmailList(DEFAULT_ADMIN_EMAILS);
}

module.exports = { getSetting, setSetting, getAdminEmails, parseEmailList, DEFAULT_ADMIN_EMAILS };
