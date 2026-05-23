-- Required note when an order is cancelled. Captured at the moment admin/sales
-- flips admin_status to 'cancelled'.
ALTER TABLE orders
  ADD COLUMN cancellation_note TEXT DEFAULT NULL AFTER tutor_status_id;
