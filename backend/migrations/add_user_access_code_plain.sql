-- Reversibly-encrypted copy of the user's access code, so admin/sales can
-- view it (the `access_code` column stays a one-way bcrypt hash used for
-- login). Encrypted with AES-256-GCM via utils/crypto (encryptSecret), keyed
-- off SITE_SECRET_KEY/JWT_SECRET. NULL for users created before this feature
-- (their original code is unrecoverable until reset).

ALTER TABLE users
  ADD COLUMN access_code_plain VARCHAR(255) NULL AFTER access_code;
