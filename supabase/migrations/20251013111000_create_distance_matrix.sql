-- Create a static distance matrix table between destinations

BEGIN;

CREATE TABLE IF NOT EXISTS destination_distance_matrix (
  origin_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  distance_km NUMERIC(6,2) NOT NULL,
  duration_minutes INT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (origin_id, destination_id)
);

-- Helper view to compute geodesic distance from geometry if needed later
CREATE OR REPLACE VIEW vw_destination_distances_geom AS
SELECT a.id AS origin_id, b.id AS destination_id,
  ST_DistanceSphere(a.center, b.center) / 1000.0 AS distance_km
FROM destinations a CROSS JOIN destinations b
WHERE a.id <> b.id;

COMMIT;