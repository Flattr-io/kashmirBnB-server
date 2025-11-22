-- Restaurants linked to destinations with ratings and specialties

BEGIN;

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  latitude NUMERIC(10,8) NOT NULL,
  longitude NUMERIC(11,8) NOT NULL,
  address JSONB DEFAULT '{}'::jsonb,
  contact_info JSONB DEFAULT '{}'::jsonb,
  opening_hours JSONB DEFAULT '{}'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  cuisine_types TEXT[],
  veg_non_veg TEXT CHECK (veg_non_veg IN ('veg','non_veg','both')),
  special_delicacies JSONB DEFAULT '[]'::jsonb,
  average_rating NUMERIC(3,2) DEFAULT 0.0 CHECK (average_rating BETWEEN 0 AND 5),
  total_ratings INT DEFAULT 0,
  price_range TEXT CHECK (price_range IN ('budget','mid_range','premium')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial location column and trigger
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS location GEOMETRY(POINT, 4326);

CREATE OR REPLACE FUNCTION trg_update_restaurant_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restaurants_update_location ON restaurants;
CREATE TRIGGER restaurants_update_location
BEFORE INSERT OR UPDATE ON restaurants
FOR EACH ROW EXECUTE FUNCTION trg_update_restaurant_location();

CREATE OR REPLACE FUNCTION trg_update_restaurants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restaurants_updated_at ON restaurants;
CREATE TRIGGER restaurants_updated_at
BEFORE UPDATE ON restaurants
FOR EACH ROW EXECUTE FUNCTION trg_update_restaurants_updated_at();

COMMIT;


