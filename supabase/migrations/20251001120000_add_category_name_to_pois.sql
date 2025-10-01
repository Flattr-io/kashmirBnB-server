-- =========================================================================
-- Migration: Add denormalized category_name to pois and keep it in sync
-- Date: 2025-10-01
-- Description: Adds category_name to pois, backfills from poi_categories,
--              creates triggers to keep the column synced on changes.
-- =========================================================================

BEGIN;

-- 1) Add column (idempotent)
ALTER TABLE pois
  ADD COLUMN IF NOT EXISTS category_name VARCHAR(100);

-- 2) Backfill existing rows
UPDATE pois p
SET category_name = c.name
FROM poi_categories c
WHERE p.category_id = c.id
  AND (p.category_name IS NULL OR p.category_name <> c.name);

-- 3) Enforce NOT NULL now that data is present
ALTER TABLE pois
  ALTER COLUMN category_name SET NOT NULL;

-- 4) Helpful index for filtering by category name
CREATE INDEX IF NOT EXISTS idx_pois_category_name ON pois(category_name);

-- 5) Trigger to sync category_name when category_id is inserted/updated on pois
CREATE OR REPLACE FUNCTION sync_pois_category_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT name INTO NEW.category_name FROM poi_categories WHERE id = NEW.category_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pois_category_name ON pois;
CREATE TRIGGER trg_sync_pois_category_name
BEFORE INSERT OR UPDATE OF category_id ON pois
FOR EACH ROW EXECUTE FUNCTION sync_pois_category_name();

-- 6) Trigger to propagate category name changes to existing pois
CREATE OR REPLACE FUNCTION propagate_category_name_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pois SET category_name = NEW.name WHERE category_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_category_name_change ON poi_categories;
CREATE TRIGGER trg_propagate_category_name_change
AFTER UPDATE OF name ON poi_categories
FOR EACH ROW EXECUTE FUNCTION propagate_category_name_change();

COMMIT;


