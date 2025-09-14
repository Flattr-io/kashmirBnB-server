-- =========================================================================
-- KASHMIR TOURISM APP - POI MANAGEMENT SCHEMA (UPDATED)
-- Migration: 002_poi_management_schema
-- Description: Points of Interest management, categories, zoom/priority, and location data
-- =========================================================================

-- =========================================================================
-- POI CATEGORIES TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS poi_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50),
    color VARCHAR(7), -- Hex color code
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =========================================================================
-- POIS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS pois (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID NOT NULL REFERENCES poi_categories(id) ON DELETE RESTRICT,

    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    elevation INTEGER, -- meters

    address JSONB DEFAULT '{}'::jsonb,
    contact_info JSONB DEFAULT '{}'::jsonb,
    opening_hours JSONB DEFAULT '{}'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    features JSONB DEFAULT '[]'::jsonb, -- aligned to POIFeature TS structure

    is_active BOOLEAN DEFAULT true,

    -- Map visibility controls
    min_zoom SMALLINT NOT NULL DEFAULT 10 CHECK (min_zoom >= 0 AND min_zoom <= 22),
    max_zoom SMALLINT NOT NULL DEFAULT 20 CHECK (max_zoom >= 0 AND max_zoom <= 22),
    priority SMALLINT NOT NULL DEFAULT 0,

    -- Ratings aggregate
    average_rating DECIMAL(3,2) DEFAULT 0.0 CHECK (average_rating BETWEEN 0 AND 5),
    total_ratings INTEGER DEFAULT 0 CHECK (total_ratings >= 0),

    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT chk_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_elevation CHECK (elevation >= 0 AND elevation <= 10000),
    CONSTRAINT chk_zoom_range CHECK (min_zoom <= max_zoom)
);

-- Add spatial column for queries
ALTER TABLE pois ADD COLUMN IF NOT EXISTS location GEOMETRY(POINT, 4326);

-- =========================================================================
-- POI RATINGS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS poi_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poi_id UUID NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    visit_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, poi_id) -- one rating per user per POI
);

-- =========================================================================
-- WISHLISTS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    poi_id UUID NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, poi_id)
);

-- =========================================================================
-- INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_poi_categories_name ON poi_categories(name);

CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category_id);
CREATE INDEX IF NOT EXISTS idx_pois_active ON pois(is_active);
CREATE INDEX IF NOT EXISTS idx_pois_created_by ON pois(created_by);
CREATE INDEX IF NOT EXISTS idx_pois_location ON pois USING gist(location);

-- New indexes for destination/zoom/priority optimization
CREATE INDEX IF NOT EXISTS idx_pois_destination ON pois(destination_id);
CREATE INDEX IF NOT EXISTS idx_pois_zoom_priority
    ON pois (destination_id, min_zoom, max_zoom, priority DESC);

CREATE INDEX IF NOT EXISTS idx_poi_ratings_poi ON poi_ratings(poi_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);

-- =========================================================================
-- TRIGGERS
-- =========================================================================
-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- POIs trigger
DROP TRIGGER IF EXISTS trg_update_pois_updated_at ON pois;
CREATE TRIGGER trg_update_pois_updated_at
BEFORE UPDATE ON pois
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ratings trigger
DROP TRIGGER IF EXISTS trg_update_poi_ratings_updated_at ON poi_ratings;
CREATE TRIGGER trg_update_poi_ratings_updated_at
BEFORE UPDATE ON poi_ratings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update location from lat/lng
CREATE OR REPLACE FUNCTION update_poi_location()
RETURNS TRIGGER AS $$
BEGIN
   NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_poi_location ON pois;
CREATE TRIGGER trg_update_poi_location
BEFORE INSERT OR UPDATE ON pois
FOR EACH ROW EXECUTE FUNCTION update_poi_location();
