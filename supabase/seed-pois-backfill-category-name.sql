-- =========================================================================
-- Seed script: Backfill pois.category_name from poi_categories
-- Safe to rerun; only updates rows where the value differs or is null
-- =========================================================================

UPDATE pois p
SET category_name = c.name
FROM poi_categories c
WHERE p.category_id = c.id
  AND (p.category_name IS NULL OR p.category_name <> c.name);