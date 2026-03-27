-- =============================================
-- Seed Data for Tutoring Platform
-- =============================================

USE tutoring_platform;

-- Seed Admin User (password: admin123)
INSERT INTO users (username, access_code, email, role) VALUES
('admin', '$2a$10$XQCg1z4YL1BKePzTvSzWxOVGxfG6bQKjE9K5p5bQZf5xz5z5z5z5z', 'admin@tutoringplatform.com', 'admin');

-- Seed Order Types
INSERT INTO order_types (name, description) VALUES
('Full Class', 'Complete class management from start to finish'),
('Partial Class', 'Management of specific portions of a class'),
('Assignment', 'Individual assignment completion'),
('Exam', 'Exam preparation and completion'),
('Quiz', 'Quiz completion assistance'),
('Discussion Post', 'Discussion board participation'),
('Lab Work', 'Laboratory work assistance'),
('Research Paper', 'Research paper writing assistance');

-- Seed Subjects
INSERT INTO subjects (name) VALUES
('Mathematics'), ('English'), ('Science'), ('History'),
('Computer Science'), ('Business Administration'), ('Psychology'),
('Nursing'), ('Engineering'), ('Accounting'), ('Statistics'),
('Economics'), ('Marketing'), ('Biology'), ('Chemistry'),
('Physics'), ('Sociology'), ('Philosophy'), ('Political Science'),
('Communications'), ('Information Technology'), ('Data Science'),
('Graphic Design'), ('Music'), ('Art'), ('Criminal Justice'),
('Healthcare Administration'), ('Education'), ('Law'), ('Finance');

-- Seed Education Levels
INSERT INTO education_levels (name) VALUES
('High School'), ('Undergraduate'), ('Graduate'), ('Post-Graduate'),
('Doctoral'), ('Professional Certification'), ('Community College');

-- Seed Plans
INSERT INTO plans (name, price, description, features, sort_order) VALUES
('Essential', 49.99, 'Basic plan with standard support', '["Standard delivery time", "Basic support", "Email updates", "1 revision included"]', 1),
('Priority', 89.99, 'Priority plan with faster delivery', '["Faster delivery", "Priority support", "Email + SMS updates", "3 revisions included", "Dedicated tutor"]', 2),
('VIP', 149.99, 'Premium plan with dedicated support', '["Fastest delivery", "24/7 VIP support", "Real-time updates", "Unlimited revisions", "Dedicated senior tutor", "Quality guarantee"]', 3);

-- Seed Coupons
INSERT INTO coupons (code, discount_percent, max_uses, expires_at) VALUES
('WELCOME10', 10.00, 100, '2027-12-31 23:59:59'),
('SAVE20', 20.00, 50, '2027-06-30 23:59:59');
