-- Add video support documentation to destinations
-- Videos are stored in Supabase Storage (destination-videos bucket) and URLs are stored in metadata->'videos' array
-- Video format: MP4 (H.264), recommended: 1080p max, 30-60 seconds, <10MB
-- Videos structure in metadata: {"videos": [{"url": "...", "thumbnail": "...", "duration": 45, "format": "mp4", "title": "..."}]}
-- Note: Videos are already accessible via metadata->'videos' since vw_destinations_public view exposes the full metadata column

BEGIN;

-- =========================================================================
-- COMMENTS: Document videos structure in metadata
-- =========================================================================
COMMENT ON COLUMN destinations.metadata IS 
  'Extended metadata including images array, videos array, elevation, description, and best_time_to_visit. Videos structure: {"videos": [{"url": "...", "thumbnail": "...", "duration": 45, "format": "mp4", "title": "..."}]}. Videos should be stored in Supabase Storage (destination-videos bucket) and URLs stored here.';

COMMIT;