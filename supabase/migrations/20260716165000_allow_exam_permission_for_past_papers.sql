begin;

-- The admin UI grants/checks the Past Paper page with permission_key = 'exam',
-- while older RLS policies still require 'paper_seminar'. Accept both keys so
-- admins who were granted Past Paper/Exam access can create and manage records.

drop policy if exists past_papers_write on public.past_papers;
create policy past_papers_write
on public.past_papers
for all
to authenticated
using (
  private.is_super_admin()
  or private.has_permission('paper_seminar')
  or private.has_permission('exam')
)
with check (
  private.is_super_admin()
  or private.has_permission('paper_seminar')
  or private.has_permission('exam')
);

drop policy if exists exam_papers_assets_insert on storage.objects;
create policy exam_papers_assets_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exam-papers'
  and (
    private.is_super_admin()
    or private.has_permission('paper_seminar')
    or private.has_permission('exam')
  )
);

drop policy if exists exam_papers_assets_update on storage.objects;
create policy exam_papers_assets_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'exam-papers'
  and (
    private.is_super_admin()
    or private.has_permission('paper_seminar')
    or private.has_permission('exam')
  )
)
with check (
  bucket_id = 'exam-papers'
  and (
    private.is_super_admin()
    or private.has_permission('paper_seminar')
    or private.has_permission('exam')
  )
);

drop policy if exists exam_papers_assets_delete on storage.objects;
create policy exam_papers_assets_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'exam-papers'
  and (
    private.is_super_admin()
    or private.has_permission('paper_seminar')
    or private.has_permission('exam')
  )
);

drop policy if exists schemes_assets_insert on storage.objects;
create policy schemes_assets_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'schemes'
  and (
    private.is_super_admin()
    or private.has_permission('paper_seminar')
    or private.has_permission('exam')
  )
);

drop policy if exists schemes_assets_update on storage.objects;
create policy schemes_assets_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'schemes'
  and (
    private.is_super_admin()
    or private.has_permission('paper_seminar')
    or private.has_permission('exam')
  )
)
with check (
  bucket_id = 'schemes'
  and (
    private.is_super_admin()
    or private.has_permission('paper_seminar')
    or private.has_permission('exam')
  )
);

drop policy if exists schemes_assets_delete on storage.objects;
create policy schemes_assets_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'schemes'
  and (
    private.is_super_admin()
    or private.has_permission('paper_seminar')
    or private.has_permission('exam')
  )
);

commit;
