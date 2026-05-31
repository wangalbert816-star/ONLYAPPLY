-- Link-type library items (Google Sheets) + external URLs on case files.
-- Run after schema-crm-document-library.sql and schema-crm-files-storage.sql.

alter table public.crm_library_items
  add column if not exists item_kind text not null default 'file' check (item_kind in ('file', 'link')),
  add column if not exists external_url text;

alter table public.crm_library_items
  alter column file_name drop not null,
  alter column storage_path drop not null;

alter table public.case_files
  add column if not exists external_url text;

alter table public.crm_library_items
  drop constraint if exists crm_library_items_kind_payload_check;

alter table public.crm_library_items
  add constraint crm_library_items_kind_payload_check check (
    (
      item_kind = 'file'
      and storage_path is not null
      and file_name is not null
      and external_url is null
    )
    or (
      item_kind = 'link'
      and external_url is not null
      and storage_path is null
    )
  );
