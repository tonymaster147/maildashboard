-- Audit trail for edits to an order's installment plan (amounts / due dates).
-- One row per changed installment per edit, so multiple edits of the same
-- installment are all tracked (who changed it, previous vs new date/amount).

CREATE TABLE IF NOT EXISTS order_installment_changes (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  installment_id INT DEFAULT NULL,
  installment_number INT DEFAULT NULL,
  previous_amount DECIMAL(10,2) DEFAULT NULL,
  new_amount DECIMAL(10,2) DEFAULT NULL,
  previous_due_date DATE DEFAULT NULL,
  new_due_date DATE DEFAULT NULL,
  edited_by_id INT DEFAULT NULL,
  edited_by_role VARCHAR(30) DEFAULT NULL,
  edited_by_name VARCHAR(150) DEFAULT NULL,
  edited_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oic_order (order_id),
  CONSTRAINT fk_oic_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
