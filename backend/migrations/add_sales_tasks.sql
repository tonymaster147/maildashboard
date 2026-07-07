-- Sales task / payment-reminder calendar.
--
-- One row per calendar item OWNED by a single sales person. Two kinds of rows:
--   1. Manual to-dos / follow-ups the sales person adds (ref_type='manual').
--   2. Materialized payment reminders — created the first time a sales person
--      acts on a live installment reminder (ref_type='installment', ref_id =
--      order_installments.id). Un-touched reminders are shown live from
--      order_installments and are NOT stored here until acted on.
--
-- `category` drives the calendar colour; `status` is the sales-side workflow
-- state (separate from whether the payment itself is paid).

CREATE TABLE IF NOT EXISTS sales_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sales_user_id INT NOT NULL,
  order_id INT DEFAULT NULL,
  ref_type ENUM('manual','installment','partial','unpaid','paid','order') NOT NULL DEFAULT 'manual',
  ref_id INT DEFAULT NULL,
  category ENUM('installment','partial','unpaid','paid','todo') NOT NULL DEFAULT 'todo',
  title VARCHAR(255) NOT NULL,
  student_name VARCHAR(150) DEFAULT NULL,
  amount DECIMAL(10,2) DEFAULT NULL,
  due_date DATE NOT NULL,
  status ENUM('pending','in_progress','done') NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_by_id INT DEFAULT NULL,
  created_by_role VARCHAR(30) DEFAULT NULL,
  created_by_name VARCHAR(150) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Manual rows have ref_id NULL; MySQL treats NULLs as distinct, so many
  -- manual tasks per user are allowed. Materialized reminders dedupe per user.
  UNIQUE KEY uniq_sales_ref (sales_user_id, ref_type, ref_id),
  INDEX idx_user_due (sales_user_id, due_date),
  INDEX idx_status (status),
  FOREIGN KEY (sales_user_id) REFERENCES sales_users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales_task_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  author_id INT DEFAULT NULL,
  author_role VARCHAR(30) DEFAULT NULL,
  author_name VARCHAR(150) DEFAULT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_task (task_id),
  FOREIGN KEY (task_id) REFERENCES sales_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
