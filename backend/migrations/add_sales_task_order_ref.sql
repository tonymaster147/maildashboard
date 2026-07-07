-- Allow order-level payment reminders (unpaid / partial orders without an
-- installment plan) on the sales calendar. Adds 'order' to the ref_type enum.
ALTER TABLE sales_tasks
  MODIFY COLUMN ref_type ENUM('manual','installment','partial','unpaid','paid','order') NOT NULL DEFAULT 'manual';
