-- Org-wide document library for admin templates/materials (run after schema-crm.sql)
-- Counselors can browse active items and attach them to case Files.

create table if not exists public.crm_library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'general',
  locale text not null default 'all' check (locale in ('zh', 'en', 'all')),
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_library_items_active_sort_idx
  on public.crm_library_items (active, sort_order desc, created_at desc);

alter table public.crm_library_items enable row level security;

drop policy if exists crm_library_items_select_counselor on public.crm_library_items;
create policy crm_library_items_select_counselor on public.crm_library_items
  for select to authenticated
  using (active = true and public.crm_my_counselor_id() is not null);

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-library-files', 'crm-library-files', false, 20971520)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists crm_library_files_storage_select on storage.objects;
create policy crm_library_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'crm-library-files'
    and public.crm_my_counselor_id() is not null
  );
