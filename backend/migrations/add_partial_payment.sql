ALTER TABLE orders
  ADD COLUMN payment_type ENUM('full','partial') DEFAULT 'full' AFTER total_price,
  ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0 AFTER payment_type,
  ADD COLUMN amount_remaining DECIMAL(10,2) DEFAULT 0 AFTER amount_paid;

UPDATE orders SET amount_paid = total_price, amount_remaining = 0 WHERE payment_type = 'full';
