-- Add photo_url to tutors so the student frontend can render a real avatar
-- on the dashboard active orders + order detail tutor list. NULL = fall back
-- to initials in the Avatar component.

ALTER TABLE tutors
  ADD COLUMN photo_url VARCHAR(500) NULL AFTER specialization;
