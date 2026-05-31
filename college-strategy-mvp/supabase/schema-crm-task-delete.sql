-- Allow counselors to delete tasks on their engagements (run after schema-crm.sql).

drop policy if exists case_tasks_delete_counselor on public.case_tasks;
create policy case_tasks_delete_counselor on public.case_tasks
  for delete to authenticated
  using (
    exists (
      select 1
      from public.engagements e
      where e.id = engagement_id
        and e.counselor_id = public.crm_my_counselor_id()
    )
  );
