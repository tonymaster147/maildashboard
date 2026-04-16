-- =============================================
-- Pricing Rules Migration
-- Dynamic pricing based on order_type + education_level + quantity range
-- =============================================

-- 1. Create pricing_rules table
CREATE TABLE IF NOT EXISTS pricing_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_type_id INT NOT NULL,
  education_level_id INT DEFAULT NULL,
  range_type ENUM('weeks', 'pages', 'flat') NOT NULL DEFAULT 'flat',
  from_range INT DEFAULT NULL,
  to_range INT DEFAULT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_type_id) REFERENCES order_types(id) ON DELETE CASCADE,
  FOREIGN KEY (education_level_id) REFERENCES education_levels(id) ON DELETE SET NULL,
  INDEX idx_pricing_lookup (order_type_id, education_level_id, is_active),
  INDEX idx_pricing_range (order_type_id, from_range, to_range)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add missing order types from CSV
INSERT IGNORE INTO order_types (name, description) VALUES
('Essay/Paper', 'Essay and paper writing assistance'),
('Project', 'Project completion assistance');

-- 3. Make plan_id optional for new orders (existing orders keep their plan_id)
ALTER TABLE orders MODIFY COLUMN plan_id INT DEFAULT NULL;

-- 4. Drop the existing foreign key on plan_id, then re-add as nullable
-- (needed because the original FK was NOT NULL)
ALTER TABLE orders DROP FOREIGN KEY orders_ibfk_5;
ALTER TABLE orders ADD CONSTRAINT fk_orders_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;

-- 5. Add num_pages and pricing_rule_id columns
ALTER TABLE orders ADD COLUMN num_pages INT DEFAULT NULL AFTER num_weeks;
ALTER TABLE orders ADD COLUMN pricing_rule_id INT DEFAULT NULL AFTER plan_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_pricing_rule FOREIGN KEY (pricing_rule_id) REFERENCES pricing_rules(id) ON DELETE SET NULL;

-- 6. Deactivate old plans (keep data for historical orders)
UPDATE plans SET is_active = 0;

-- =============================================
-- 7. Seed pricing rules from CSV
-- =============================================

-- === Assignment: price by weeks, no level distinction ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 1, 2, 75.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 3, 4, 85.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 5, 5, 95.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 6, 6, 120.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 7, 8, 145.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 9, 10, 225.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 11, 12, 250.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 13, 14, 290.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 15, 16, 320.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 17, 18, 350.00),
((SELECT id FROM order_types WHERE name='Assignment'), NULL, 'weeks', 19, 100000, 400.00);

-- === Discussion Post: flat $75 ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Discussion Post'), NULL, 'flat', NULL, NULL, 75.00);

-- === Essay/Paper: price by weeks, no level distinction ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 1, 2, 70.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 3, 4, 80.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 5, 5, 95.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 6, 6, 120.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 7, 8, 145.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 9, 10, 225.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 11, 12, 250.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 13, 14, 290.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 15, 16, 320.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 17, 18, 350.00),
((SELECT id FROM order_types WHERE name='Essay/Paper'), NULL, 'weeks', 19, 100000, 400.00);

-- === Online Class (Full Class): price by weeks, varies by level ===
-- Graduate
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 0, 3, 795.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 4, 4, 895.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 5, 6, 950.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 7, 8, 995.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 9, 10, 1050.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 11, 12, 1125.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 13, 14, 1200.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 15, 16, 1250.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 17, 100000, 1295.00);
-- High School
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 0, 3, 545.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 4, 4, 595.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 5, 5, 650.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 6, 6, 695.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 7, 7, 740.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 8, 8, 795.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 9, 9, 830.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 10, 10, 860.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 11, 12, 895.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 13, 14, 950.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 15, 16, 995.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 17, 100000, 995.00);
-- Undergraduate
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 0, 3, 545.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 4, 4, 595.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 5, 5, 650.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 6, 6, 695.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 7, 7, 740.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 8, 8, 795.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 9, 9, 830.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 10, 10, 860.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 11, 12, 895.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 13, 14, 950.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 15, 16, 995.00),
((SELECT id FROM order_types WHERE name='Full Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 17, 100000, 995.00);

-- === Partial Class: same pricing as Full Class ===
-- Graduate
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 0, 3, 795.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 4, 4, 895.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 5, 6, 950.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 7, 8, 995.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 9, 10, 1050.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 11, 12, 1125.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 13, 14, 1200.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 15, 16, 1250.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Graduate'), 'weeks', 17, 100000, 1295.00);
-- High School
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 0, 3, 545.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 4, 4, 595.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 5, 5, 650.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 6, 6, 695.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 7, 7, 740.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 8, 8, 795.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 9, 9, 830.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 10, 10, 860.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 11, 12, 895.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 13, 14, 950.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 15, 16, 995.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='High School'), 'weeks', 17, 100000, 995.00);
-- Undergraduate
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 0, 3, 545.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 4, 4, 595.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 5, 5, 650.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 6, 6, 695.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 7, 7, 740.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 8, 8, 795.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 9, 9, 830.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 10, 10, 860.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 11, 12, 895.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 13, 14, 950.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 15, 16, 995.00),
((SELECT id FROM order_types WHERE name='Partial Class'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'weeks', 17, 100000, 995.00);

-- === Exam: flat price, varies by level ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Exam'), (SELECT id FROM education_levels WHERE name='Graduate'), 'flat', NULL, NULL, 120.00),
((SELECT id FROM order_types WHERE name='Exam'), (SELECT id FROM education_levels WHERE name='High School'), 'flat', NULL, NULL, 95.00),
((SELECT id FROM order_types WHERE name='Exam'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'flat', NULL, NULL, 95.00);

-- === Quiz: flat price, varies by level ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Quiz'), (SELECT id FROM education_levels WHERE name='Graduate'), 'flat', NULL, NULL, 100.00),
((SELECT id FROM order_types WHERE name='Quiz'), (SELECT id FROM education_levels WHERE name='High School'), 'flat', NULL, NULL, 75.00),
((SELECT id FROM order_types WHERE name='Quiz'), (SELECT id FROM education_levels WHERE name='Undergraduate'), 'flat', NULL, NULL, 75.00);

-- === Project: price by pages, no level distinction ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 1, 1, 75.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 2, 2, 100.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 3, 3, 120.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 4, 4, 140.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 5, 5, 150.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 6, 6, 170.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 7, 7, 190.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 8, 8, 220.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 9, 9, 240.00),
((SELECT id FROM order_types WHERE name='Project'), NULL, 'pages', 10, 10000, 280.00);

-- === Urgent Surcharge: stored as config, not an order type ===
-- We store this in a simple config approach: a pricing rule with a special marker
-- The "Urgent" fee applies ON TOP of any order type, so we create a system order type for it
INSERT IGNORE INTO order_types (name, description, is_active) VALUES
('_urgent_surcharge', 'System: urgent delivery surcharge', 0);

INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
((SELECT id FROM order_types WHERE name='_urgent_surcharge'), NULL, 'flat', NULL, NULL, 75.00);
