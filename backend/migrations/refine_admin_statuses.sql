-- Refine admin_statuses to a 2×2 of payment × assignment, plus the terminal
-- states (Unpaid / Paid and Completed / Cancelled).
--
-- New built-in set:
--   unpaid                    Unpaid
--   paid_partial_unassigned   Paid - Partial (Not Assigned)
--   paid_full_unassigned      Paid - Full (Not Assigned)
--   paid_partial_assigned     Paid - Partial (Assigned)
--   paid_full_assigned        Paid - Full (Assigned)
--   paid_completed            Paid and Completed
--   cancelled                 Cancelled

UPDATE admin_statuses SET code='paid_partial_unassigned', name='Paid - Partial (Not Assigned)', sort_order=20 WHERE code='paid_partial';
UPDATE admin_statuses SET code='paid_full_unassigned',    name='Paid - Full (Not Assigned)',    sort_order=30 WHERE code='paid_full';
UPDATE admin_statuses SET code='paid_full_assigned',      name='Paid - Full (Assigned)',        sort_order=50 WHERE code='paid_assigned';

INSERT IGNORE INTO admin_statuses (code, name, sort_order, is_builtin)
  VALUES ('paid_partial_assigned', 'Paid - Partial (Assigned)', 40, 1);

UPDATE admin_statuses SET sort_order=10 WHERE code='unpaid';
UPDATE admin_statuses SET sort_order=60 WHERE code='paid_completed';
UPDATE admin_statuses SET sort_order=70 WHERE code='cancelled';

-- Backfill orders previously on paid_unassigned, splitting by payment_type
UPDATE orders o
  JOIN admin_statuses old_a ON o.admin_status_id = old_a.id AND old_a.code = 'paid_unassigned'
  JOIN admin_statuses new_a ON new_a.code = CASE WHEN o.payment_type = 'partial' THEN 'paid_partial_unassigned' ELSE 'paid_full_unassigned' END
  SET o.admin_status_id = new_a.id;

-- Re-point assigned partial-payment orders to the new combined code
UPDATE orders o
  JOIN admin_statuses old_a ON o.admin_status_id = old_a.id AND old_a.code = 'paid_full_assigned'
  JOIN admin_statuses new_a ON new_a.code = 'paid_partial_assigned'
  SET o.admin_status_id = new_a.id
  WHERE o.payment_type = 'partial';

-- Retire the obsolete row (orders no longer reference it)
DELETE FROM admin_statuses WHERE code = 'paid_unassigned';
