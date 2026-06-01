-- Chat attachments: each chat row may carry one file (WhatsApp-style: text-only
-- OR file-only, never combined). Files live on Google Drive under a per-order
-- subfolder; we store the drive id so we can delete or re-link later.
ALTER TABLE chats
  ADD COLUMN attachment_url      VARCHAR(500) DEFAULT NULL AFTER message,
  ADD COLUMN attachment_name     VARCHAR(255) DEFAULT NULL AFTER attachment_url,
  ADD COLUMN attachment_mime     VARCHAR(100) DEFAULT NULL AFTER attachment_name,
  ADD COLUMN attachment_size     INT          DEFAULT NULL AFTER attachment_mime,
  ADD COLUMN attachment_drive_id VARCHAR(255) DEFAULT NULL AFTER attachment_size,
  MODIFY COLUMN message TEXT NULL;
