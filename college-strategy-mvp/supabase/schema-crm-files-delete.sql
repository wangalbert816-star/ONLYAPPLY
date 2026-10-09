-- Allow counselors to delete shared case files and students to delete their own uploads.
-- Run after schema-crm.sql (and schema-crm-files-storage.sql for bucket deletes).

drop policy if exists case_files_delete on public.case_files;
create policy case_files_delete on public.case_files
  for delete
  using (public.crm_can_delete_case_file(id));
