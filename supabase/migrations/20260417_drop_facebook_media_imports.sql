-- Drop facebook_media_imports table and related indexes
-- This table is no longer needed as we now store only Facebook post URLs
-- and fetch images on-demand from Facebook CDN

-- Drop indexes first
DROP INDEX IF EXISTS public.facebook_media_imports_unique_source_image;
DROP INDEX IF EXISTS public.facebook_media_imports_event_id_idx;
DROP INDEX IF EXISTS public.facebook_media_imports_gallery_id_idx;
DROP INDEX IF EXISTS public.facebook_media_imports_imported_at_idx;
DROP INDEX IF EXISTS public.idx_facebook_imports_gallery_id;

-- Drop the table
DROP TABLE IF EXISTS public.facebook_media_imports;
