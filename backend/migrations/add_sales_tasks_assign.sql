-- Assignable + general sales tasks, and per-sales-user notifications.
--
-- sales_user_id becomes nullable so a task can be GENERAL (is_general=1,
-- sales_user_id NULL) — visible on every sales dashboard, anyone can act.
-- is_assigned=1 marks a reminder an admin handed to one specific person, which
-- removes it from every other sales person's team view.

ALTER TABLE sales_tasks
  MODIFY COLUMN sales_user_id INT NULL,
  ADD COLUMN is_general TINYINT(1) NOT NULL DEFAULT 0 AFTER sales_user_id,
  ADD COLUMN is_assigned TINYINT(1) NOT NULL DEFAULT 0 AFTER is_general;

-- Per-sales-user targeting for the staff notification feed. NULL = role
-- broadcast (existing behaviour); a value = that one sales person only.
ALTER TABLE notifications
  ADD COLUMN sales_user_id INT NULL AFTER tutor_id,
  ADD INDEX idx_notif_sales_user (sales_user_id);
