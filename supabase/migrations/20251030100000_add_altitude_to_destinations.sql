-- Add altitude (meters) to destinations and expose via public view

BEGIN;

ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS altitude_m NUMERIC(7,2);

-- Recreate public view to include altitude_m
DROP VIEW IF EXISTS vw_destinations_public;
CREATE VIEW vw_destinations_public AS
SELECT
  d.id,
  d.name,
  d.slug,
  d.metadata,
  d.created_by,
  d.created_at,
  d.updated_at,
  d.center_lat,
  d.center_lng,
  ST_AsGeoJSON(d.area)  AS area_geojson,
  ST_AsGeoJSON(d.center) AS center_geojson,
  d.base_price,
  d.altitude_m
FROM destinations d;

GRANT SELECT ON vw_destinations_public TO anon, authenticated;

COMMIT;


