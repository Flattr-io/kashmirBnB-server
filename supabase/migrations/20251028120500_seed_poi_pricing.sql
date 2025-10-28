-- Backfill initial POI pricing for purchasable attractions

BEGIN;

-- Helper CTEs to map names to IDs (idempotent by ON CONFLICT)
WITH poi_refs AS (
  SELECT id, name, destination_id FROM pois
)
INSERT INTO poi_pricing (poi_id, pricing_type, base_price, currency, is_purchasable, metadata)
SELECT p.id,
       x.pricing_type,
       x.base_price,
       'INR',
       x.is_purchasable,
       (x.metadata::jsonb)
FROM poi_refs p
JOIN (
  VALUES
    -- Srinagar paid attractions
    ('Nishat Bagh',       'per_person', 40.00,  true,  '{"note":"Mughal garden entry ticket"}'),
    ('Shalimar Bagh',     'per_person', 40.00,  true,  '{"note":"Mughal garden entry ticket"}'),
    ('Lal Chowk Market',  'free',        0.00,  false, '{}'),
    -- Gulmarg
    ('Gulmarg Gondola',   'per_person', 800.00, true,  '{"stage":"Phase 1 base fare"}'),
    ('Gulmarg Ski Resort','rental',     2000.00, true, '{"unit":"per_day","gear":"ski set"}')
) AS x(name, pricing_type, base_price, is_purchasable, metadata)
ON p.name = x.name
ON CONFLICT (poi_id) DO UPDATE
SET pricing_type = EXCLUDED.pricing_type,
    base_price = EXCLUDED.base_price,
    currency = EXCLUDED.currency,
    is_purchasable = EXCLUDED.is_purchasable,
    metadata = EXCLUDED.metadata;

COMMIT;


