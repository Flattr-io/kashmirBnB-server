-- Seed sample pricing buckets for known destinations

BEGIN;

WITH d AS (
  SELECT id, slug FROM destinations WHERE slug IN ('srinagar','gulmarg','pahalgam','sonmarg')
)
INSERT INTO destination_pricing_buckets (destination_id, bucket_type, accommodation_price, transport_price)
SELECT d.id,
       x.bucket_type,
       x.accommodation_price,
       x.transport_price
FROM d
CROSS JOIN (
  VALUES
    ('budget_conscious', 2000.00, 500.00),
    ('optimal',          3500.00, 800.00),
    ('go_crazy',         6000.00, 1200.00)
) AS x(bucket_type, accommodation_price, transport_price)
ON CONFLICT (destination_id, bucket_type) DO UPDATE
SET accommodation_price = EXCLUDED.accommodation_price,
    transport_price = EXCLUDED.transport_price;

COMMIT;

