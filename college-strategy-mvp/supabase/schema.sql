-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
-- Enables saved applications + report history per user.

create table if not exists public.saved_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'My application',
  form_state jsonb not null,
  locale text not null default 'zh' check (locale in ('zh', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.saved_applications (id) on delete cascade,
  report_payload jsonb not null,
  supplementary_notes jsonb,
  report_unlocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.expert_consult_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  application_id uuid references public.saved_applications (id) on delete set null,
  report_id uuid references public.saved_reports (id) on delete set null,
  email text not null,
  wechat text,
  locale text not null default 'zh' check (locale in ('zh', 'en')),
  source text not null default 'report_advisor_support',
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists saved_applications_user_id_idx on public.saved_applications (user_id, updated_at desc);
create index if not exists saved_reports_application_id_idx on public.saved_reports (application_id, created_at desc);
create index if not exists saved_reports_user_id_idx on public.saved_reports (user_id, created_at desc);
create index if not exists expert_consult_leads_created_at_idx on public.expert_consult_leads (created_at desc);
create index if not exists expert_consult_leads_user_id_idx on public.expert_consult_leads (user_id, created_at desc);

alter table public.saved_applications enable row level security;
alter table public.saved_reports enable row level security;
alter table public.expert_consult_leads enable row level security;

create policy "applications_select_own"
  on public.saved_applications for select
  using (auth.uid() = user_id);

create policy "applications_insert_own"
  on public.saved_applications for insert
  with check (auth.uid() = user_id);

create policy "applications_update_own"
  on public.saved_applications for update
  using (auth.uid() = user_id);

create policy "applications_delete_own"
  on public.saved_applications for delete
  using (auth.uid() = user_id);

create policy "reports_select_own"
  on public.saved_reports for select
  using (auth.uid() = user_id);

create policy "reports_insert_own"
  on public.saved_reports for insert
  with check (auth.uid() = user_id);

create policy "reports_update_own"
  on public.saved_reports for update
  using (auth.uid() = user_id);

create policy "reports_delete_own"
  on public.saved_reports for delete
  using (auth.uid() = user_id);

create policy "expert_consult_leads_insert_own_or_anonymous"
  on public.expert_consult_leads for insert
  with check (user_id is null or auth.uid() = user_id);
