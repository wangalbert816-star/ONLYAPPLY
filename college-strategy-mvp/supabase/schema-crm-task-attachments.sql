-- Task attachments: links case_tasks to copied case_files from the document library.
-- Run after schema-crm.sql and schema-crm-document-library.sql.

alter table public.case_tasks
  add column if not exists attached_file_ids uuid[] not null default '{}';
