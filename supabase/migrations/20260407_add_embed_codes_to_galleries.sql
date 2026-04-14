begin;

--------------------------------------------------------------------------------
-- Add embed_codes column to galleries table for storing Facebook embed codes
--------------------------------------------------------------------------------

-- Add JSONB column to store embed codes
-- Format: {"1": "<embed code>", "2": "<embed code>"} or empty {}
alter table public.galleries
  add column if not exists embed_codes jsonb not null default '{}';

-- Create index for faster queries
create index if not exists galleries_embed_codes_idx on public.galleries using gin(embed_codes);

-- Add a check constraint to ensure it's a valid JSON object
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'galleries_embed_codes_json_check') then
    alter table public.galleries
      add constraint galleries_embed_codes_json_check
      check (embed_codes IS NULL OR jsonb_typeof(embed_codes) = 'object');
  end if;
end;
$$;

--------------------------------------------------------------------------------
-- Commentary
--------------------------------------------------------------------------------
-- Embed codes are now stored as JSONB in this format:
-- {
--   "1": "<div id=\"fb-root\"></div><script>...</script>",
--   "2": "<iframe src=\"https://www.facebook.com/plugins/post.php?...\"></iframe>"
-- }
--
-- Query examples:
-- SELECT embed_codes FROM galleries WHERE id = '...';
-- SELECT jsonb_object_keys(embed_codes) FROM galleries WHERE embed_codes != '{}';
-- SELECT embed_codes->'1' FROM galleries WHERE embed_codes ? '1';
-- UPDATE galleries SET embed_codes = embed_codes || jsonb_build_object('3', '<new_code>');
-- UPDATE galleries SET embed_codes = embed_codes - '1' WHERE id = '...';

commit;
