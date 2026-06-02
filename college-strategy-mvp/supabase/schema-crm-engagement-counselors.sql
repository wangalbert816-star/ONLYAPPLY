-- CRM: allow multiple counselors per engagement (collaboration)
-- Run after schema-crm.sql

create table if not exists public.engagement_counselors (
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  counselor_id uuid not null references public.counselors (id) on delete restrict,
  role text not null default 'collaborator' check (role in ('primary', 'collaborator')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (engagement_id, counselor_id)
);

create index if not exists engagement_counselors_counselor_idx
  on public.engagement_counselors (counselor_id, active, engagement_id);

create index if not exists engagement_counselors_engagement_idx
  on public.engagement_counselors (engagement_id, active, counselor_id);

alter table public.engagement_counselors enable row level security;

-- Helper: can this counselor access engagement?
create or replace function public.crm_counselor_can_access_engagement(
  p_counselor_id uuid,
  p_engagement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_counselor_id is not null
    and (
      exists (
        select 1
        from public.engagement_counselors ec
        where ec.engagement_id = p_engagement_id
          and ec.counselor_id = p_counselor_id
          and ec.active = true
      )
      or exists (
        select 1
        from public.engagements e
        where e.id = p_engagement_id
          and e.counselor_id = p_counselor_id
      )
    );
$$;

-- Update crm_can_access_engagement to use join table for counselors.
create or replace function public.crm_can_access_engagement(p_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.engagements e
    where e.id = p_engagement_id
      and (
        e.student_user_id = auth.uid()
        or public.crm_counselor_can_access_engagement(public.crm_my_counselor_id(), e.id)
      )
  );
$$;

-- engagement_counselors: students + any assigned counselor can read rows.
-- Counselors must read their own assignment rows to discover engagements (bootstrap).
drop policy if exists engagement_counselors_select on public.engagement_counselors;
create policy engagement_counselors_select on public.engagement_counselors
for select using (
  counselor_id = public.crm_my_counselor_id()
  or public.crm_can_access_engagement(engagement_id)
);

-- Admin (service role) manages join rows; counselors cannot modify assignment.
drop policy if exists engagement_counselors_insert on public.engagement_counselors;
drop policy if exists engagement_counselors_update on public.engagement_counselors;
drop policy if exists engagement_counselors_delete on public.engagement_counselors;

-- Backfill: ensure every engagement's current counselor is in join table.
insert into public.engagement_counselors (engagement_id, counselor_id, role, active)
select e.id, e.counselor_id, 'primary', true
from public.engagements e
where e.counselor_id is not null
on conflict (engagement_id, counselor_id) do update
set role = excluded.role,
    active = true;

