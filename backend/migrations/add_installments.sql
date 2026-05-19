CREATE TABLE IF NOT EXISTS order_installments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  installment_number INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('pending','paid','overdue') DEFAULT 'pending',
  paid_at TIMESTAMP NULL DEFAULT NULL,
  stripe_payment_intent VARCHAR(255) DEFAULT NULL,
  reminder_sent_dates JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id),
  INDEX idx_due_status (due_date, status)
);

ALTER TABLE orders
  ADD COLUMN convenience_fee DECIMAL(10,2) DEFAULT 0 AFTER amount_remaining,
  ADD COLUMN has_installments TINYINT(1) DEFAULT 0 AFTER convenience_fee;
