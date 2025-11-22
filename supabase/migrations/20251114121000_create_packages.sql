-- Create normalized storage for generated packages and their components

BEGIN;

-- packages: top-level generated package
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  people INT NOT NULL CHECK (people > 0),
  cab_type TEXT NOT NULL CHECK (cab_type IN ('hatchback','sedan','suv','tempo')),
  total_base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  per_person_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  request JSONB DEFAULT '{}'::jsonb,           -- original request payload
  breakdown JSONB DEFAULT '{}'::jsonb,         -- accommodation/transport/activities/cab
  meta JSONB DEFAULT '{}'::jsonb,              -- additional info like weatherNullDays
  available_cabs JSONB DEFAULT '[]'::jsonb,    -- all available cab options for UI
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- legs: inter-destination travel components
CREATE TABLE IF NOT EXISTS package_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  origin_id UUID NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  distance_km NUMERIC(8,2),
  duration_minutes INT,
  cab_cost NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- days: per-day itinerary within a package
CREATE TABLE IF NOT EXISTS package_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  day_index INT NOT NULL CHECK (day_index >= 0),
  date DATE NOT NULL,
  title TEXT NOT NULL,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  destination_name TEXT NOT NULL,
  destination_altitude_m NUMERIC(8,2),
  activities_cost NUMERIC(12,2),
  transport_cost NUMERIC(12,2),
  leg_transport_cost NUMERIC(12,2),
  hotel JSONB,                                  -- selected hotel object
  hotel_options JSONB,                           -- available hotel options
  weather_snapshot_id UUID REFERENCES weather_snapshots(id) ON DELETE SET NULL,
  weather_daily JSONB,                           -- the daily object used in response
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_package_days_package ON package_days(package_id, day_index);

-- activities tied to each day
CREATE TABLE IF NOT EXISTS package_day_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_day_id UUID NOT NULL REFERENCES package_days(id) ON DELETE CASCADE,
  poi_id UUID NOT NULL REFERENCES pois(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  pricing_type TEXT CHECK (pricing_type IN ('one_time','per_person','rental','free')),
  base_price NUMERIC(12,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- restaurant suggestions per day
CREATE TABLE IF NOT EXISTS package_day_restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_day_id UUID NOT NULL REFERENCES package_days(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price_range TEXT CHECK (price_range IN ('budget','mid_range','premium')),
  suggestion JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Simple updated_at trigger for packages
CREATE OR REPLACE FUNCTION trg_update_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS packages_updated_at ON packages;
CREATE TRIGGER packages_updated_at
BEFORE UPDATE ON packages
FOR EACH ROW EXECUTE FUNCTION trg_update_packages_updated_at();

COMMIT;


