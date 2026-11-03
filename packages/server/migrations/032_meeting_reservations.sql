CREATE TABLE app_office_meeting_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES app_offices(id) ON DELETE CASCADE,
  zone_id varchar(128) NOT NULL,
  zone_name varchar(48) NOT NULL,
  title varchar(96) NOT NULL,
  created_by varchar(24) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (length(trim(zone_id)) BETWEEN 1 AND 128),
  CHECK (length(trim(zone_name)) BETWEEN 1 AND 48),
  CHECK (length(trim(title)) BETWEEN 2 AND 96),
  CHECK (starts_at < ends_at),
  CHECK (ends_at - starts_at <= interval '4 hours')
);

CREATE INDEX app_office_meeting_reservations_schedule
  ON app_office_meeting_reservations(office_id, zone_id, starts_at, ends_at)
  WHERE cancelled_at IS NULL;
