-- Run in Supabase SQL Editor to persist advisor-support lead submissions.

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

create index if not exists expert_consult_leads_created_at_idx
  on public.expert_consult_leads (created_at desc);

create index if not exists expert_consult_leads_user_id_idx
  on public.expert_consult_leads (user_id, created_at desc);

alter table public.expert_consult_leads enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expert_consult_leads'
      and policyname = 'expert_consult_leads_insert_own_or_anonymous'
  ) then
    create policy "expert_consult_leads_insert_own_or_anonymous"
      on public.expert_consult_leads for insert
      with check (user_id is null or auth.uid() = user_id);
  end if;
end $$;
