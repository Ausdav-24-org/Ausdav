begin;

create extension if not exists "pgcrypto";

create table if not exists public.facebook_media_imports (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('facebook_post', 'facebook_album')),
  facebook_object_id text not null,
  source_url text not null,
  title text null,
  description text null,
  caption text null,
  image_url_original text not null,
  image_path_local text not null,
  sort_order integer not null default 0,
  imported_at timestamptz not null default now(),
  created_by_admin_id uuid null references auth.users(id) on delete set null,
  event_id integer null references public.events(id) on delete set null,
  gallery_id uuid null references public.galleries(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb
);

create unique index if not exists facebook_media_imports_unique_source_image
  on public.facebook_media_imports(source_type, facebook_object_id, image_url_original);

create index if not exists facebook_media_imports_event_id_idx
  on public.facebook_media_imports(event_id);

create index if not exists facebook_media_imports_gallery_id_idx
  on public.facebook_media_imports(gallery_id);

create index if not exists facebook_media_imports_imported_at_idx
  on public.facebook_media_imports(imported_at desc);

alter table public.facebook_media_imports enable row level security;

drop policy if exists facebook_media_imports_read_admin on public.facebook_media_imports;
create policy facebook_media_imports_read_admin
on public.facebook_media_imports
for select
to authenticated
using (
  private.is_super_admin() or private.has_permission('events')
);

drop policy if exists facebook_media_imports_manage_admin on public.facebook_media_imports;
create policy facebook_media_imports_manage_admin
on public.facebook_media_imports
for all
to authenticated
using (
  private.is_super_admin() or private.has_permission('events')
)
with check (
  private.is_super_admin() or private.has_permission('events')
);

commit;
