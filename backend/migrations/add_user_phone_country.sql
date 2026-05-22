-- Add phone, country and signup IP to users table
ALTER TABLE users
  ADD COLUMN phone VARCHAR(30) DEFAULT NULL AFTER email,
  ADD COLUMN country VARCHAR(100) DEFAULT NULL AFTER phone,
  ADD COLUMN signup_ip VARCHAR(45) DEFAULT NULL AFTER country;
