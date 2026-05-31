-- Real file uploads for CRM Files tab (run after schema-crm.sql)
-- Creates private bucket + extends case_files with storage metadata.

alter table public.case_files
  add column if not exists storage_path text,
  add column if not exists uploaded_by_role text check (uploaded_by_role in ('student', 'counselor')),
  add column if not exists content_type text,
  add column if not exists size_bytes bigint;

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-case-files', 'crm-case-files', false, 20971520)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists crm_case_files_storage_select on storage.objects;
create policy crm_case_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'crm-case-files'
    and public.crm_can_access_engagement((storage.foldername(name))[1]::uuid)
  );

drop policy if exists crm_case_files_storage_insert on storage.objects;
create policy crm_case_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'crm-case-files'
    and public.crm_can_access_engagement((storage.foldername(name))[1]::uuid)
  );

drop policy if exists crm_case_files_storage_delete on storage.objects;
create policy crm_case_files_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'crm-case-files'
    and public.crm_can_access_engagement((storage.foldername(name))[1]::uuid)
  );
