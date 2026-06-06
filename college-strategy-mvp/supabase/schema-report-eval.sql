-- Report quality eval cases (admin-only via service_role API)
-- Run in Supabase SQL Editor after schema.sql

create table if not exists public.report_eval_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  title text not null,
  tags text[] not null default '{}',
  locale text not null default 'zh' check (locale in ('zh', 'en')),
  report_body jsonb not null,
  expected_reach jsonb not null default '[]'::jsonb,
  expected_match jsonb not null default '[]'::jsonb,
  expected_safety jsonb not null default '[]'::jsonb,
  forbidden_schools text[] not null default '{}',
  notes text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_eval_cases_active_idx
  on public.report_eval_cases (active, updated_at desc);

create table if not exists public.report_eval_runs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  prompt_version text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  case_count int not null default 0,
  ok_count int not null default 0,
  error_count int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_eval_runs_created_idx
  on public.report_eval_runs (created_at desc);

create table if not exists public.report_eval_run_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.report_eval_runs (id) on delete cascade,
  case_id uuid not null references public.report_eval_cases (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'ok', 'error')),
  report_payload jsonb,
  error text,
  llm_ms int,
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, case_id)
);

create index if not exists report_eval_run_results_run_idx
  on public.report_eval_run_results (run_id, created_at asc);

create table if not exists public.report_eval_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.report_eval_runs (id) on delete cascade,
  case_id uuid not null references public.report_eval_cases (id) on delete cascade,
  score_tier int check (score_tier between 1 and 5),
  score_personalization int check (score_personalization between 1 and 5),
  score_facts int check (score_facts between 1 and 5),
  score_consistency int check (score_consistency between 1 and 5),
  score_actionable int check (score_actionable between 1 and 5),
  notes text,
  error_tags text[] not null default '{}',
  scored_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, case_id)
);

create index if not exists report_eval_scores_run_idx
  on public.report_eval_scores (run_id);

alter table public.report_eval_cases enable row level security;
alter table public.report_eval_runs enable row level security;
alter table public.report_eval_run_results enable row level security;
alter table public.report_eval_scores enable row level security;

-- No public policies: admin API uses service_role only.
