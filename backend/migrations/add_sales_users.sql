-- Migration: Add Sales Users feature
-- Run this on existing databases to add sales support

-- Sales Users table
CREATE TABLE IF NOT EXISTS sales_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('sales_lead', 'sales_executive') NOT NULL DEFAULT 'sales_executive',
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sales Permissions table
CREATE TABLE IF NOT EXISTS sales_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sales_user_id INT NOT NULL,
  menu_key VARCHAR(50) NOT NULL,
  is_allowed TINYINT(1) DEFAULT 1,
  FOREIGN KEY (sales_user_id) REFERENCES sales_users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_permission (sales_user_id, menu_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_sales_permissions_user_id ON sales_permissions(sales_user_id);

-- Update ENUM columns to support sales roles
ALTER TABLE chats MODIFY COLUMN sender_role ENUM('user', 'tutor', 'admin', 'sales_lead', 'sales_executive') NOT NULL;
ALTER TABLE files MODIFY COLUMN uploaded_by_role ENUM('user', 'tutor', 'admin', 'sales_lead', 'sales_executive') NOT NULL;
ALTER TABLE notifications MODIFY COLUMN role ENUM('user', 'tutor', 'admin', 'sales_lead', 'sales_executive') NOT NULL;
