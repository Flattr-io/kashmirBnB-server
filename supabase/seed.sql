-- =========================================================================
-- KASHMIR TOURISM APP - SEED DATA
-- =========================================================================

-- Clear existing data (in reverse FK dependency order)
DELETE FROM poi_ratings;
DELETE FROM wishlists;
DELETE FROM pois;
DELETE FROM poi_categories;
DELETE FROM destinations;
DELETE FROM user_profiles;
DELETE FROM users;
-- Note: We don't delete from auth.users as it's managed by Supabase Auth

-- =========================================================================
-- DESTINATIONS
-- =========================================================================
INSERT INTO destinations (id, name, slug, area, center, center_lat, center_lng, metadata, created_at, updated_at) VALUES
-- Srinagar
(
    '6d04f442-3f07-4f72-90aa-bb75a7bbd167',
    'Srinagar',
    'srinagar',
    ST_GeomFromText('POLYGON((74.7 34.0, 74.9 34.0, 74.9 34.2, 74.7 34.2, 74.7 34.0))', 4326),
    ST_GeomFromText('POINT(74.7973 34.0837)', 4326),
    34.0837,
    74.7973,
    '{"description": "The summer capital of Jammu and Kashmir, known for its beautiful Dal Lake, Mughal gardens, and houseboats.", "best_time_to_visit": "April to October", "elevation": "1585m"}',
    '2025-09-14T00:00:00Z'::timestamptz,
    '2025-09-14T00:00:00Z'::timestamptz
),
-- Gulmarg
(
    gen_random_uuid(),
    'Gulmarg',
    'gulmarg',
    ST_GeomFromText('POLYGON((74.3 34.0, 74.5 34.0, 74.5 34.1, 74.3 34.1, 74.3 34.0))', 4326),
    ST_GeomFromText('POINT(74.3803 34.0489)', 4326),
    34.0489,
    74.3803,
    '{"description": "Famous ski destination and meadow of flowers, home to one of the highest cable cars in the world.", "best_time_to_visit": "December to March (skiing), May to September (summer)", "elevation": "2730m"}',
    '2025-09-14T00:00:00Z'::timestamptz,
    '2025-09-14T00:00:00Z'::timestamptz
),
-- Pahalgam
(
    gen_random_uuid(),
    'Pahalgam',
    'pahalgam',
    ST_GeomFromText('POLYGON((75.1 33.9, 75.3 33.9, 75.3 34.1, 75.1 34.1, 75.1 33.9))', 4326),
    ST_GeomFromText('POINT(75.1928 34.0151)', 4326),
    34.0151,
    75.1928,
    '{"description": "Picturesque hill station known as the Valley of Shepherds, famous for its scenic beauty and trekking routes.", "best_time_to_visit": "April to October", "elevation": "2130m"}',
    '2025-09-14T00:00:00Z'::timestamptz,
    '2025-09-14T00:00:00Z'::timestamptz
),
-- Sonmarg
(
    gen_random_uuid(),
    'Sonmarg',
    'sonmarg',
    ST_GeomFromText('POLYGON((75.2 34.2, 75.4 34.2, 75.4 34.4, 75.2 34.4, 75.2 34.2))', 4326),
    ST_GeomFromText('POINT(75.2986 34.2917)', 4326),
    34.2917,
    75.2986,
    '{"description": "Meadow of Gold, a beautiful valley known for its snow-capped mountains and pristine landscapes.", "best_time_to_visit": "May to September", "elevation": "2800m"}',
    '2025-09-14T00:00:00Z'::timestamptz,
    '2025-09-14T00:00:00Z'::timestamptz
);

-- =========================================================================
-- SEED DATA - NO USER CREATION
-- =========================================================================
-- Note: We avoid creating users due to trigger complications.
-- POIs will have created_by set to NULL for seed data.

-- =========================================================================
-- POI CATEGORIES
-- =========================================================================
INSERT INTO poi_categories (id, name, icon, color, description, created_at) VALUES
(gen_random_uuid(), 'Lakes & Water Bodies', 'lake', '#4A90E2', 'Beautiful lakes, rivers, and water bodies', '2025-09-14T00:00:00Z'::timestamptz),
(gen_random_uuid(), 'Gardens & Parks', 'garden', '#7ED321', 'Mughal gardens, parks, and green spaces', '2025-09-14T00:00:00Z'::timestamptz),
(gen_random_uuid(), 'Religious Sites', 'temple', '#F5A623', 'Temples, mosques, and spiritual places', '2025-09-14T00:00:00Z'::timestamptz),
(gen_random_uuid(), 'Adventure Sports', 'mountain', '#D0021B', 'Skiing, trekking, and adventure activities', '2025-09-14T00:00:00Z'::timestamptz),
(gen_random_uuid(), 'Shopping & Markets', 'shopping', '#9013FE', 'Local markets, handicrafts, and shopping areas', '2025-09-14T00:00:00Z'::timestamptz),
(gen_random_uuid(), 'Viewpoints', 'camera', '#4A4A4A', 'Scenic viewpoints and photo spots', '2025-09-14T00:00:00Z'::timestamptz),
(gen_random_uuid(), 'Transportation', 'car', '#BD10E0', 'Cable cars, transport hubs, and connectivity', '2025-09-14T00:00:00Z'::timestamptz);-- =========================================================================
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
  (poi_data.address)::jsonb,
  (poi_data.contact_info)::jsonb,
  (poi_data.opening_hours)::jsonb,
  (poi_data.images)::jsonb,
  (poi_data.features)::jsonb,
  true,
  poi_data.min_zoom,
  poi_data.max_zoom,
  poi_data.priority,
  0.0,
  0,
  NULL,
  '2025-09-14T00:00:00Z'::timestamptz,
  '2025-09-14T00:00:00Z'::timestamptz
FROM destination_refs d
CROSS JOIN category_refs c
CROSS JOIN (
  VALUES 
    -- Srinagar POIs
    ('Srinagar', 'Lakes & Water Bodies', 'Dal Lake', 
     'The jewel of Srinagar, famous for its houseboats, shikaras, and floating gardens. A must-visit for every tourist.', 
     34.0889, 74.8083, 1585, 
     '{"area": "Dal Lake Area", "city": "Srinagar", "state": "Jammu and Kashmir"}'::jsonb, 
     '{"phone": "+91-194-250-1234", "email": "info@dallake.com"}'::jsonb, 
     '{"monday": "6:00 AM - 8:00 PM", "tuesday": "6:00 AM - 8:00 PM", "wednesday": "6:00 AM - 8:00 PM", "thursday": "6:00 AM - 8:00 PM", "friday": "6:00 AM - 8:00 PM", "saturday": "6:00 AM - 8:00 PM", "sunday": "6:00 AM - 8:00 PM"}'::jsonb, 
     '["https://example.com/dal-lake-1.jpg", "https://example.com/dal-lake-2.jpg"]'::jsonb, 
     '["houseboats", "shikara_rides", "floating_gardens", "sunset_views", "photography"]'::jsonb, 
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

