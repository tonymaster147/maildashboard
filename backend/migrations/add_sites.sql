-- Add sites table for multi-WordPress-site branding
-- Each embedded WordPress site has its own name/logo/SMTP config

CREATE TABLE IF NOT EXISTS sites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  site_key VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  nickname VARCHAR(255) DEFAULT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,

  from_name VARCHAR(255) DEFAULT NULL,
  from_email VARCHAR(255) DEFAULT NULL,

  smtp_host VARCHAR(255) DEFAULT NULL,
  smtp_port INT DEFAULT 587,
  smtp_secure TINYINT(1) DEFAULT 0,
  smtp_user VARCHAR(255) DEFAULT NULL,
  smtp_pass TEXT DEFAULT NULL,

  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_url (url),
  INDEX idx_site_key (site_key),
  INDEX idx_active (is_active)
);

-- Add site_id to orders (nullable; legacy orders stay NULL)
ALTER TABLE orders
  ADD COLUMN site_id INT DEFAULT NULL AFTER source_url,
  ADD CONSTRAINT fk_orders_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
