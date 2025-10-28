-- Cab inventory repository with pricing rules

BEGIN;

CREATE TABLE IF NOT EXISTS cab_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cab_type TEXT NOT NULL CHECK (cab_type IN ('hatchback','sedan','suv','tempo')),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  model_year INT NOT NULL CHECK (model_year >= 1980 AND model_year <= EXTRACT(YEAR FROM NOW())::INT + 1),
  base_price_per_km NUMERIC(8,2) NOT NULL,
  per_day_charge NUMERIC(10,2),
  capacity INT NOT NULL CHECK (capacity >= 1),
  is_available BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION trg_update_cab_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cab_inventory_updated_at ON cab_inventory;
CREATE TRIGGER cab_inventory_updated_at
BEFORE UPDATE ON cab_inventory
FOR EACH ROW EXECUTE FUNCTION trg_update_cab_inventory_updated_at();

COMMIT;


