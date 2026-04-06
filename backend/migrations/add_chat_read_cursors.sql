
-- Migration: Add chat_read_cursors table for per-user read tracking
-- This replaces the shared is_read flag to support 2-way chat channels:
--   User <-> Admin/Sales
--   User <-> Tutor
-- Run this on existing databases.

CREATE TABLE IF NOT EXISTS chat_read_cursors (
  order_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(20) NOT NULL,
  last_read_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (order_id, user_id, role),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Seed cursors from existing is_read data so old "read" messages stay read.
-- For users: create cursor at the latest read message time per order
INSERT IGNORE INTO chat_read_cursors (order_id, user_id, role, last_read_at)
SELECT c.order_id, o.user_id, 'user', MAX(c.created_at)
FROM chats c
JOIN orders o ON c.order_id = o.id
WHERE c.sender_role != 'user' AND c.is_read = 1
GROUP BY c.order_id, o.user_id;

-- For tutors: cursor at latest read user-message time per order
INSERT IGNORE INTO chat_read_cursors (order_id, user_id, role, last_read_at)
SELECT c.order_id, ot.tutor_id, 'tutor', MAX(c.created_at)
FROM chats c
JOIN order_tutors ot ON c.order_id = ot.order_id
WHERE c.sender_role = 'user' AND c.is_read = 1
GROUP BY c.order_id, ot.tutor_id;
