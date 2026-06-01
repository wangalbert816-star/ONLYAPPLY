-- Counselor can return a student's task submission; student sees return_note until resubmit.
-- Run after schema-crm-task-submissions.sql.

alter table public.case_tasks
  add column if not exists returned_at timestamptz,
  add column if not exists return_note text;
