-- Seed images for Restaurants using placehold.co
-- Adds 3 images per restaurant: 1 portrait (600x800) and 2 landscape (800x600)

BEGIN;

-- =========================================================================
-- UPDATE RESTAURANTS: Add images array (1 portrait + 2 landscape)
-- =========================================================================
UPDATE restaurants
SET images = jsonb_build_array(
    'https://placehold.co/600x800/FF6B35/FFFFFF?text=' || REPLACE(name, ' ', '+'),
    'https://placehold.co/800x600/FFA500/FFFFFF?text=' || REPLACE(name, ' ', '+'),
    'https://placehold.co/800x600/FFD700/FFFFFF?text=' || REPLACE(name, ' ', '+')
)
WHERE images IS NULL 
   OR jsonb_array_length(COALESCE(images, '[]'::jsonb)) = 0;

COMMIT;

