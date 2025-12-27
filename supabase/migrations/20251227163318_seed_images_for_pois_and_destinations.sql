-- Seed images for POIs and Destinations using placehold.co
-- Adds 3 images per POI and destination: 1 portrait (600x800) and 2 landscape (800x600)
-- Also updates vw_destinations_public view to expose images from metadata

BEGIN;

-- =========================================================================
-- UPDATE DESTINATIONS: Add images to metadata
-- =========================================================================
UPDATE destinations
SET metadata = COALESCE(metadata, '{}'::jsonb) || 
    jsonb_build_object(
        'images', jsonb_build_array(
            'https://placehold.co/600x800/4A90E2/FFFFFF?text=' || REPLACE(name, ' ', '+'),
            'https://placehold.co/800x600/50C878/FFFFFF?text=' || REPLACE(name, ' ', '+'),
            'https://placehold.co/800x600/FF6B6B/FFFFFF?text=' || REPLACE(name, ' ', '+')
        )
    )
WHERE metadata->'images' IS NULL 
   OR jsonb_array_length(COALESCE(metadata->'images', '[]'::jsonb)) = 0;

-- =========================================================================
-- UPDATE POIs: Add images array (1 portrait + 2 landscape)
-- =========================================================================
UPDATE pois
SET images = jsonb_build_array(
    'https://placehold.co/600x800/4A90E2/FFFFFF?text=' || REPLACE(name, ' ', '+'),
    'https://placehold.co/800x600/50C878/FFFFFF?text=' || REPLACE(name, ' ', '+'),
    'https://placehold.co/800x600/FF6B6B/FFFFFF?text=' || REPLACE(name, ' ', '+')
)
WHERE images IS NULL 
   OR jsonb_array_length(COALESCE(images, '[]'::jsonb)) = 0;

-- =========================================================================
-- UPDATE VIEW: Expose images from metadata for compatibility with package service
-- =========================================================================
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
  d.altitude_m,
  COALESCE(d.metadata->'images', '[]'::jsonb) AS images
FROM destinations d;

GRANT SELECT ON vw_destinations_public TO anon, authenticated;

COMMIT;

