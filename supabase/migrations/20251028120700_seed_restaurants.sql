-- Seed restaurants for key destinations (3 per destination)

BEGIN;

WITH d AS (
  SELECT id, slug, center_lat, center_lng FROM destinations WHERE slug IN ('srinagar','gulmarg','pahalgam','sonmarg')
)
INSERT INTO restaurants (
  destination_id, name, description, latitude, longitude, address, contact_info,
  opening_hours, images, cuisine_types, veg_non_veg, special_delicacies,
  average_rating, total_ratings, price_range
)
SELECT d.id,
       x.name,
       x.description,
       d.center_lat + x.lat_offset,
       d.center_lng + x.lng_offset,
       jsonb_build_object('city', d.slug),
       '{}'::jsonb,
       '{}'::jsonb,
       '[]'::jsonb,
       x.cuisine_types,
       x.veg_non_veg,
       x.special_delicacies::jsonb,
       x.avg_rating,
       x.total_ratings,
       x.price_range
FROM d
CROSS JOIN (
  VALUES
    -- Budget
    ('Local Bites', 'Affordable local cuisine', 0.005, 0.005, ARRAY['Kashmiri','Indian']::text[], 'both', '[{"name":"Rajma Chawal","price":120}]', 4.2, 250, 'budget'),
    -- Mid range
    ('Valley Dine', 'Family restaurant with varied menu', 0.006, 0.003, ARRAY['Indian','Continental']::text[], 'both', '[{"name":"Rogan Josh","price":380}]', 4.4, 180, 'mid_range'),
    -- Premium
    ('Skyline Grill', 'Fine dining with city views', 0.004, 0.006, ARRAY['Kashmiri','Mughlai']::text[], 'non_veg', '[{"name":"Gushtaba","price":650}]', 4.6, 320, 'premium')
) AS x(name, description, lat_offset, lng_offset, cuisine_types, veg_non_veg, special_delicacies, avg_rating, total_ratings, price_range)
ON CONFLICT DO NOTHING;

COMMIT;


