-- Full name captured at signup (required at app layer; column nullable for
-- legacy rows that pre-date this field).
ALTER TABLE users
  ADD COLUMN name VARCHAR(255) DEFAULT NULL AFTER username;
