-- Allow master admins to edit Organisation Contact & Finance settings.

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

alter table public.org_contact_settings enable row level security;

drop policy if exists org_contact_update on public.org_contact_settings;
create policy org_contact_update
on public.org_contact_settings
for all
to authenticated
using (private.is_super_admin_or_master_admin())
with check (private.is_super_admin_or_master_admin());
