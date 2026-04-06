
-- Migration: Add channel column to chats table
-- Enables 2-way separated chats:
--   channel='tutor'   → User <-> Tutor
--   channel='support'  → User <-> Admin/Sales

ALTER TABLE chats ADD COLUMN channel ENUM('tutor', 'support') NOT NULL DEFAULT 'support' AFTER sender_role;

-- Backfill: tutor messages belong to 'tutor' channel
UPDATE chats SET channel = 'tutor' WHERE sender_role = 'tutor';

-- Backfill: admin/sales messages belong to 'support' channel (already default)
-- User messages default to 'support' (old messages before channel separation)
