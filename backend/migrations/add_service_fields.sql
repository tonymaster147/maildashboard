-- Service-specific fields per order type.
-- Online Class: class_type (full/partial), partial_weeks
-- Quiz/Exam/Test: quiz_mode (online/proctored), plus items table
-- Assignment/Project: work_type (written/technical/both)

ALTER TABLE orders
  ADD COLUMN class_type VARCHAR(20) DEFAULT NULL AFTER num_pages,
  ADD COLUMN partial_weeks INT DEFAULT NULL AFTER class_type,
  ADD COLUMN quiz_mode VARCHAR(20) DEFAULT NULL AFTER partial_weeks,
  ADD COLUMN work_type VARCHAR(30) DEFAULT NULL AFTER quiz_mode;

CREATE TABLE IF NOT EXISTS order_quiz_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  name VARCHAR(255) DEFAULT NULL,
  duration VARCHAR(100) DEFAULT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
);
