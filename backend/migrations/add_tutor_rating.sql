-- Tutor rating out of 5 (half-star steps, e.g. 4.5). Set by admin/sales on
-- the tutor form; displayed on the student dashboard wherever a tutor shows.
-- NULL = not rated yet (student UI hides the stars).

ALTER TABLE tutors
  ADD COLUMN rating DECIMAL(2,1) NULL AFTER photo_url;
