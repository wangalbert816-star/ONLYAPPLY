-- Meeting recaps for post-meeting review (counselor writes, student reads).
-- Run after schema-crm.sql.

create table if not exists public.case_meeting_recaps (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  title text not null,
  held_at date,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_meeting_recaps_engagement_idx
  on public.case_meeting_recaps (engagement_id, held_at desc nulls last, created_at desc);

alter table public.case_meeting_recaps enable row level security;

drop policy if exists case_meeting_recaps_select on public.case_meeting_recaps;
create policy case_meeting_recaps_select on public.case_meeting_recaps
  for select
  using (public.crm_can_access_engagement(engagement_id));

drop policy if exists case_meeting_recaps_insert on public.case_meeting_recaps;
create policy case_meeting_recaps_insert on public.case_meeting_recaps
  for insert
  with check (
    exists (
      select 1
      from public.engagements e
      where e.id = engagement_id
        and public.crm_counselor_can_access_engagement(public.crm_my_counselor_id(), e.id)
    )
  );

drop policy if exists case_meeting_recaps_update on public.case_meeting_recaps;
create policy case_meeting_recaps_update on public.case_meeting_recaps
  for update
  using (
    exists (
      select 1
      from public.engagements e
      where e.id = engagement_id
        and public.crm_counselor_can_access_engagement(public.crm_my_counselor_id(), e.id)
    )
  );

drop policy if exists case_meeting_recaps_delete on public.case_meeting_recaps;
create policy case_meeting_recaps_delete on public.case_meeting_recaps
  for delete
  using (
    exists (
      select 1
      from public.engagements e
      where e.id = engagement_id
        and public.crm_counselor_can_access_engagement(public.crm_my_counselor_id(), e.id)
    )
  );
