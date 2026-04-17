-- Rename embed_codes to post_urls in galleries table
ALTER TABLE public.galleries
RENAME COLUMN embed_codes TO post_urls;

-- Update the constraint name
ALTER TABLE public.galleries
DROP CONSTRAINT galleries_embed_codes_json_check;

ALTER TABLE public.galleries
ADD CONSTRAINT galleries_post_urls_json_check CHECK (
  (post_urls IS NULL OR jsonb_typeof(post_urls) = 'object'::text)
);

-- Update the index name
DROP INDEX IF EXISTS public.galleries_embed_codes_idx;
CREATE INDEX IF NOT EXISTS galleries_post_urls_idx ON public.galleries USING gin (post_urls) TABLESPACE pg_default;

-- Set default to empty JSON object for storing URLs
ALTER TABLE public.galleries
ALTER COLUMN post_urls SET DEFAULT '{}'::jsonb;
