-- =============================================
-- Update plan_tier ENUM to support 3+ tiers and re-seed ALL pricing
-- Tiers: essential, premium, priority, vip
-- Source: Final Pricing CSVs (Apr 2025)
-- =============================================

-- 1. Expand plan_tier ENUM
ALTER TABLE pricing_rules MODIFY COLUMN plan_tier ENUM('essential', 'premium', 'priority', 'vip') NOT NULL DEFAULT 'essential';

-- 2. Delete ALL old pricing rules
DELETE FROM pricing_rules;

-- =============================================
-- 3. Online Class (id=1): WEEKS-based, 3 tiers, with education levels
-- =============================================

-- Graduate (education_level_id=3) - Essential
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(1, 3, 'weeks', 1, 1, 100.00, 'essential'),
(1, 3, 'weeks', 2, 2, 200.00, 'essential'),
(1, 3, 'weeks', 3, 3, 300.00, 'essential'),
(1, 3, 'weeks', 4, 4, 400.00, 'essential'),
(1, 3, 'weeks', 5, 5, 500.00, 'essential'),
(1, 3, 'weeks', 6, 6, 600.00, 'essential'),
(1, 3, 'weeks', 7, 7, 700.00, 'essential'),
(1, 3, 'weeks', 8, 8, 800.00, 'essential'),
(1, 3, 'weeks', 9, 12, 1000.00, 'essential'),
(1, 3, 'weeks', 13, 16, 1200.00, 'essential'),
(1, 3, 'weeks', 17, 100000, 1400.00, 'essential'),
-- Graduate - Priority
(1, 3, 'weeks', 1, 1, 110.00, 'priority'),
(1, 3, 'weeks', 2, 2, 220.00, 'priority'),
(1, 3, 'weeks', 3, 3, 330.00, 'priority'),
(1, 3, 'weeks', 4, 4, 440.00, 'priority'),
(1, 3, 'weeks', 5, 5, 550.00, 'priority'),
(1, 3, 'weeks', 6, 6, 660.00, 'priority'),
(1, 3, 'weeks', 7, 7, 770.00, 'priority'),
(1, 3, 'weeks', 8, 8, 880.00, 'priority'),
(1, 3, 'weeks', 9, 12, 1100.00, 'priority'),
(1, 3, 'weeks', 13, 16, 1320.00, 'priority'),
(1, 3, 'weeks', 17, 100000, 1540.00, 'priority'),
-- Graduate - VIP
(1, 3, 'weeks', 1, 1, 120.00, 'vip'),
(1, 3, 'weeks', 2, 2, 240.00, 'vip'),
(1, 3, 'weeks', 3, 3, 360.00, 'vip'),
(1, 3, 'weeks', 4, 4, 480.00, 'vip'),
(1, 3, 'weeks', 5, 5, 600.00, 'vip'),
(1, 3, 'weeks', 6, 6, 720.00, 'vip'),
(1, 3, 'weeks', 7, 7, 840.00, 'vip'),
(1, 3, 'weeks', 8, 8, 960.00, 'vip'),
(1, 3, 'weeks', 9, 12, 1200.00, 'vip'),
(1, 3, 'weeks', 13, 16, 1440.00, 'vip'),
(1, 3, 'weeks', 17, 100000, 1680.00, 'vip');

-- HighSchool (education_level_id=1) - Essential
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(1, 1, 'weeks', 1, 1, 70.00, 'essential'),
(1, 1, 'weeks', 2, 2, 140.00, 'essential'),
(1, 1, 'weeks', 3, 3, 210.00, 'essential'),
(1, 1, 'weeks', 4, 4, 280.00, 'essential'),
(1, 1, 'weeks', 5, 5, 350.00, 'essential'),
(1, 1, 'weeks', 6, 6, 420.00, 'essential'),
(1, 1, 'weeks', 7, 7, 490.00, 'essential'),
(1, 1, 'weeks', 8, 8, 560.00, 'essential'),
(1, 1, 'weeks', 9, 12, 700.00, 'essential'),
(1, 1, 'weeks', 13, 16, 840.00, 'essential'),
(1, 1, 'weeks', 17, 100000, 980.00, 'essential'),
-- HighSchool - Priority
(1, 1, 'weeks', 1, 1, 80.00, 'priority'),
(1, 1, 'weeks', 2, 2, 160.00, 'priority'),
(1, 1, 'weeks', 3, 3, 240.00, 'priority'),
(1, 1, 'weeks', 4, 4, 320.00, 'priority'),
(1, 1, 'weeks', 5, 5, 400.00, 'priority'),
(1, 1, 'weeks', 6, 6, 480.00, 'priority'),
(1, 1, 'weeks', 7, 7, 560.00, 'priority'),
(1, 1, 'weeks', 8, 8, 640.00, 'priority'),
(1, 1, 'weeks', 9, 12, 800.00, 'priority'),
(1, 1, 'weeks', 13, 16, 960.00, 'priority'),
(1, 1, 'weeks', 17, 100000, 1120.00, 'priority'),
-- HighSchool - VIP
(1, 1, 'weeks', 1, 1, 90.00, 'vip'),
(1, 1, 'weeks', 2, 2, 180.00, 'vip'),
(1, 1, 'weeks', 3, 3, 270.00, 'vip'),
(1, 1, 'weeks', 4, 4, 360.00, 'vip'),
(1, 1, 'weeks', 5, 5, 450.00, 'vip'),
(1, 1, 'weeks', 6, 6, 540.00, 'vip'),
(1, 1, 'weeks', 7, 7, 630.00, 'vip'),
(1, 1, 'weeks', 8, 8, 720.00, 'vip'),
(1, 1, 'weeks', 9, 12, 900.00, 'vip'),
(1, 1, 'weeks', 13, 16, 1080.00, 'vip'),
(1, 1, 'weeks', 17, 100000, 1260.00, 'vip');

-- Undergrad (education_level_id=2) - Essential
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(1, 2, 'weeks', 1, 1, 80.00, 'essential'),
(1, 2, 'weeks', 2, 2, 160.00, 'essential'),
(1, 2, 'weeks', 3, 3, 240.00, 'essential'),
(1, 2, 'weeks', 4, 4, 320.00, 'essential'),
(1, 2, 'weeks', 5, 5, 400.00, 'essential'),
(1, 2, 'weeks', 6, 6, 480.00, 'essential'),
(1, 2, 'weeks', 7, 7, 560.00, 'essential'),
(1, 2, 'weeks', 8, 8, 640.00, 'essential'),
(1, 2, 'weeks', 9, 12, 800.00, 'essential'),
(1, 2, 'weeks', 13, 16, 1120.00, 'essential'),
(1, 2, 'weeks', 17, 100000, 1200.00, 'essential'),
-- Undergrad - Priority
(1, 2, 'weeks', 1, 1, 90.00, 'priority'),
(1, 2, 'weeks', 2, 2, 180.00, 'priority'),
(1, 2, 'weeks', 3, 3, 270.00, 'priority'),
(1, 2, 'weeks', 4, 4, 360.00, 'priority'),
(1, 2, 'weeks', 5, 5, 450.00, 'priority'),
(1, 2, 'weeks', 6, 6, 540.00, 'priority'),
(1, 2, 'weeks', 7, 7, 630.00, 'priority'),
(1, 2, 'weeks', 8, 8, 720.00, 'priority'),
(1, 2, 'weeks', 9, 12, 900.00, 'priority'),
(1, 2, 'weeks', 13, 16, 1260.00, 'priority'),
(1, 2, 'weeks', 17, 100000, 1350.00, 'priority'),
-- Undergrad - VIP
(1, 2, 'weeks', 1, 1, 100.00, 'vip'),
(1, 2, 'weeks', 2, 2, 200.00, 'vip'),
(1, 2, 'weeks', 3, 3, 300.00, 'vip'),
(1, 2, 'weeks', 4, 4, 400.00, 'vip'),
(1, 2, 'weeks', 5, 5, 500.00, 'vip'),
(1, 2, 'weeks', 6, 6, 600.00, 'vip'),
(1, 2, 'weeks', 7, 7, 700.00, 'vip'),
(1, 2, 'weeks', 8, 8, 800.00, 'vip'),
(1, 2, 'weeks', 9, 12, 1000.00, 'vip'),
(1, 2, 'weeks', 13, 16, 1400.00, 'vip'),
(1, 2, 'weeks', 17, 100000, 1500.00, 'vip');

-- =============================================
-- 4. Assignment (id=3): PAGES-based, 2 tiers (Essential/Premium)
-- =============================================
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
-- Essential
(3, NULL, 'pages', 1, 2, 50.00, 'essential'),
(3, NULL, 'pages', 3, 4, 80.00, 'essential'),
(3, NULL, 'pages', 5, 5, 80.00, 'essential'),
(3, NULL, 'pages', 6, 6, 100.00, 'essential'),
(3, NULL, 'pages', 7, 8, 120.00, 'essential'),
(3, NULL, 'pages', 9, 10, 140.00, 'essential'),
(3, NULL, 'pages', 11, 12, 160.00, 'essential'),
(3, NULL, 'pages', 13, 14, 180.00, 'essential'),
(3, NULL, 'pages', 15, 16, 200.00, 'essential'),
(3, NULL, 'pages', 17, 18, 250.00, 'essential'),
(3, NULL, 'pages', 19, 100000, 350.00, 'essential'),
-- Premium
(3, NULL, 'pages', 1, 2, 60.00, 'premium'),
(3, NULL, 'pages', 3, 4, 96.00, 'premium'),
(3, NULL, 'pages', 5, 5, 96.00, 'premium'),
(3, NULL, 'pages', 6, 6, 120.00, 'premium'),
(3, NULL, 'pages', 7, 8, 144.00, 'premium'),
(3, NULL, 'pages', 9, 10, 168.00, 'premium'),
(3, NULL, 'pages', 11, 12, 192.00, 'premium'),
(3, NULL, 'pages', 13, 14, 216.00, 'premium'),
(3, NULL, 'pages', 15, 16, 240.00, 'premium'),
(3, NULL, 'pages', 17, 18, 300.00, 'premium'),
(3, NULL, 'pages', 19, 100000, 420.00, 'premium');

-- =============================================
-- 5. Essay/Paper (id=9): PAGES-based, 2 tiers
-- =============================================
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
-- Essential
(9, NULL, 'pages', 1, 2, 50.00, 'essential'),
(9, NULL, 'pages', 3, 4, 80.00, 'essential'),
(9, NULL, 'pages', 5, 5, 80.00, 'essential'),
(9, NULL, 'pages', 6, 6, 100.00, 'essential'),
(9, NULL, 'pages', 7, 8, 120.00, 'essential'),
(9, NULL, 'pages', 9, 10, 140.00, 'essential'),
(9, NULL, 'pages', 11, 12, 160.00, 'essential'),
(9, NULL, 'pages', 13, 14, 180.00, 'essential'),
(9, NULL, 'pages', 15, 16, 200.00, 'essential'),
(9, NULL, 'pages', 17, 18, 250.00, 'essential'),
(9, NULL, 'pages', 19, 100000, 350.00, 'essential'),
-- Premium
(9, NULL, 'pages', 1, 2, 60.00, 'premium'),
(9, NULL, 'pages', 3, 4, 96.00, 'premium'),
(9, NULL, 'pages', 5, 5, 96.00, 'premium'),
(9, NULL, 'pages', 6, 6, 120.00, 'premium'),
(9, NULL, 'pages', 7, 8, 144.00, 'premium'),
(9, NULL, 'pages', 9, 10, 168.00, 'premium'),
(9, NULL, 'pages', 11, 12, 192.00, 'premium'),
(9, NULL, 'pages', 13, 14, 216.00, 'premium'),
(9, NULL, 'pages', 15, 16, 240.00, 'premium'),
(9, NULL, 'pages', 17, 18, 300.00, 'premium'),
(9, NULL, 'pages', 19, 100000, 420.00, 'premium');

-- =============================================
-- 6. Project (id=10): PAGES-based, 2 tiers
-- =============================================
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
-- Essential
(10, NULL, 'pages', 1, 1, 50.00, 'essential'),
(10, NULL, 'pages', 2, 2, 80.00, 'essential'),
(10, NULL, 'pages', 3, 3, 80.00, 'essential'),
(10, NULL, 'pages', 4, 4, 100.00, 'essential'),
(10, NULL, 'pages', 5, 5, 120.00, 'essential'),
(10, NULL, 'pages', 6, 6, 140.00, 'essential'),
(10, NULL, 'pages', 7, 7, 160.00, 'essential'),
(10, NULL, 'pages', 8, 8, 180.00, 'essential'),
(10, NULL, 'pages', 9, 9, 200.00, 'essential'),
(10, NULL, 'pages', 10, 15, 250.00, 'essential'),
(10, NULL, 'pages', 16, 30, 350.00, 'essential'),
-- Premium
(10, NULL, 'pages', 1, 1, 60.00, 'premium'),
(10, NULL, 'pages', 2, 2, 96.00, 'premium'),
(10, NULL, 'pages', 3, 3, 96.00, 'premium'),
(10, NULL, 'pages', 4, 4, 120.00, 'premium'),
(10, NULL, 'pages', 5, 5, 144.00, 'premium'),
(10, NULL, 'pages', 6, 6, 168.00, 'premium'),
(10, NULL, 'pages', 7, 7, 192.00, 'premium'),
(10, NULL, 'pages', 8, 8, 216.00, 'premium'),
(10, NULL, 'pages', 9, 9, 240.00, 'premium'),
(10, NULL, 'pages', 10, 15, 300.00, 'premium'),
(10, NULL, 'pages', 16, 30, 420.00, 'premium');

-- =============================================
-- 7. Discussion (id=6): FLAT - Essential=Initial Post Only, Premium=with Peer Responses
-- =============================================
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(6, NULL, 'flat', NULL, NULL, 50.00, 'essential'),
(6, NULL, 'flat', NULL, NULL, 60.00, 'premium');

-- =============================================
-- 8. Online Exam (id=4): FLAT per exam, with education levels (no tier)
-- =============================================
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(4, 3, 'flat', NULL, NULL, 120.00, 'essential'),
(4, 1, 'flat', NULL, NULL, 95.00, 'essential'),
(4, 2, 'flat', NULL, NULL, 95.00, 'essential');

-- =============================================
-- 9. Online Quiz (id=5): FLAT per quiz, with education levels (no tier)
-- =============================================
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(5, 3, 'flat', NULL, NULL, 100.00, 'essential'),
(5, 1, 'flat', NULL, NULL, 75.00, 'essential'),
(5, 2, 'flat', NULL, NULL, 75.00, 'essential');

-- =============================================
-- 10. Test: FLAT per test, with education levels (no tier)
-- =============================================
SET @test_type_id = (SELECT id FROM order_types WHERE name = 'Test' LIMIT 1);
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(@test_type_id, 3, 'flat', NULL, NULL, 100.00, 'essential'),
(@test_type_id, 1, 'flat', NULL, NULL, 75.00, 'essential'),
(@test_type_id, 2, 'flat', NULL, NULL, 75.00, 'essential');

-- =============================================
-- 11. Urgent surcharge (id=11): FLAT $75
-- =============================================
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(11, NULL, 'flat', NULL, NULL, 75.00, 'essential');
