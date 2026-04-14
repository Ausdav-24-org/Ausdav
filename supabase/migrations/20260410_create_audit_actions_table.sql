-- Create audit_actions table for tracking file operations
create table if not exists public.audit_actions (
  id bigserial not null,
  year integer not null,
  event text not null,
  bucket_id text not null,
  object_path text not null,
  file_name text null,
  file_size bigint null,
  uploaded_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint audit_actions_pkey primary key (id)
) TABLESPACE pg_default;

-- Create index on year column for faster queries
create index if not exists audit_actions_year_idx on public.audit_actions using btree (year) TABLESPACE pg_default;

-- Create index on bucket_id for filtering by bucket
create index if not exists audit_actions_bucket_idx on public.audit_actions using btree (bucket_id) TABLESPACE pg_default;

-- Create index on event for filtering by event type
create index if not exists audit_actions_event_idx on public.audit_actions using btree (event) TABLESPACE pg_default;

-- Create index on created_at for chronological queries
create index if not exists audit_actions_created_at_idx on public.audit_actions using btree (created_at) TABLESPACE pg_default;

-- Create composite index on year and event for common queries
create index if not exists audit_actions_year_event_idx on public.audit_actions using btree (year, event) TABLESPACE pg_default;

-- Enable RLS on audit_actions table
alter table public.audit_actions enable row level security;

-- Policy 1: Allow all authenticated users to SELECT/READ audit logs
create policy "audit_actions_read_all" on public.audit_actions
  for select
  using (auth.role() = 'authenticated');

-- Policy 2: Allow INSERT only for Super Admin or Admin with audit permission
create policy "audit_actions_insert_admin" on public.audit_actions
  for insert
  with check (
    auth.role() = 'authenticated' and
    exists (
      select 1 from public.members
      where auth_user_id = auth.uid() 
        and role = 'super_admin'
    )
    or
    exists (
      select 1 from public.members m
      left join public.admin_granted_permissions agp 
        on m.auth_user_id = agp.admin_id
      where m.auth_user_id = auth.uid() 
        and m.role = 'admin'
        and agp.permission_key = 'audit'
        and agp.is_active = true
    )
  );

-- Policy 3: Allow DELETE only for Super Admin
create policy "audit_actions_delete_super_admin" on public.audit_actions
  for delete
  using (
    auth.role() = 'authenticated' and
    exists (
      select 1 from public.members
      where auth_user_id = auth.uid() 
        and role = 'super_admin'
    )
  );

-- Policy 4: Prevent UPDATE on audit logs (audit trail should be immutable)
create policy "audit_actions_no_update" on public.audit_actions
  for update
  using (false);
