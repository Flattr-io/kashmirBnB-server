-- Prereqs
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reuse update_timestamps() from user schema

-- Weather snapshots only
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL, -- date in destination local timezone
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_final BOOLEAN NOT NULL DEFAULT false, -- once true, that day's snapshot must not be overwritten
  mapped JSONB NOT NULL, -- simplified/mapped payload for frontend
  checksum TEXT, -- optional hash of mapped to detect changes
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_mapped_has_hourly CHECK (mapped ? 'hourly'),
  CONSTRAINT chk_mapped_has_daily CHECK (mapped ? 'daily'),
  CONSTRAINT chk_mapped_hourly_array CHECK (
    jsonb_typeof(mapped->'hourly') = 'array'
  ),
  CONSTRAINT chk_mapped_daily_array CHECK (
    jsonb_typeof(mapped->'daily') = 'array'
  )
);

-- One snapshot per destination per local date
CREATE UNIQUE INDEX IF NOT EXISTS ux_weather_destination_date
  ON weather_snapshots (destination_id, snapshot_date);

-- Fetch optimizations
CREATE INDEX IF NOT EXISTS ix_weather_destination_fetched_at
  ON weather_snapshots (destination_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS ix_weather_is_final
  ON weather_snapshots (is_final);

-- Optional: latest non-final per destination
CREATE INDEX IF NOT EXISTS ix_weather_destination_nonfinal_fetched
  ON weather_snapshots (destination_id, fetched_at DESC)
  WHERE is_final = false;

-- Optional: final per destination fast lookup
CREATE INDEX IF NOT EXISTS ix_weather_destination_final
  ON weather_snapshots (destination_id, snapshot_date)
  WHERE is_final = true;

-- Timestamps trigger
DROP TRIGGER IF EXISTS trg_weather_snapshots_timestamps ON weather_snapshots;
CREATE TRIGGER trg_weather_snapshots_timestamps
  BEFORE INSERT OR UPDATE ON weather_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_timestamps();

-- RLS (optional; adjust per access model)
ALTER TABLE weather_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weather_public_read" ON weather_snapshots
  FOR SELECT USING (true);

CREATE POLICY "weather_auth_write" ON weather_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "weather_auth_update" ON weather_snapshots
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);
