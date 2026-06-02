-- Student resume draft shared with assigned counselors (run in Supabase SQL Editor).

alter table public.engagements
  add column if not exists resume_draft jsonb;

comment on column public.engagements.resume_draft is
  'Resume builder JSON draft; readable/editable by student and assigned counselors.';
