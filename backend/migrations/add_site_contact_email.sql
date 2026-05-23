-- Per-site public contact email shown to users on the Order Details page.
-- Distinct from from_email (used as the SMTP envelope sender).
ALTER TABLE sites
  ADD COLUMN contact_email VARCHAR(255) DEFAULT NULL AFTER from_email;
