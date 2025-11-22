-- Destination price buckets for accommodation and transport components

BEGIN;

CREATE TABLE IF NOT EXISTS destination_pricing_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  bucket_type TEXT NOT NULL CHECK (bucket_type IN ('budget_conscious','optimal','go_crazy')),
  accommodation_price NUMERIC(10,2) NOT NULL,
  transport_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (destination_id, bucket_type)
);

CREATE OR REPLACE FUNCTION trg_update_destination_pricing_buckets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS destination_pricing_buckets_updated_at ON destination_pricing_buckets;
CREATE TRIGGER destination_pricing_buckets_updated_at
BEFORE UPDATE ON destination_pricing_buckets
FOR EACH ROW EXECUTE FUNCTION trg_update_destination_pricing_buckets_updated_at();

-- Add common attractions availability flag on destinations
ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS common_attractions_enabled BOOLEAN DEFAULT true;

COMMIT;


