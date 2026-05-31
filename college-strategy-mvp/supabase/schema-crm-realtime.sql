-- Push new CRM chat messages to connected clients (student + counselor).
-- Prerequisite: schema-crm.sql

do $$
begin
  alter publication supabase_realtime add table public.case_messages;
exception
  when duplicate_object then null;
end $$;
