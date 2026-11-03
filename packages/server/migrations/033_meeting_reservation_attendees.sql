ALTER TABLE app_office_meeting_reservations
  ADD COLUMN attendee_count integer NOT NULL DEFAULT 1
  CHECK (attendee_count BETWEEN 1 AND 500);
