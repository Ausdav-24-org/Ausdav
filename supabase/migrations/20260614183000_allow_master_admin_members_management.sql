begin;

-- Helper: treat master admins as privileged for member-management policies.
create or replace function private.is_super_admin_or_master_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
  or exists (
    select 1
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.is_master_admin = true
  );
$$;

alter table if exists public.members enable row level security;

-- Replace existing broad member management policies to include master admins.
drop policy if exists members_manage_non_delete on public.members;
drop policy if exists members_manage_select on public.members;
drop policy if exists members_manage_insert on public.members;
drop policy if exists members_manage_update on public.members;

create policy members_manage_select
on public.members
for select
to authenticated
using ( private.is_super_admin_or_master_admin() or private.has_permission('member') );

create policy members_manage_insert
on public.members
for insert
to authenticated
with check ( private.is_super_admin_or_master_admin() or private.has_permission('member') );

create policy members_manage_update
on public.members
for update
to authenticated
using ( private.is_super_admin_or_master_admin() or private.has_permission('member') )
with check ( private.is_super_admin_or_master_admin() or private.has_permission('member') );

drop policy if exists members_delete_admin on public.members;
create policy members_delete_admin
on public.members
for delete
to authenticated
using (
  private.is_super_admin_or_master_admin()
  or (private.has_permission('member') and role = 'member')
);

-- Compatibility for older policy name used in earlier migrations.
drop policy if exists "Allow admins and superadmins to delete members" on public.members;
create policy "Allow admins and superadmins to delete members"
on public.members
for delete
to authenticated
using (
  private.is_super_admin_or_master_admin()
  or (
    exists (
      select 1 from public.members m
      where m.auth_user_id = auth.uid()
        and m.role = 'admin'
    )
    and role = 'member'
  )
);

commit;
