-- Ensure clients can only attach saved_reports to their own saved_applications.
-- Run after supabase/schema.sql.

drop policy if exists "reports_insert_own" on public.saved_reports;
create policy "reports_insert_own"
  on public.saved_reports for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.saved_applications a
      where a.id = application_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "reports_update_own" on public.saved_reports;
create policy "reports_update_own"
  on public.saved_reports for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.saved_applications a
      where a.id = application_id
        and a.user_id = auth.uid()
    )
  );
