-- Add base_price to destinations and expose via public view

BEGIN;

ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Recreate view including base_price (append at end to satisfy CREATE OR REPLACE rules)
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
  d.base_price
FROM destinations d;

GRANT SELECT ON vw_destinations_public TO anon, authenticated;

COMMIT;


