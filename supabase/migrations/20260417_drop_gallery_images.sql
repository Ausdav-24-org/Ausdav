-- Drop gallery_images table and related indexes/triggers
-- This table is no longer needed as we now store only Facebook post URLs
-- and fetch images on-demand without storing files locally

-- Drop triggers first
DROP TRIGGER IF EXISTS gallery_images_set_created_by ON public.gallery_images;
DROP TRIGGER IF EXISTS enforce_gallery_image_limit ON public.gallery_images;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_gallery_images_gallery_id;
DROP INDEX IF EXISTS public.gallery_images_sort_idx;
DROP INDEX IF EXISTS public.gallery_images_gallery_idx;
DROP INDEX IF EXISTS public.gallery_images_gallery_id_file_path_uniq;

-- Drop the table
DROP TABLE IF EXISTS public.gallery_images;
