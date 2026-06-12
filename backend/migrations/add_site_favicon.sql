-- Per-site favicon (mirrors logo_url). Uploaded from the admin Sites form;
-- the student frontend swaps the browser tab icon to this when the site
-- branding resolves. NULL = keep the default favicon.

ALTER TABLE sites
  ADD COLUMN favicon_url VARCHAR(500) NULL AFTER logo_url;
