-- Human-friendly order identifier with format `{NICKNAME}{NNN}`.
--   - NICKNAME = the order's site.nickname sanitized to A–Z 0–9, uppercase.
--   - DFLT     = orders with no site_id.
--   - NNN      = zero-padded sequential number per prefix, min 3 digits.
--
-- A separate counter table avoids races on concurrent inserts: we lock the
-- row, increment, and use the value for the new code, all in one transaction.

ALTER TABLE orders
  ADD COLUMN order_code VARCHAR(20) DEFAULT NULL AFTER id,
  ADD UNIQUE KEY uq_orders_order_code (order_code);

CREATE TABLE IF NOT EXISTS order_code_counters (
  prefix VARCHAR(20) NOT NULL PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
