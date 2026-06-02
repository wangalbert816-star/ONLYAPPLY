-- Link shared with a student for their current meeting (run in Supabase SQL Editor).

alter table public.engagements
  add column if not exists meeting_join_url text;

comment on column public.engagements.meeting_join_url is
  'Google Meet (or similar) link the counselor shared with this student; visible on student Premium Meetings.';
