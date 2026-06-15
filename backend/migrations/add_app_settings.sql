-- Generic key-value store for global app settings configurable from the admin
-- panel. First use: `admin_notification_emails` — a comma-separated list of
-- addresses that receive new-order / issue / login-update notifications.
-- Seeded with the previously hard-coded address so behaviour is unchanged
-- until an admin edits it.

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('admin_notification_emails', 'faruqui.a4u@gmail.com')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
