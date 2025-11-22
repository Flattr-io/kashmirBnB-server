-- Extend packages schema to support booking flow and denormalized references

BEGIN;

-- Booking flow columns
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_status TEXT NOT NULL DEFAULT 'generated'
    CHECK (booking_status IN ('generated','awaiting_auth','awaiting_verification','pending_kyc','booked','cancelled'));

-- Denormalized references for quick reads
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS destination_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS weather_snapshot_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS activities_refs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS restaurant_refs JSONB DEFAULT '[]'::jsonb;

-- Normalized join table for destination references with FK enforcement
CREATE TABLE IF NOT EXISTS package_destinations (
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  day_index INT NOT NULL CHECK (day_index >= 0),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  PRIMARY KEY (package_id, day_index)
);

CREATE INDEX IF NOT EXISTS ix_package_destinations_pkg ON package_destinations(package_id);
CREATE INDEX IF NOT EXISTS ix_package_destinations_dest ON package_destinations(destination_id);

COMMIT;


