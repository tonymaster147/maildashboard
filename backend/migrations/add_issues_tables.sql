-- Support-ticket system. Users open issues, admin/sales reply, admin closes.
-- One thread per issue, stored in issue_messages.

CREATE TABLE IF NOT EXISTS issues (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  order_id INT DEFAULT NULL,
  category VARCHAR(64) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  closed_at TIMESTAMP NULL DEFAULT NULL,
  closed_by_role ENUM('admin','sales_lead','sales_executive') DEFAULT NULL,
  -- Denormalised pointers for fast list-view rendering
  last_message_at TIMESTAMP NULL DEFAULT NULL,
  last_message_role ENUM('user','admin','sales_lead','sales_executive') DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_issues_user (user_id),
  INDEX idx_issues_status (status),
  INDEX idx_issues_last_message_at (last_message_at)
);

CREATE TABLE IF NOT EXISTS issue_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  issue_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_role ENUM('user','admin','sales_lead','sales_executive') NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  INDEX idx_msgs_issue (issue_id, created_at)
);
