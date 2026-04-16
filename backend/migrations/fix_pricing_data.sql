-- =============================================
-- Fix Pricing Data Migration
-- Corrects order types, pricing rules (range types & prices), and subjects
-- Based on final CSVs: Assignment/Essay=pages, Quiz/Exam/Test=per-unit, etc.
-- =============================================

-- 1. Rename order types to match CSV naming
UPDATE order_types SET name = 'Online Class' WHERE id = 1;
-- Deactivate types not in the CSV
UPDATE order_types SET is_active = 0 WHERE id = 2; -- Partial Class
UPDATE order_types SET is_active = 0 WHERE id = 7; -- Lab Work
UPDATE order_types SET is_active = 0 WHERE id = 8; -- Research Paper

-- Rename to match CSV
UPDATE order_types SET name = 'Online Exam' WHERE id = 4;
UPDATE order_types SET name = 'Online Quiz' WHERE id = 5;
UPDATE order_types SET name = 'Discussion' WHERE id = 6;

-- Add Test type (from CSV 3)
INSERT INTO order_types (name, description) VALUES ('Test', 'Online test assistance');

-- Re-activate urgent surcharge
UPDATE order_types SET is_active = 1 WHERE name = '_urgent_surcharge';

-- 2. Delete ALL old pricing rules and re-seed with correct data
DELETE FROM pricing_rules;

-- =============================================
-- 3. Seed correct pricing rules from all CSVs
-- =============================================

-- === Assignment (id=3): PAGES-based, no level ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(3, NULL, 'pages', 1, 2, 75.00),
(3, NULL, 'pages', 3, 4, 85.00),
(3, NULL, 'pages', 5, 5, 95.00),
(3, NULL, 'pages', 6, 6, 120.00),
(3, NULL, 'pages', 7, 8, 145.00),
(3, NULL, 'pages', 9, 10, 225.00),
(3, NULL, 'pages', 11, 12, 250.00),
(3, NULL, 'pages', 13, 14, 290.00),
(3, NULL, 'pages', 15, 16, 320.00),
(3, NULL, 'pages', 17, 18, 350.00),
(3, NULL, 'pages', 19, 100000, 400.00);

-- === Discussion (id=6): FLAT per discussion, multiply by quantity ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(6, NULL, 'flat', NULL, NULL, 75.00);

-- === Essay/Paper (id=9): PAGES-based, no level ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(9, NULL, 'pages', 1, 2, 70.00),
(9, NULL, 'pages', 3, 4, 80.00),
(9, NULL, 'pages', 5, 5, 95.00),
(9, NULL, 'pages', 6, 6, 120.00),
(9, NULL, 'pages', 7, 8, 145.00),
(9, NULL, 'pages', 9, 10, 225.00),
(9, NULL, 'pages', 11, 12, 250.00),
(9, NULL, 'pages', 13, 14, 290.00),
(9, NULL, 'pages', 15, 16, 320.00),
(9, NULL, 'pages', 17, 18, 350.00),
(9, NULL, 'pages', 19, 100000, 400.00);

-- === Online Class (id=1): WEEKS-based with education levels ===
-- Graduate
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(1, 3, 'weeks', 0, 3, 795.00),
(1, 3, 'weeks', 4, 4, 895.00),
(1, 3, 'weeks', 5, 6, 950.00),
(1, 3, 'weeks', 7, 8, 995.00),
(1, 3, 'weeks', 9, 10, 1050.00),
(1, 3, 'weeks', 11, 12, 1125.00),
(1, 3, 'weeks', 13, 14, 1200.00),
(1, 3, 'weeks', 15, 16, 1250.00),
(1, 3, 'weeks', 17, 100000, 1295.00);

-- HighSchool (education_level_id = 1)
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(1, 1, 'weeks', 0, 3, 545.00),
(1, 1, 'weeks', 4, 4, 595.00),
(1, 1, 'weeks', 5, 5, 650.00),
(1, 1, 'weeks', 6, 6, 695.00),
(1, 1, 'weeks', 7, 7, 740.00),
(1, 1, 'weeks', 8, 8, 795.00),
(1, 1, 'weeks', 9, 9, 830.00),
(1, 1, 'weeks', 10, 10, 860.00),
(1, 1, 'weeks', 11, 12, 895.00),
(1, 1, 'weeks', 13, 14, 950.00),
(1, 1, 'weeks', 15, 16, 995.00),
(1, 1, 'weeks', 17, 100000, 995.00);

-- Undergrad (education_level_id = 2)
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(1, 2, 'weeks', 0, 3, 545.00),
(1, 2, 'weeks', 4, 4, 595.00),
(1, 2, 'weeks', 5, 5, 650.00),
(1, 2, 'weeks', 6, 6, 695.00),
(1, 2, 'weeks', 7, 7, 740.00),
(1, 2, 'weeks', 8, 8, 795.00),
(1, 2, 'weeks', 9, 9, 830.00),
(1, 2, 'weeks', 10, 10, 860.00),
(1, 2, 'weeks', 11, 12, 895.00),
(1, 2, 'weeks', 13, 14, 950.00),
(1, 2, 'weeks', 15, 16, 995.00),
(1, 2, 'weeks', 17, 100000, 995.00);

-- === Online Exam (id=4): FLAT per exam, with education levels ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(4, 3, 'flat', NULL, NULL, 120.00),
(4, 1, 'flat', NULL, NULL, 95.00),
(4, 2, 'flat', NULL, NULL, 95.00);

-- === Online Quiz (id=5): FLAT per quiz, with education levels ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(5, 3, 'flat', NULL, NULL, 100.00),
(5, 1, 'flat', NULL, NULL, 75.00),
(5, 2, 'flat', NULL, NULL, 75.00);

-- === Test (new type): FLAT per test, with education levels (from CSV 3) ===
-- Get the Test type ID dynamically
SET @test_type_id = (SELECT id FROM order_types WHERE name = 'Test' LIMIT 1);
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(@test_type_id, 3, 'flat', NULL, NULL, 100.00),
(@test_type_id, 1, 'flat', NULL, NULL, 75.00),
(@test_type_id, 2, 'flat', NULL, NULL, 75.00);

-- === Project (id=10): PAGES-based, no level ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(10, NULL, 'pages', 1, 1, 75.00),
(10, NULL, 'pages', 2, 2, 100.00),
(10, NULL, 'pages', 3, 3, 120.00),
(10, NULL, 'pages', 4, 4, 140.00),
(10, NULL, 'pages', 5, 5, 150.00),
(10, NULL, 'pages', 6, 6, 170.00),
(10, NULL, 'pages', 7, 7, 190.00),
(10, NULL, 'pages', 8, 8, 220.00),
(10, NULL, 'pages', 9, 9, 240.00),
(10, NULL, 'pages', 10, 100000, 280.00);

-- === Urgent surcharge (id=11): FLAT $75 ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price) VALUES
(11, NULL, 'flat', NULL, NULL, 75.00);

-- =============================================
-- 4. Update subjects to match provided list
-- =============================================
-- Deactivate all existing subjects
UPDATE subjects SET is_active = 0;

-- Insert/reactivate the correct subject list
INSERT INTO subjects (name, is_active) VALUES
('Accounting', 1), ('Algebra', 1), ('Anthropology', 1), ('Biology', 1),
('Calculus', 1), ('Chemistry', 1), ('Communication', 1), ('Criminology', 1),
('Economics', 1), ('Engineering', 1), ('English Composition', 1), ('English Literature', 1),
('Finance', 1), ('Geography', 1), ('Geometry', 1), ('History', 1),
('Information Tech', 1), ('Law & Ethics', 1), ('Linear Algebra', 1), ('Marketing', 1),
('Nutrition', 1), ('Operations', 1), ('Philosophy', 1), ('Physical Science', 1),
('Physics', 1), ('Political Science', 1), ('Psychology', 1), ('Sociology', 1),
('Statistics', 1), ('Trigonometry', 1), ('Strategy', 1), ('Other', 1)
ON DUPLICATE KEY UPDATE is_active = 1;
