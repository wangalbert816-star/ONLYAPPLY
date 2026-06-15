-- Decision Engine benchmarks (draft + live tiers). Service role only via API.

create table if not exists public.engine_benchmarks (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('draft', 'live')),
  source_case_key text not null,
  title text not null default '',
  profile jsonb not null default '{}'::jsonb,
  approved_schools jsonb not null default '{}'::jsonb,
  review_feedback jsonb,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (tier, source_case_key)
);

create index if not exists engine_benchmarks_tier_key_idx
  on public.engine_benchmarks (tier, source_case_key);

create index if not exists engine_benchmarks_tier_updated_idx
  on public.engine_benchmarks (tier, updated_at desc);

create table if not exists public.engine_benchmark_publish_log (
  id uuid primary key default gen_random_uuid(),
  published_at timestamptz not null default now(),
  published_by text,
  entry_count int not null default 0
);

create index if not exists engine_benchmark_publish_log_at_idx
  on public.engine_benchmark_publish_log (published_at desc);

alter table public.engine_benchmarks enable row level security;
alter table public.engine_benchmark_publish_log enable row level security;
