-- POI pricing for purchasable activities

BEGIN;

CREATE TABLE IF NOT EXISTS poi_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id UUID NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('one_time','per_person','rental','free')),
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  is_purchasable BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poi_id)
);

CREATE OR REPLACE FUNCTION trg_update_poi_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS poi_pricing_updated_at ON poi_pricing;
CREATE TRIGGER poi_pricing_updated_at
BEFORE UPDATE ON poi_pricing
FOR EACH ROW EXECUTE FUNCTION trg_update_poi_pricing_updated_at();

COMMIT;


