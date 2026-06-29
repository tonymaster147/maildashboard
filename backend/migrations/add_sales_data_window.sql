-- Per-sales-executive data window. A sales_executive can only see records
-- (orders, users, issues, chats, reports) created within the last
-- `data_window_days` days; older data is hidden from lists AND blocked on
-- direct access. Sales leads and admins are unrestricted (column ignored).
-- Default 60 days.

ALTER TABLE sales_users
  ADD COLUMN data_window_days INT NOT NULL DEFAULT 60 AFTER role;
