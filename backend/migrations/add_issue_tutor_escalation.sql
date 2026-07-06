-- Escalate a support ticket (issue) to a tutor: the tutor joins the thread as
-- a third party. Adds 'tutor' to the message + last-message role enums, plus
-- the escalated tutor, when it happened, and the tutor's read cursor.

ALTER TABLE issue_messages
  MODIFY sender_role ENUM('user','admin','sales_lead','sales_executive','tutor') NOT NULL;

ALTER TABLE issues
  MODIFY last_message_role ENUM('user','admin','sales_lead','sales_executive','tutor') DEFAULT NULL;

ALTER TABLE issues
  ADD COLUMN escalated_tutor_id INT DEFAULT NULL,
  ADD COLUMN escalated_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN tutor_seen_at TIMESTAMP NULL DEFAULT NULL;
