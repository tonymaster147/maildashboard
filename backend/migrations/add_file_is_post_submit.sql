-- Flag for files added AFTER the initial order submission. Used by all
-- panels (user/tutor/admin/sales) to render an "Added later" label so it's
-- obvious which files came in with the original order vs. uploaded later.
ALTER TABLE files
  ADD COLUMN is_post_submit TINYINT(1) DEFAULT 0;

-- Backfill heuristic: any user-uploaded file created > 30 seconds after its
-- order was created is treated as a post-submission upload. Tutor and admin
-- uploads are inherently post-submission, but they're already distinguished
-- by uploaded_by_role so we don't flag them.
UPDATE files f
  JOIN orders o ON f.order_id = o.id
  SET f.is_post_submit = 1
  WHERE f.uploaded_by_role = 'user'
    AND TIMESTAMPDIFF(SECOND, o.created_at, f.created_at) > 30;
