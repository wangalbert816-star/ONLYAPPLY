-- Allow counselors and students to delete case files they can access.
-- Run after schema-crm.sql (and schema-crm-files-storage.sql for bucket deletes).

drop policy if exists case_files_delete on public.case_files;
create policy case_files_delete on public.case_files
  for delete
  using (public.crm_can_access_engagement(engagement_id));
