-- Fix: collaborators added in Admin could not see students in Counselor Console.
-- Run in Supabase SQL Editor if multi-counselor was enabled before this policy fix.

-- Ensure access helper uses the join table (safe to re-run).
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

-- Counselor Auth links must be created by admin provisioning or the admin-only linkAuth action.
-- Do not backfill user_id by email here: an unbound counselor row could otherwise be claimed
-- by any Auth account that controls the same email address.

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

drop policy if exists engagement_counselors_select on public.engagement_counselors;
create policy engagement_counselors_select on public.engagement_counselors
for select using (
  counselor_id = public.crm_my_counselor_id()
  or public.crm_can_access_engagement(engagement_id)
);
