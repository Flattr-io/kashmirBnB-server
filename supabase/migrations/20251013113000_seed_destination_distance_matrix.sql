-- Seed destination_distance_matrix using current geometry centers
-- Populates both directions for all distinct pairs. Duration is an estimate at 40km/h.

BEGIN;

INSERT INTO destination_distance_matrix (origin_id, destination_id, distance_km, duration_minutes)
SELECT
  origin_id,
  destination_id,
  ROUND(distance_km::numeric, 2) AS distance_km,
  CEIL((distance_km / 40.0) * 60.0)::int AS duration_minutes
FROM vw_destination_distances_geom
ON CONFLICT (origin_id, destination_id) DO UPDATE
  SET distance_km = EXCLUDED.distance_km,
      duration_minutes = EXCLUDED.duration_minutes;

COMMIT;


