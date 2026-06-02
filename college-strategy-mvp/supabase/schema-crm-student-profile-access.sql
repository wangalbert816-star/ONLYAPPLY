-- Let counselors read student questionnaire data linked to their engagements.
-- Prerequisite: schema.sql + schema-crm.sql (crm_my_counselor_id).

drop policy if exists applications_select_engaged_counselor on public.saved_applications;
create policy applications_select_engaged_counselor on public.saved_applications
  for select to authenticated
  using (
    exists (
      select 1
      from public.engagements e
      where e.application_id = saved_applications.id
        and public.crm_counselor_can_access_engagement(public.crm_my_counselor_id(), e.id)
    )
  );

drop policy if exists reports_select_engaged_counselor on public.saved_reports;
create policy reports_select_engaged_counselor on public.saved_reports
  for select to authenticated
  using (
    exists (
      select 1
      from public.engagements e
      where e.application_id = saved_reports.application_id
        and public.crm_counselor_can_access_engagement(public.crm_my_counselor_id(), e.id)
    )
  );
