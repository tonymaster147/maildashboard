-- Timestamp of the last time the user updated the school login details for
-- this order. Drives the "Login details updated on {date}" indicator that
-- admin/sales/tutor see, and triggers the email notification flow.
ALTER TABLE orders
  ADD COLUMN login_updated_at TIMESTAMP NULL DEFAULT NULL AFTER school_password;
