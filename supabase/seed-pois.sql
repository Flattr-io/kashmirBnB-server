-- =========================================================================
-- KASHMIR TOURISM APP - POIs AND RATINGS SEED DATA
-- Description: Seed data for Points of Interest and POI ratings with proper foreign key relationships
-- =========================================================================

-- =========================================================================
-- CLEAR EXISTING POI DATA (for clean reset)
-- =========================================================================
DELETE FROM poi_ratings;
DELETE FROM wishlists;
DELETE FROM pois;

-- =========================================================================
-- INSERT POIs WITH PROPER FOREIGN KEY RELATIONSHIPS
-- =========================================================================

-- Ensure core POI categories exist (idempotent upsert by name)
INSERT INTO poi_categories (name, icon, color, description, created_at)
VALUES
  ('Lakes & Water Bodies', 'water', '#1E90FF', 'Lakes, rivers and water attractions', NOW()),
  ('Gardens & Parks', 'park', '#32CD32', 'Gardens, parks and public green spaces', NOW()),
  ('Religious Sites', 'place-of-worship', '#8A2BE2', 'Temples, shrines and religious places', NOW()),
  ('Shopping & Markets', 'shopping-bag', '#FF8C00', 'Markets and shopping districts', NOW()),
  ('Transportation', 'cable-car', '#708090', 'Transport and cable cars', NOW()),
  ('Adventure Sports', 'activity', '#DC143C', 'Adventure and outdoor sports', NOW()),
  ('Viewpoints', 'camera', '#2F4F4F', 'Scenic viewpoints and peaks', NOW())
ON CONFLICT (name) DO NOTHING;

-- Get destination and category IDs for reference
WITH destination_refs AS (
  SELECT id, name FROM destinations WHERE name IN ('Srinagar', 'Gulmarg', 'Pahalgam', 'Sonmarg')
),
category_refs AS (
  SELECT id, name FROM poi_categories
)
INSERT INTO pois (
  id, destination_id, name, description, category_id, 
  latitude, longitude, elevation, address, contact_info, 
  opening_hours, images, features, is_active, 
  min_zoom, max_zoom, priority, average_rating, total_ratings, 
  created_by, created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  d.id,
  poi_data.name,
  poi_data.description,
  c.id,
  poi_data.latitude,
  poi_data.longitude,
  poi_data.elevation,
  poi_data.address::jsonb,
  poi_data.contact_info::jsonb,
  poi_data.opening_hours::jsonb,
  poi_data.images::jsonb,
  poi_data.features::jsonb,
  true,
  poi_data.min_zoom,
  poi_data.max_zoom,
  poi_data.priority,
  0.0,
  0,
  NULL,
  NOW(),
  NOW()
FROM destination_refs d
CROSS JOIN category_refs c
CROSS JOIN (
  VALUES 
    -- Srinagar POIs
    ('Srinagar', 'Lakes & Water Bodies', 'Dal Lake', 
     'The jewel of Srinagar, famous for its houseboats, shikaras, and floating gardens. A must-visit for every tourist.', 
     34.0889, 74.8083, 1585, 
     '{"area": "Dal Lake Area", "city": "Srinagar", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-1234", "email": "info@dallake.com"}', 
     '{"monday": "6:00 AM - 8:00 PM", "tuesday": "6:00 AM - 8:00 PM", "wednesday": "6:00 AM - 8:00 PM", "thursday": "6:00 AM - 8:00 PM", "friday": "6:00 AM - 8:00 PM", "saturday": "6:00 AM - 8:00 PM", "sunday": "6:00 AM - 8:00 PM"}', 
     '["https://example.com/dal-lake-1.jpg", "https://example.com/dal-lake-2.jpg"]', 
     '["houseboats", "shikara_rides", "floating_gardens", "sunset_views", "photography"]', 
     10, 20, 10),
    
    ('Srinagar', 'Gardens & Parks', 'Nishat Bagh', 
     'The Garden of Joy, one of the most beautiful Mughal gardens with terraced lawns and fountains.', 
     34.0911, 74.8256, 1620, 
     '{"area": "Nishat", "city": "Srinagar", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-2345"}', 
     '{"monday": "9:00 AM - 7:00 PM", "tuesday": "9:00 AM - 7:00 PM", "wednesday": "9:00 AM - 7:00 PM", "thursday": "9:00 AM - 7:00 PM", "friday": "9:00 AM - 7:00 PM", "saturday": "9:00 AM - 7:00 PM", "sunday": "9:00 AM - 7:00 PM"}', 
     '["https://example.com/nishat-bagh-1.jpg", "https://example.com/nishat-bagh-2.jpg"]', 
     '["mughal_garden", "terraced_lawns", "fountains", "mountain_views", "photography"]', 
     12, 20, 8),
    
    ('Srinagar', 'Gardens & Parks', 'Shalimar Bagh', 
     'The Garden of Love, another magnificent Mughal garden with beautiful water channels and pavilions.', 
     34.0956, 74.8333, 1630, 
     '{"area": "Shalimar", "city": "Srinagar", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-3456"}', 
     '{"monday": "9:00 AM - 7:00 PM", "tuesday": "9:00 AM - 7:00 PM", "wednesday": "9:00 AM - 7:00 PM", "thursday": "9:00 AM - 7:00 PM", "friday": "9:00 AM - 7:00 PM", "saturday": "9:00 AM - 7:00 PM", "sunday": "9:00 AM - 7:00 PM"}', 
     '["https://example.com/shalimar-bagh-1.jpg", "https://example.com/shalimar-bagh-2.jpg"]', 
     '["mughal_garden", "water_channels", "pavilions", "historical_significance", "photography"]', 
     12, 20, 8),
    
    ('Srinagar', 'Religious Sites', 'Hazratbal Shrine', 
     'Sacred Muslim shrine housing a holy relic, known for its beautiful white marble architecture.', 
     34.1056, 74.8417, 1590, 
     '{"area": "Hazratbal", "city": "Srinagar", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-4567"}', 
     '{"monday": "5:00 AM - 9:00 PM", "tuesday": "5:00 AM - 9:00 PM", "wednesday": "5:00 AM - 9:00 PM", "thursday": "5:00 AM - 9:00 PM", "friday": "5:00 AM - 9:00 PM", "saturday": "5:00 AM - 9:00 PM", "sunday": "5:00 AM - 9:00 PM"}', 
     '["https://example.com/hazratbal-1.jpg", "https://example.com/hazratbal-2.jpg"]', 
     '["religious_site", "marble_architecture", "holy_relic", "prayer_hall", "peaceful_ambiance"]', 
     11, 20, 7),
    
    ('Srinagar', 'Shopping & Markets', 'Lal Chowk Market', 
     'The heart of Srinagar, bustling with shops selling Kashmiri handicrafts, shawls, and souvenirs.', 
     34.0833, 74.7917, 1585, 
     '{"area": "Lal Chowk", "city": "Srinagar", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-5678"}', 
     '{"monday": "10:00 AM - 8:00 PM", "tuesday": "10:00 AM - 8:00 PM", "wednesday": "10:00 AM - 8:00 PM", "thursday": "10:00 AM - 8:00 PM", "friday": "10:00 AM - 8:00 PM", "saturday": "10:00 AM - 8:00 PM", "sunday": "10:00 AM - 8:00 PM"}', 
     '["https://example.com/lal-chowk-1.jpg", "https://example.com/lal-chowk-2.jpg"]', 
     '["shopping", "handicrafts", "shawls", "souvenirs", "local_culture"]', 
     13, 20, 6),
    
    -- Gulmarg POIs
    ('Gulmarg', 'Transportation', 'Gulmarg Gondola', 
     'One of the highest cable cars in the world, offering breathtaking views of snow-capped mountains.', 
     34.0489, 74.3803, 2730, 
     '{"area": "Gulmarg", "city": "Gulmarg", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-6789", "website": "www.gulmarggondola.com"}', 
     '{"monday": "9:00 AM - 5:00 PM", "tuesday": "9:00 AM - 5:00 PM", "wednesday": "9:00 AM - 5:00 PM", "thursday": "9:00 AM - 5:00 PM", "friday": "9:00 AM - 5:00 PM", "saturday": "9:00 AM - 5:00 PM", "sunday": "9:00 AM - 5:00 PM"}', 
     '["https://example.com/gondola-1.jpg", "https://example.com/gondola-2.jpg"]', 
     '["cable_car", "mountain_views", "snow_capped_peaks", "adventure", "photography"]', 
     10, 20, 10),
    
    ('Gulmarg', 'Adventure Sports', 'Gulmarg Golf Course', 
     'The highest golf course in the world at 2,650 meters above sea level.', 
     34.0511, 74.3822, 2650, 
     '{"area": "Gulmarg", "city": "Gulmarg", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-7890", "email": "golf@gulmarg.com"}', 
     '{"monday": "6:00 AM - 6:00 PM", "tuesday": "6:00 AM - 6:00 PM", "wednesday": "6:00 AM - 6:00 PM", "thursday": "6:00 AM - 6:00 PM", "friday": "6:00 AM - 6:00 PM", "saturday": "6:00 AM - 6:00 PM", "sunday": "6:00 AM - 6:00 PM"}', 
     '["https://example.com/golf-course-1.jpg", "https://example.com/golf-course-2.jpg"]', 
     '["golf", "highest_golf_course", "mountain_views", "sports", "scenic"]', 
     12, 20, 7),
    
    ('Gulmarg', 'Viewpoints', 'Apharwat Peak', 
     'A popular skiing destination and viewpoint accessible by gondola, offering panoramic mountain views.', 
     34.0556, 74.3856, 4100, 
     '{"area": "Apharwat", "city": "Gulmarg", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-8901"}', 
     '{"monday": "9:00 AM - 4:00 PM", "tuesday": "9:00 AM - 4:00 PM", "wednesday": "9:00 AM - 4:00 PM", "thursday": "9:00 AM - 4:00 PM", "friday": "9:00 AM - 4:00 PM", "saturday": "9:00 AM - 4:00 PM", "sunday": "9:00 AM - 4:00 PM"}', 
     '["https://example.com/apharwat-1.jpg", "https://example.com/apharwat-2.jpg"]', 
     '["skiing", "mountain_peak", "panoramic_views", "adventure", "snow"]', 
     11, 20, 9),
    
    ('Gulmarg', 'Adventure Sports', 'Gulmarg Ski Resort', 
     'World-class skiing destination with excellent slopes and facilities for all skill levels.', 
     34.0494, 74.3817, 2750, 
     '{"area": "Gulmarg", "city": "Gulmarg", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-9012", "email": "ski@gulmarg.com", "website": "www.gulmargski.com"}', 
     '{"monday": "8:00 AM - 5:00 PM", "tuesday": "8:00 AM - 5:00 PM", "wednesday": "8:00 AM - 5:00 PM", "thursday": "8:00 AM - 5:00 PM", "friday": "8:00 AM - 5:00 PM", "saturday": "8:00 AM - 5:00 PM", "sunday": "8:00 AM - 5:00 PM"}', 
     '["https://example.com/ski-resort-1.jpg", "https://example.com/ski-resort-2.jpg"]', 
     '["skiing", "snow_sports", "equipment_rental", "lessons", "adventure"]', 
     10, 20, 8),
    
    -- Pahalgam POIs
    ('Pahalgam', 'Viewpoints', 'Betaab Valley', 
     'Picturesque valley named after the Bollywood movie Betaab, known for its lush green meadows and crystal-clear streams.', 
     34.0200, 75.2100, 2200, 
     '{"area": "Betaab Valley", "city": "Pahalgam", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-0123"}', 
     '{"monday": "8:00 AM - 6:00 PM", "tuesday": "8:00 AM - 6:00 PM", "wednesday": "8:00 AM - 6:00 PM", "thursday": "8:00 AM - 6:00 PM", "friday": "8:00 AM - 6:00 PM", "saturday": "8:00 AM - 6:00 PM", "sunday": "8:00 AM - 6:00 PM"}', 
     '["https://example.com/betaab-valley-1.jpg", "https://example.com/betaab-valley-2.jpg"]', 
     '["meadows", "streams", "photography", "nature", "scenic_views"]', 
     11, 20, 9),
    
    ('Pahalgam', 'Adventure Sports', 'Aru Valley', 
     'Base camp for many treks, offering stunning views of snow-capped mountains and alpine meadows.', 
     34.0250, 75.2250, 2400, 
     '{"area": "Aru Valley", "city": "Pahalgam", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-1234"}', 
     '{"monday": "8:00 AM - 6:00 PM", "tuesday": "8:00 AM - 6:00 PM", "wednesday": "8:00 AM - 6:00 PM", "thursday": "8:00 AM - 6:00 PM", "friday": "8:00 AM - 6:00 PM", "saturday": "8:00 AM - 6:00 PM", "sunday": "8:00 AM - 6:00 PM"}', 
     '["https://example.com/aru-valley-1.jpg", "https://example.com/aru-valley-2.jpg"]', 
     '["trekking", "alpine_meadows", "mountain_views", "base_camp", "adventure"]', 
     10, 20, 8),
    
    ('Pahalgam', 'Religious Sites', 'Chandanwari', 
     'Starting point of the Amarnath Yatra pilgrimage, known for its snow-covered landscapes and scenic beauty.', 
     34.0300, 75.2400, 2895, 
     '{"area": "Chandanwari", "city": "Pahalgam", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-2345"}', 
     '{"monday": "6:00 AM - 4:00 PM", "tuesday": "6:00 AM - 4:00 PM", "wednesday": "6:00 AM - 4:00 PM", "thursday": "6:00 AM - 4:00 PM", "friday": "6:00 AM - 4:00 PM", "saturday": "6:00 AM - 4:00 PM", "sunday": "6:00 AM - 4:00 PM"}', 
     '["https://example.com/chandanwari-1.jpg", "https://example.com/chandanwari-2.jpg"]', 
     '["pilgrimage", "snow_landscapes", "amarnath_yatra", "religious", "scenic"]', 
     10, 20, 7),
    
    ('Pahalgam', 'Lakes & Water Bodies', 'Lidder River', 
     'Crystal-clear mountain river perfect for trout fishing and peaceful walks along its banks.', 
     34.0151, 75.1928, 2130, 
     '{"area": "Pahalgam", "city": "Pahalgam", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-3456"}', 
     '{"monday": "6:00 AM - 8:00 PM", "tuesday": "6:00 AM - 8:00 PM", "wednesday": "6:00 AM - 8:00 PM", "thursday": "6:00 AM - 8:00 PM", "friday": "6:00 AM - 8:00 PM", "saturday": "6:00 AM - 8:00 PM", "sunday": "6:00 AM - 8:00 PM"}', 
     '["https://example.com/lidder-river-1.jpg", "https://example.com/lidder-river-2.jpg"]', 
     '["river", "fishing", "nature_walks", "peaceful", "crystal_clear"]', 
     12, 20, 6),
    
    -- Sonmarg POIs
    ('Sonmarg', 'Adventure Sports', 'Thajiwas Glacier', 
     'Beautiful glacier accessible by pony ride or trek, offering stunning views of snow-capped peaks.', 
     34.3100, 75.3200, 3200, 
     '{"area": "Thajiwas", "city": "Sonmarg", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-4567"}', 
     '{"monday": "8:00 AM - 5:00 PM", "tuesday": "8:00 AM - 5:00 PM", "wednesday": "8:00 AM - 5:00 PM", "thursday": "8:00 AM - 5:00 PM", "friday": "8:00 AM - 5:00 PM", "saturday": "8:00 AM - 5:00 PM", "sunday": "8:00 AM - 5:00 PM"}', 
     '["https://example.com/thajiwas-glacier-1.jpg", "https://example.com/thajiwas-glacier-2.jpg"]', 
     '["glacier", "trekking", "pony_ride", "snow_peaks", "adventure"]', 
     10, 20, 9),
    
    ('Sonmarg', 'Viewpoints', 'Zojila Pass', 
     'High mountain pass connecting Kashmir to Ladakh, offering breathtaking views and challenging terrain.', 
     34.3500, 75.4000, 3528, 
     '{"area": "Zojila Pass", "city": "Sonmarg", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-5678"}', 
     '{"monday": "6:00 AM - 6:00 PM", "tuesday": "6:00 AM - 6:00 PM", "wednesday": "6:00 AM - 6:00 PM", "thursday": "6:00 AM - 6:00 PM", "friday": "6:00 AM - 6:00 PM", "saturday": "6:00 AM - 6:00 PM", "sunday": "6:00 AM - 6:00 PM"}', 
     '["https://example.com/zojila-pass-1.jpg", "https://example.com/zojila-pass-2.jpg"]', 
     '["mountain_pass", "high_altitude", "scenic_views", "challenging_terrain", "photography"]', 
     9, 20, 8),
    
    ('Sonmarg', 'Religious Sites', 'Baltal Valley', 
     'Alternative base camp for Amarnath Yatra, known for its beautiful meadows and mountain views.', 
     34.2800, 75.3500, 3000, 
     '{"area": "Baltal", "city": "Sonmarg", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-6789"}', 
     '{"monday": "6:00 AM - 6:00 PM", "tuesday": "6:00 AM - 6:00 PM", "wednesday": "6:00 AM - 6:00 PM", "thursday": "6:00 AM - 6:00 PM", "friday": "6:00 AM - 6:00 PM", "saturday": "6:00 AM - 6:00 PM", "sunday": "6:00 AM - 6:00 PM"}', 
     '["https://example.com/baltal-valley-1.jpg", "https://example.com/baltal-valley-2.jpg"]', 
     '["pilgrimage", "meadows", "mountain_views", "amarnath_yatra", "peaceful"]', 
     10, 20, 7),
    
    ('Sonmarg', 'Adventure Sports', 'Sonmarg Golf Course', 
     'High-altitude golf course offering unique playing experience with mountain backdrops.', 
     34.2917, 75.2986, 2800, 
     '{"area": "Sonmarg", "city": "Sonmarg", "state": "Jammu and Kashmir"}', 
     '{"phone": "+91-194-250-7890", "email": "golf@sonmarg.com"}', 
     '{"monday": "7:00 AM - 6:00 PM", "tuesday": "7:00 AM - 6:00 PM", "wednesday": "7:00 AM - 6:00 PM", "thursday": "7:00 AM - 6:00 PM", "friday": "7:00 AM - 6:00 PM", "saturday": "7:00 AM - 6:00 PM", "sunday": "7:00 AM - 6:00 PM"}', 
     '["https://example.com/sonmarg-golf-1.jpg", "https://example.com/sonmarg-golf-2.jpg"]', 
     '["golf", "high_altitude", "mountain_backdrop", "sports", "scenic"]', 
     12, 20, 6)
) AS poi_data(destination_name, category_name, name, description, latitude, longitude, elevation, address, contact_info, opening_hours, images, features, min_zoom, max_zoom, priority)
WHERE d.name = poi_data.destination_name AND c.name = poi_data.category_name;

-- Insert auth users (idempotent on email) - trigger will hydrate public.users and user_profiles
INSERT INTO auth.users (id, email, phone, raw_user_meta_data, email_confirmed_at, created_at, updated_at, aud, role)
SELECT gen_random_uuid(), rd.email, rd.phone, jsonb_build_object('full_name', rd.full_name), NOW(), NOW(), NOW(), 'authenticated', 'authenticated'
FROM (
  VALUES
    ('Dal Lake', 'Ayaan Khan', 'ayaan.khan+dl1@example.com', '+91-9000000001', 5, 'Absolutely breathtaking! The houseboat experience was magical. The sunset views from the shikara were unforgettable.', '["https://example.com/dal-lake-review-1.jpg"]', '2024-08-15'),
    ('Dal Lake', 'Sara Ali', 'sara.ali+dl2@example.com', '+91-9000000002', 5, 'A must-visit destination! The floating gardens and the peaceful atmosphere make it perfect for relaxation.', '["https://example.com/dal-lake-review-2.jpg"]', '2024-07-20'),
    ('Dal Lake', 'Kabir Singh', 'kabir.singh+dl3@example.com', '+91-9000000003', 4, 'Beautiful place but quite crowded during peak season. The shikara ride was worth every penny though.', '[]', '2024-06-10'),
    ('Nishat Bagh', 'Meera Verma', 'meera.verma+nb1@example.com', '+91-9000000004', 5, 'The most beautiful Mughal garden I have ever seen. The terraced design and fountains are simply amazing.', '["https://example.com/nishat-review-1.jpg"]', '2024-08-16'),
    ('Nishat Bagh', 'Rohit Das', 'rohit.das+nb2@example.com', '+91-9000000005', 4, 'Great place for photography. The mountain backdrop makes it even more beautiful. Can get crowded on weekends.', '[]', '2024-07-25'),
    ('Gulmarg Gondola', 'Inaaya Shah', 'inaaya.shah+gg1@example.com', '+91-9000000006', 5, 'Incredible experience! The views from the top are absolutely stunning. A bit expensive but totally worth it.', '["https://example.com/gondola-review-1.jpg"]', '2024-08-05'),
    ('Gulmarg Gondola', 'Arjun Patel', 'arjun.patel+gg2@example.com', '+91-9000000007', 5, 'One of the best cable car rides in the world. The snow-capped peaks and valley views are mesmerizing.', '["https://example.com/gondola-review-2.jpg"]', '2024-07-30'),
    ('Gulmarg Gondola', 'Leena Rao', 'leena.rao+gg3@example.com', '+91-9000000008', 4, 'Amazing views but the wait time can be long during peak season. Book in advance if possible.', '[]', '2024-06-15'),
    ('Betaab Valley', 'Vikram Joshi', 'vikram.joshi+bv1@example.com', '+91-9000000009', 5, 'Paradise on earth! The lush green meadows and crystal-clear streams are perfect for nature lovers.', '["https://example.com/betaab-review-1.jpg"]', '2024-08-10'),
    ('Betaab Valley', 'Nisha Kapoor', 'nisha.kapoor+bv2@example.com', '+91-9000000010', 4, 'Beautiful place but the weather can be unpredictable. Make sure to carry warm clothes.', '[]', '2024-07-12'),
    ('Aru Valley', 'Farhan Ali', 'farhan.ali+av1@example.com', '+91-9000000011', 5, 'Perfect base for trekking! The alpine meadows and mountain views are incredible. Great for adventure seekers.', '["https://example.com/aru-review-1.jpg"]', '2024-08-08'),
    ('Zojila Pass', 'Ananya Gupta', 'ananya.gupta+zp1@example.com', '+91-9000000012', 5, 'Epic mountain pass! The drive is challenging but the views are absolutely worth it. Not for the faint-hearted.', '["https://example.com/zojila-review-1.jpg"]', '2024-08-03')
) AS rd(poi_name, full_name, email, phone, rating, review, images, visit_date)
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au WHERE au.email = rd.email
);

-- User profiles are created by trigger on auth.users; no manual insert needed

-- Insert ratings, one user per rating (idempotent on unique (user_id, poi_id))
INSERT INTO poi_ratings (poi_id, user_id, rating, review, images, visit_date)
SELECT p.id, u.id, rd.rating, rd.review, rd.images::jsonb, rd.visit_date::date
FROM (
  VALUES 
    ('Dal Lake', 'Ayaan Khan', 'ayaan.khan+dl1@example.com', '+91-9000000001', 5, 'Absolutely breathtaking! The houseboat experience was magical. The sunset views from the shikara were unforgettable.', '["https://example.com/dal-lake-review-1.jpg"]', '2024-08-15'),
    ('Dal Lake', 'Sara Ali', 'sara.ali+dl2@example.com', '+91-9000000002', 5, 'A must-visit destination! The floating gardens and the peaceful atmosphere make it perfect for relaxation.', '["https://example.com/dal-lake-review-2.jpg"]', '2024-07-20'),
    ('Dal Lake', 'Kabir Singh', 'kabir.singh+dl3@example.com', '+91-9000000003', 4, 'Beautiful place but quite crowded during peak season. The shikara ride was worth every penny though.', '[]', '2024-06-10'),
    ('Nishat Bagh', 'Meera Verma', 'meera.verma+nb1@example.com', '+91-9000000004', 5, 'The most beautiful Mughal garden I have ever seen. The terraced design and fountains are simply amazing.', '["https://example.com/nishat-review-1.jpg"]', '2024-08-16'),
    ('Nishat Bagh', 'Rohit Das', 'rohit.das+nb2@example.com', '+91-9000000005', 4, 'Great place for photography. The mountain backdrop makes it even more beautiful. Can get crowded on weekends.', '[]', '2024-07-25'),
    ('Gulmarg Gondola', 'Inaaya Shah', 'inaaya.shah+gg1@example.com', '+91-9000000006', 5, 'Incredible experience! The views from the top are absolutely stunning. A bit expensive but totally worth it.', '["https://example.com/gondola-review-1.jpg"]', '2024-08-05'),
    ('Gulmarg Gondola', 'Arjun Patel', 'arjun.patel+gg2@example.com', '+91-9000000007', 5, 'One of the best cable car rides in the world. The snow-capped peaks and valley views are mesmerizing.', '["https://example.com/gondola-review-2.jpg"]', '2024-07-30'),
    ('Gulmarg Gondola', 'Leena Rao', 'leena.rao+gg3@example.com', '+91-9000000008', 4, 'Amazing views but the wait time can be long during peak season. Book in advance if possible.', '[]', '2024-06-15'),
    ('Betaab Valley', 'Vikram Joshi', 'vikram.joshi+bv1@example.com', '+91-9000000009', 5, 'Paradise on earth! The lush green meadows and crystal-clear streams are perfect for nature lovers.', '["https://example.com/betaab-review-1.jpg"]', '2024-08-10'),
    ('Betaab Valley', 'Nisha Kapoor', 'nisha.kapoor+bv2@example.com', '+91-9000000010', 4, 'Beautiful place but the weather can be unpredictable. Make sure to carry warm clothes.', '[]', '2024-07-12'),
    ('Aru Valley', 'Farhan Ali', 'farhan.ali+av1@example.com', '+91-9000000011', 5, 'Perfect base for trekking! The alpine meadows and mountain views are incredible. Great for adventure seekers.', '["https://example.com/aru-review-1.jpg"]', '2024-08-08'),
    ('Zojila Pass', 'Ananya Gupta', 'ananya.gupta+zp1@example.com', '+91-9000000012', 5, 'Epic mountain pass! The drive is challenging but the views are absolutely worth it. Not for the faint-hearted.', '["https://example.com/zojila-review-1.jpg"]', '2024-08-03')
) AS rd(poi_name, full_name, email, phone, rating, review, images, visit_date)
JOIN pois p ON p.name = rd.poi_name
JOIN users u ON u.email = rd.email
ON CONFLICT (user_id, poi_id) DO NOTHING;

-- (Removed cross-join bulk insert to avoid duplicate/invalid user links)

-- =========================================================================
-- UPDATE POI RATINGS AGGREGATES
-- =========================================================================
UPDATE pois SET 
    average_rating = (
        SELECT ROUND(AVG(rating)::numeric, 2) 
        FROM poi_ratings 
        WHERE poi_ratings.poi_id = pois.id
    ),
    total_ratings = (
        SELECT COUNT(*) 
        FROM poi_ratings 
        WHERE poi_ratings.poi_id = pois.id
    )
WHERE id IN (
    SELECT DISTINCT poi_id 
    FROM poi_ratings
);
