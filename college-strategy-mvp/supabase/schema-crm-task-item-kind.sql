-- Distinguish completable action items from shared resources (no check-off).
-- Run after schema-crm.sql.

alter table public.case_tasks
  add column if not exists item_kind text not null default 'action'
  check (item_kind in ('action', 'resource'));
