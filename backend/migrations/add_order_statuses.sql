-- Two-axis status model:
--   admin_statuses → financial / operational state, managed by sales/admin
--   tutor_statuses → work progress, managed by tutor
-- Both are stored on orders as FK ids. Display labels (`name`) are editable
-- from Settings; automation references the stable `code`.

CREATE TABLE IF NOT EXISTS admin_statuses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  is_builtin TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tutor_statuses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  is_builtin TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO admin_statuses (code, name, sort_order, is_builtin) VALUES
  ('unpaid',                  'Unpaid',                        10, 1),
  ('paid_partial_unassigned', 'Paid - Partial (Not Assigned)', 20, 1),
  ('paid_full_unassigned',    'Paid - Full (Not Assigned)',    30, 1),
  ('paid_partial_assigned',   'Paid - Partial (Assigned)',     40, 1),
  ('paid_full_assigned',      'Paid - Full (Assigned)',        50, 1),
  ('paid_completed',          'Paid and Completed',            60, 1),
  ('cancelled',               'Cancelled',                     70, 1);

INSERT IGNORE INTO tutor_statuses (code, name, sort_order, is_builtin) VALUES
  ('in_progress',  'In Progress',  10, 1),
  ('work_stopped', 'Work Stopped', 20, 1),
  ('completed',    'Completed',    30, 1);

ALTER TABLE orders
  ADD COLUMN admin_status_id INT DEFAULT NULL AFTER status,
  ADD COLUMN tutor_status_id INT DEFAULT NULL AFTER admin_status_id,
  ADD CONSTRAINT fk_orders_admin_status FOREIGN KEY (admin_status_id) REFERENCES admin_statuses(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_orders_tutor_status FOREIGN KEY (tutor_status_id) REFERENCES tutor_statuses(id) ON DELETE SET NULL;

-- Backfill admin_status_id from legacy `status`, splitting paid-states by payment_type
UPDATE orders o JOIN admin_statuses a ON a.code = 'unpaid'         SET o.admin_status_id = a.id WHERE o.admin_status_id IS NULL AND o.status = 'incomplete';
UPDATE orders o
  JOIN admin_statuses a ON a.code = CASE WHEN o.payment_type = 'partial' THEN 'paid_partial_unassigned' ELSE 'paid_full_unassigned' END
  SET o.admin_status_id = a.id
  WHERE o.admin_status_id IS NULL AND o.status = 'pending';
UPDATE orders o
  JOIN admin_statuses a ON a.code = CASE WHEN o.payment_type = 'partial' THEN 'paid_partial_assigned' ELSE 'paid_full_assigned' END
  SET o.admin_status_id = a.id
  WHERE o.admin_status_id IS NULL AND o.status IN ('active', 'in_progress');
UPDATE orders o JOIN admin_statuses a ON a.code = 'paid_completed' SET o.admin_status_id = a.id WHERE o.admin_status_id IS NULL AND o.status = 'completed';
UPDATE orders o JOIN admin_statuses a ON a.code = 'cancelled'      SET o.admin_status_id = a.id WHERE o.admin_status_id IS NULL AND o.status = 'cancelled';

-- Backfill tutor_status_id where the legacy status implies work has begun
UPDATE orders o JOIN tutor_statuses t ON t.code = 'in_progress' SET o.tutor_status_id = t.id WHERE o.tutor_status_id IS NULL AND o.status IN ('active', 'in_progress');
UPDATE orders o JOIN tutor_statuses t ON t.code = 'completed'   SET o.tutor_status_id = t.id WHERE o.tutor_status_id IS NULL AND o.status = 'completed';
