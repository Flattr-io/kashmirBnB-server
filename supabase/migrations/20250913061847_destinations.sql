-- Table
CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) UNIQUE NOT NULL,
  area GEOMETRY(POLYGON, 4326) NOT NULL,
  center GEOMETRY(POINT, 4326) NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_center_lat_range CHECK (center_lat BETWEEN -90 AND 90),
  CONSTRAINT chk_center_lng_range CHECK (center_lng BETWEEN -180 AND 180),
  CONSTRAINT chk_center_matches_coords CHECK (
    ST_Equals(center, ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326))
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_destinations_area_gix
  ON destinations USING GIST (area);

CREATE INDEX IF NOT EXISTS idx_destinations_center_gix
  ON destinations USING GIST (center);

CREATE INDEX IF NOT EXISTS idx_destinations_name_trgm
  ON destinations USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_destinations_created_at
  ON destinations (created_at);

CREATE INDEX IF NOT EXISTS idx_destinations_created_by
  ON destinations (created_by);

-- Timestamps trigger
DROP TRIGGER IF EXISTS trg_destinations_timestamps ON destinations;
CREATE TRIGGER trg_destinations_timestamps
  BEFORE INSERT OR UPDATE ON destinations
  FOR EACH ROW EXECUTE FUNCTION update_timestamps();

-- RLS
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "destinations_public_read" ON destinations
  FOR SELECT USING (true);

CREATE POLICY "destinations_auth_insert" ON destinations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "destinations_auth_update" ON destinations
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "destinations_auth_delete" ON destinations
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE destinations IS
  'Top-level geographic areas used to group POIs and fetch weather by center.';

COMMENT ON COLUMN destinations.area IS
  'Polygon in EPSG:4326 representing the destination boundary.';

COMMENT ON COLUMN destinations.center IS
  'Point geometry (EPSG:4326) for anchoring map and weather lookups.';

COMMENT ON COLUMN destinations.slug IS
  'URL-safe unique identifier for stable references across features.';
