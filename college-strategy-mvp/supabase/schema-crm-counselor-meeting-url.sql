-- Counselor booking links: Google Meet / Zoom / Calendly (run in Supabase SQL Editor).

alter table public.counselors
  add column if not exists meeting_url text;

comment on column public.counselors.meeting_url is
  'Persistent meeting link (e.g. Google Meet room). Calendly remains in calendly_url.';
