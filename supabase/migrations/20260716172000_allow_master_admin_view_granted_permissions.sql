begin;

-- Master admins can open the Master Admin dashboard, but the original
-- admin_granted_permissions SELECT policy only exposed all permission grants
-- to users whose public role is super_admin. Allow master admins to read the
-- same rows so the Access Permissions tab reflects distributed permissions.

drop policy if exists "Admins can view own granted permissions" on public.admin_granted_permissions;
create policy "Admins can view own granted permissions"
on public.admin_granted_permissions
for select
to authenticated
using (
  auth.uid() = admin_id
  or private.is_super_admin_or_master_admin()
);

commit;
