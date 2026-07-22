-- Fix permission grants for super admins stored in the members table.

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
      and (
        m.role = 'super_admin'
        or m.is_master_admin = true
      )
  )
  or (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'is_super_admin' = 'true'
    or ((auth.jwt() ->> 'user_metadata')::jsonb -> 'roles')::text like '%super_admin%'
  );
$$;

grant execute on function private.is_super_admin_or_master_admin() to authenticated;

drop policy if exists "Super admins can manage granted permissions" on public.admin_granted_permissions;
create policy "Super admins can manage granted permissions"
on public.admin_granted_permissions
for all
to authenticated
using (private.is_super_admin_or_master_admin())
with check (private.is_super_admin_or_master_admin());
