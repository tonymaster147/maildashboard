-- Manual payment-collection records captured when an Admin / Sales Lead moves
-- an order from Unpaid → Paid (Full or Partial) from the panel. One row per
-- collection event (audit trail); the order's amount_paid/amount_remaining are
-- updated alongside, and a matching completed `payments` row is inserted so the
-- amount counts toward revenue/reports.

CREATE TABLE IF NOT EXISTS order_payment_collections (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  payment_type ENUM('full','partial') NOT NULL,
  mode_of_communication VARCHAR(255) DEFAULT NULL,
  invoice_no VARCHAR(100) DEFAULT NULL,
  payment_date DATE DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT,
  collected_by_id INT DEFAULT NULL,
  collected_by_role VARCHAR(30) DEFAULT NULL,
  collected_by_name VARCHAR(150) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_opc_order (order_id),
  CONSTRAINT fk_opc_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
