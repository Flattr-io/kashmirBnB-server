-- Enhance restaurants data with:
-- 1. Images for special delicacies (3 images per delicacy)
-- 2. Opening hours for all days of the week
-- 3. Contact info (phone, email, website)
-- 4. Detailed addresses

BEGIN;

-- =========================================================================
-- UPDATE SPECIAL DELICACIES: Add images array to each delicacy
-- =========================================================================
UPDATE restaurants r
SET special_delicacies = (
    SELECT jsonb_agg(
        jsonb_build_object(
            'name', delicacy->>'name',
            'price', (delicacy->>'price')::numeric,
            'images', jsonb_build_array(
                'https://placehold.co/600x800/E8B4B8/FFFFFF?text=' || REPLACE(delicacy->>'name', ' ', '+'),
                'https://placehold.co/800x600/F4A460/FFFFFF?text=' || REPLACE(delicacy->>'name', ' ', '+'),
                'https://placehold.co/800x600/DEB887/FFFFFF?text=' || REPLACE(delicacy->>'name', ' ', '+')
            )
        )
    )
    FROM jsonb_array_elements(r.special_delicacies) AS delicacy
)
WHERE r.special_delicacies IS NOT NULL 
  AND jsonb_array_length(COALESCE(r.special_delicacies, '[]'::jsonb)) > 0
  AND NOT EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(r.special_delicacies) AS d 
    WHERE d ? 'images'
  );

-- =========================================================================
-- UPDATE OPENING HOURS: Add opening hours for all days of the week
-- =========================================================================
UPDATE restaurants
SET opening_hours = jsonb_build_object(
    'monday', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'tuesday', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'wednesday', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'thursday', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'friday', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'saturday', jsonb_build_object('open', '09:00', 'close', '23:00', 'closed', false),
    'sunday', jsonb_build_object('open', '10:00', 'close', '22:00', 'closed', false)
)
WHERE opening_hours IS NULL 
   OR opening_hours = '{}'::jsonb
   OR NOT (opening_hours ? 'monday');

-- =========================================================================
-- UPDATE CONTACT INFO: Add phone, email, and website
-- =========================================================================
UPDATE restaurants r
SET contact_info = jsonb_build_object(
    'phone', '+91-194-' || LPAD((ABS(HASHTEXT(r.id::text)) % 9000 + 1000)::text, 4, '0'),
    'email', LOWER(REPLACE(REPLACE(r.name, ' ', ''), '''', '')) || '@kashmirbnb.com',
    'website', 'https://www.' || LOWER(REPLACE(REPLACE(r.name, ' ', ''), '''', '')) || '.com'
)
WHERE contact_info IS NULL 
   OR contact_info = '{}'::jsonb
   OR NOT (contact_info ? 'phone');

-- =========================================================================
-- UPDATE ADDRESS: Add detailed addresses based on destination
-- =========================================================================
UPDATE restaurants r
SET address = (
    SELECT jsonb_build_object(
        'street', CASE 
            WHEN d.slug = 'srinagar' THEN 'Main Boulevard, Dal Lake Road'
            WHEN d.slug = 'gulmarg' THEN 'Gulmarg Gondola Road'
            WHEN d.slug = 'pahalgam' THEN 'Pahalgam Valley Road'
            WHEN d.slug = 'sonmarg' THEN 'Sonmarg Highway'
            ELSE 'Main Street'
        END,
        'area', CASE 
            WHEN d.slug = 'srinagar' THEN 'Dal Lake Area'
            WHEN d.slug = 'gulmarg' THEN 'Gulmarg Town'
            WHEN d.slug = 'pahalgam' THEN 'Pahalgam Valley'
            WHEN d.slug = 'sonmarg' THEN 'Sonmarg Town'
            ELSE 'City Center'
        END,
        'city', INITCAP(d.slug),
        'state', 'Jammu and Kashmir',
        'country', 'India',
        'pincode', CASE 
            WHEN d.slug = 'srinagar' THEN '190001'
            WHEN d.slug = 'gulmarg' THEN '193403'
            WHEN d.slug = 'pahalgam' THEN '192126'
            WHEN d.slug = 'sonmarg' THEN '191202'
            ELSE '190001'
        END,
        'landmark', CASE 
            WHEN r.name LIKE '%Local Bites%' THEN 'Near Local Market'
            WHEN r.name LIKE '%Valley Dine%' THEN 'Opposite Tourist Information Center'
            WHEN r.name LIKE '%Skyline Grill%' THEN 'Near Viewpoint'
            ELSE 'City Center'
        END
    )
    FROM destinations d
    WHERE d.id = r.destination_id
)
WHERE address IS NULL 
   OR address = '{}'::jsonb
   OR NOT (address ? 'street');

COMMIT;

