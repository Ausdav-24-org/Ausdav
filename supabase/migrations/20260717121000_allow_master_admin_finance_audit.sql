-- Allow master admins to use the Finance Audit Log page as a privileged admin.

create or replace function private.is_super_admin_or_master_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.app_config c
    where c.id = 1
      and c.super_admin_id = auth.uid()
  )
  or exists (
    select 1
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.is_master_admin = true
  );
$$;

grant select, insert, update, delete on public.audit_actions to authenticated;

alter table public.audit_actions enable row level security;

drop policy if exists "audit_actions_master_admin_insert" on public.audit_actions;
create policy "audit_actions_master_admin_insert"
  on public.audit_actions
  for insert
  to authenticated
  with check (private.is_super_admin_or_master_admin());

drop policy if exists "audit_actions_master_admin_update" on public.audit_actions;
create policy "audit_actions_master_admin_update"
  on public.audit_actions
  for update
  to authenticated
  using (private.is_super_admin_or_master_admin())
  with check (private.is_super_admin_or_master_admin());

drop policy if exists "audit_actions_master_admin_delete" on public.audit_actions;
create policy "audit_actions_master_admin_delete"
  on public.audit_actions
  for delete
  to authenticated
  using (private.is_super_admin_or_master_admin());

drop policy if exists "audit_reports_master_admin_read" on storage.objects;
create policy "audit_reports_master_admin_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'audit-reports'
    and private.is_super_admin_or_master_admin()
  );

drop policy if exists "audit_reports_master_admin_insert" on storage.objects;
create policy "audit_reports_master_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'audit-reports'
    and private.is_super_admin_or_master_admin()
  );

drop policy if exists "audit_reports_master_admin_update" on storage.objects;
create policy "audit_reports_master_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'audit-reports'
    and private.is_super_admin_or_master_admin()
  )
  with check (
    bucket_id = 'audit-reports'
    and private.is_super_admin_or_master_admin()
  );

drop policy if exists "audit_reports_master_admin_delete" on storage.objects;
create policy "audit_reports_master_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'audit-reports'
    and private.is_super_admin_or_master_admin()
  );
