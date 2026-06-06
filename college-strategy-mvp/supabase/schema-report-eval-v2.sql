-- Report eval v2: structured counselor reviews + versioning
-- Run in Supabase SQL Editor after schema-report-eval.sql

alter table public.report_eval_runs
  add column if not exists rubric_version text not null default '1.0';

alter table public.report_eval_runs
  add column if not exists report_template_version text not null default '1.0';

create table if not exists public.report_eval_reviews (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.report_eval_runs (id) on delete cascade,
  case_id uuid not null references public.report_eval_cases (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved')),
  rubric_version text not null default '1.0',
  rubric_scores jsonb not null default '{}'::jsonb,
  school_reviews jsonb not null default '[]'::jsonb,
  profile_dimension_reviews jsonb not null default '[]'::jsonb,
  final_approved_recommendation jsonb not null default '{}'::jsonb,
  overall_notes text,
  reviewed_by text,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, case_id)
);

create index if not exists report_eval_reviews_run_idx
  on public.report_eval_reviews (run_id);

create index if not exists report_eval_reviews_case_idx
  on public.report_eval_reviews (case_id, updated_at desc);

create index if not exists report_eval_reviews_status_idx
  on public.report_eval_reviews (status, updated_at desc);

alter table public.report_eval_reviews enable row level security;
