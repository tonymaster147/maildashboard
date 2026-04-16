-- =============================================
-- Add plan_tier to pricing_rules + re-seed with correct Essential/Premium pricing
-- =============================================

-- 1. Add plan_tier column
ALTER TABLE pricing_rules ADD COLUMN plan_tier ENUM('essential', 'premium') NOT NULL DEFAULT 'essential' AFTER price;

-- 2. Delete ALL old pricing rules
DELETE FROM pricing_rules;

-- =============================================
-- 3. Seed correct pricing from final CSV (Essential + Premium)
-- Premium = Essential x 1.2 for most types
-- =============================================

-- === Assignment (id=3): PAGES-based, no level ===
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

-- === Essay/Paper (id=9): PAGES-based, no level (same pricing as Assignment) ===
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

-- === Project (id=10): PAGES-based, no level ===
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

-- === Discussion (id=6): FLAT - Essential=Initial Post Only $50, Premium=with Peer Responses $60 ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(6, NULL, 'flat', NULL, NULL, 50.00, 'essential'),
(6, NULL, 'flat', NULL, NULL, 60.00, 'premium');

-- === Online Class (id=1): WEEKS-based with education levels ===
-- Graduate - Essential
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(1, 3, 'weeks', 0, 3, 795.00, 'essential'),
(1, 3, 'weeks', 4, 4, 895.00, 'essential'),
(1, 3, 'weeks', 5, 6, 950.00, 'essential'),
(1, 3, 'weeks', 7, 8, 995.00, 'essential'),
(1, 3, 'weeks', 9, 10, 1050.00, 'essential'),
(1, 3, 'weeks', 11, 12, 1125.00, 'essential'),
(1, 3, 'weeks', 13, 14, 1200.00, 'essential'),
(1, 3, 'weeks', 15, 16, 1250.00, 'essential'),
(1, 3, 'weeks', 17, 100000, 1295.00, 'essential'),
-- Graduate - Premium (x1.2)
(1, 3, 'weeks', 0, 3, 954.00, 'premium'),
(1, 3, 'weeks', 4, 4, 1074.00, 'premium'),
(1, 3, 'weeks', 5, 6, 1140.00, 'premium'),
(1, 3, 'weeks', 7, 8, 1194.00, 'premium'),
(1, 3, 'weeks', 9, 10, 1260.00, 'premium'),
(1, 3, 'weeks', 11, 12, 1350.00, 'premium'),
(1, 3, 'weeks', 13, 14, 1440.00, 'premium'),
(1, 3, 'weeks', 15, 16, 1500.00, 'premium'),
(1, 3, 'weeks', 17, 100000, 1554.00, 'premium');

-- HighSchool (education_level_id=1) - Essential
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(1, 1, 'weeks', 0, 3, 545.00, 'essential'),
(1, 1, 'weeks', 4, 4, 595.00, 'essential'),
(1, 1, 'weeks', 5, 5, 650.00, 'essential'),
(1, 1, 'weeks', 6, 6, 695.00, 'essential'),
(1, 1, 'weeks', 7, 7, 740.00, 'essential'),
(1, 1, 'weeks', 8, 8, 795.00, 'essential'),
(1, 1, 'weeks', 9, 9, 830.00, 'essential'),
(1, 1, 'weeks', 10, 10, 860.00, 'essential'),
(1, 1, 'weeks', 11, 12, 895.00, 'essential'),
(1, 1, 'weeks', 13, 14, 950.00, 'essential'),
(1, 1, 'weeks', 15, 16, 995.00, 'essential'),
(1, 1, 'weeks', 17, 100000, 995.00, 'essential'),
-- HighSchool - Premium (x1.2)
(1, 1, 'weeks', 0, 3, 654.00, 'premium'),
(1, 1, 'weeks', 4, 4, 714.00, 'premium'),
(1, 1, 'weeks', 5, 5, 780.00, 'premium'),
(1, 1, 'weeks', 6, 6, 834.00, 'premium'),
(1, 1, 'weeks', 7, 7, 888.00, 'premium'),
(1, 1, 'weeks', 8, 8, 954.00, 'premium'),
(1, 1, 'weeks', 9, 9, 996.00, 'premium'),
(1, 1, 'weeks', 10, 10, 1032.00, 'premium'),
(1, 1, 'weeks', 11, 12, 1074.00, 'premium'),
(1, 1, 'weeks', 13, 14, 1140.00, 'premium'),
(1, 1, 'weeks', 15, 16, 1194.00, 'premium'),
(1, 1, 'weeks', 17, 100000, 1194.00, 'premium');

-- Undergrad (education_level_id=2) - Essential
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(1, 2, 'weeks', 0, 3, 545.00, 'essential'),
(1, 2, 'weeks', 4, 4, 595.00, 'essential'),
(1, 2, 'weeks', 5, 5, 650.00, 'essential'),
(1, 2, 'weeks', 6, 6, 695.00, 'essential'),
(1, 2, 'weeks', 7, 7, 740.00, 'essential'),
(1, 2, 'weeks', 8, 8, 795.00, 'essential'),
(1, 2, 'weeks', 9, 9, 830.00, 'essential'),
(1, 2, 'weeks', 10, 10, 860.00, 'essential'),
(1, 2, 'weeks', 11, 12, 895.00, 'essential'),
(1, 2, 'weeks', 13, 14, 950.00, 'essential'),
(1, 2, 'weeks', 15, 16, 995.00, 'essential'),
(1, 2, 'weeks', 17, 100000, 995.00, 'essential'),
-- Undergrad - Premium (x1.2)
(1, 2, 'weeks', 0, 3, 654.00, 'premium'),
(1, 2, 'weeks', 4, 4, 714.00, 'premium'),
(1, 2, 'weeks', 5, 5, 780.00, 'premium'),
(1, 2, 'weeks', 6, 6, 834.00, 'premium'),
(1, 2, 'weeks', 7, 7, 888.00, 'premium'),
(1, 2, 'weeks', 8, 8, 954.00, 'premium'),
(1, 2, 'weeks', 9, 9, 996.00, 'premium'),
(1, 2, 'weeks', 10, 10, 1032.00, 'premium'),
(1, 2, 'weeks', 11, 12, 1074.00, 'premium'),
(1, 2, 'weeks', 13, 14, 1140.00, 'premium'),
(1, 2, 'weeks', 15, 16, 1194.00, 'premium'),
(1, 2, 'weeks', 17, 100000, 1194.00, 'premium');

-- === Online Exam (id=4): FLAT per exam, with education levels ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(4, 3, 'flat', NULL, NULL, 120.00, 'essential'),
(4, 1, 'flat', NULL, NULL, 95.00, 'essential'),
(4, 2, 'flat', NULL, NULL, 95.00, 'essential'),
(4, 3, 'flat', NULL, NULL, 144.00, 'premium'),
(4, 1, 'flat', NULL, NULL, 114.00, 'premium'),
(4, 2, 'flat', NULL, NULL, 114.00, 'premium');

-- === Online Quiz (id=5): FLAT per quiz, with education levels ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(5, 3, 'flat', NULL, NULL, 100.00, 'essential'),
(5, 1, 'flat', NULL, NULL, 75.00, 'essential'),
(5, 2, 'flat', NULL, NULL, 75.00, 'essential'),
(5, 3, 'flat', NULL, NULL, 120.00, 'premium'),
(5, 1, 'flat', NULL, NULL, 90.00, 'premium'),
(5, 2, 'flat', NULL, NULL, 90.00, 'premium');

-- === Test (id=12): FLAT per test, with education levels ===
SET @test_type_id = (SELECT id FROM order_types WHERE name = 'Test' LIMIT 1);
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(@test_type_id, 3, 'flat', NULL, NULL, 100.00, 'essential'),
(@test_type_id, 1, 'flat', NULL, NULL, 75.00, 'essential'),
(@test_type_id, 2, 'flat', NULL, NULL, 75.00, 'essential'),
(@test_type_id, 3, 'flat', NULL, NULL, 120.00, 'premium'),
(@test_type_id, 1, 'flat', NULL, NULL, 90.00, 'premium'),
(@test_type_id, 2, 'flat', NULL, NULL, 90.00, 'premium');

-- === Urgent surcharge (id=11): FLAT $75 (same for both tiers) ===
INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier) VALUES
(11, NULL, 'flat', NULL, NULL, 75.00, 'essential');
