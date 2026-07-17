-- Allow master admins to access the Important Details page data and files.
-- The frontend "Super Admin View" is a UI mode, but RLS must still allow the
-- underlying master-admin account to read/write these records.

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

alter table public.admin_documents enable row level security;
alter table public.admin_contacts enable row level security;

drop policy if exists "Allow super_admin to view and manage admin documents" on public.admin_documents;
create policy "Allow super_admin_or_master_admin to manage admin documents"
  on public.admin_documents
  for all
  to authenticated
  using (private.is_super_admin_or_master_admin())
  with check (private.is_super_admin_or_master_admin());

drop policy if exists "Allow super_admin to view and manage admin contacts" on public.admin_contacts;
create policy "Allow super_admin_or_master_admin to manage admin contacts"
  on public.admin_contacts
  for all
  to authenticated
  using (private.is_super_admin_or_master_admin())
  with check (private.is_super_admin_or_master_admin());

-- Older installs created admin_documents with only pdf/word/excel allowed.
alter table public.admin_documents
  drop constraint if exists admin_documents_document_type_check;

alter table public.admin_documents
  add constraint admin_documents_document_type_check
  check (document_type in ('pdf', 'word', 'excel', 'image'));

drop policy if exists "Allow super_admin to read admin-documents" on storage.objects;
create policy "Allow super_admin_or_master_admin to read admin-documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'admin-documents'
    and private.is_super_admin_or_master_admin()
  );

drop policy if exists "Allow super_admin to upload to admin-documents" on storage.objects;
create policy "Allow super_admin_or_master_admin to upload to admin-documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'admin-documents'
    and private.is_super_admin_or_master_admin()
  );

drop policy if exists "Allow super_admin to delete from admin-documents" on storage.objects;
create policy "Allow super_admin_or_master_admin to delete from admin-documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'admin-documents'
    and private.is_super_admin_or_master_admin()
  );

drop policy if exists "Allow super_admin to update admin-documents" on storage.objects;
create policy "Allow super_admin_or_master_admin to update admin-documents"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'admin-documents'
    and private.is_super_admin_or_master_admin()
  )
  with check (
    bucket_id = 'admin-documents'
    and private.is_super_admin_or_master_admin()
  );
