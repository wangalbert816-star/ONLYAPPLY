-- Allow admin role in case_messages (admin posts in group chat via Admin API).
-- Prerequisite: schema-crm.sql

alter table public.case_messages drop constraint if exists case_messages_author_role_check;
alter table public.case_messages add constraint case_messages_author_role_check
  check (author_role in ('student', 'counselor', 'system', 'admin'));
