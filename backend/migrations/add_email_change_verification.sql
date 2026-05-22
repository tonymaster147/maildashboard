-- Holds an in-flight email change for a user. Cleared on success or expiry.
ALTER TABLE users
  ADD COLUMN pending_email VARCHAR(255) DEFAULT NULL AFTER signup_ip,
  ADD COLUMN email_change_code VARCHAR(10) DEFAULT NULL AFTER pending_email,
  ADD COLUMN email_change_expires_at TIMESTAMP NULL DEFAULT NULL AFTER email_change_code;
