-- Allow master admins to use the Permission Management page.

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

grant select, update on public.permission_requests to authenticated;
grant select, insert, update, delete on public.admin_granted_permissions to authenticated;
grant insert on public.admin_notifications to authenticated;
grant select, update on public.admin_permissions to authenticated;

drop policy if exists "Admins can view own permission requests" on public.permission_requests;
create policy "Admins can view own permission requests"
on public.permission_requests
for select
to authenticated
using (
  auth.uid() = admin_id
  or private.is_super_admin_or_master_admin()
);

drop policy if exists "Super admins can update permission requests" on public.permission_requests;
create policy "Super admins can update permission requests"
on public.permission_requests
for update
to authenticated
using (private.is_super_admin_or_master_admin())
with check (private.is_super_admin_or_master_admin());

drop policy if exists "Super admins can manage granted permissions" on public.admin_granted_permissions;
create policy "Super admins can manage granted permissions"
on public.admin_granted_permissions
for all
to authenticated
using (private.is_super_admin_or_master_admin())
with check (private.is_super_admin_or_master_admin());

drop policy if exists "Super admins can create notifications" on public.admin_notifications;
create policy "Super admins can create notifications"
on public.admin_notifications
for insert
to authenticated
with check (private.is_super_admin_or_master_admin());

alter table public.admin_permissions enable row level security;

drop policy if exists "Authenticated users can view admin permissions" on public.admin_permissions;
create policy "Authenticated users can view admin permissions"
on public.admin_permissions
for select
to authenticated
using (true);

drop policy if exists "Super admins can update admin permissions" on public.admin_permissions;
create policy "Super admins can update admin permissions"
on public.admin_permissions
for update
to authenticated
using (private.is_super_admin_or_master_admin())
with check (private.is_super_admin_or_master_admin());
