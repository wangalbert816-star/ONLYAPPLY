-- Student turn-ins per task (counselor reads submitted_file_ids on case_tasks).
-- Run after schema-crm.sql, schema-crm-task-attachments.sql, schema-crm-files-storage.sql.

alter table public.case_tasks
  add column if not exists submitted_file_ids uuid[] not null default '{}';

alter table public.case_files
  add column if not exists task_id uuid references public.case_tasks (id) on delete set null;

create index if not exists case_files_task_idx on public.case_files (task_id)
  where task_id is not null;

-- Backfill: link existing case_files.task_id into case_tasks.submitted_file_ids
update public.case_tasks t
set submitted_file_ids = coalesce(
  (
    select array_agg(f.id order by f.uploaded_at)
    from public.case_files f
    where f.task_id = t.id
  ),
  '{}'::uuid[]
)
where exists (select 1 from public.case_files f where f.task_id = t.id);
