-- Minimal migration to create `public.permissions` table to unblock signup
-- Run this immediately if your DB is missing the table.

create table if not exists public.permissions (
  id integer primary key, -- intended to match members.mem_id
  announcement boolean not null default false,
  events boolean not null default false,
  finance boolean not null default false,
  member boolean not null default false,
  paper_seminar boolean not null default false,
  applicant boolean not null default false
);

-- Note: this is a minimal, non-destructive fix to stop errors.
-- Consider running the full migration file `20251220120000_rebuild_schema.sql`
-- later to add constraints, indexes, and RLS policies.
