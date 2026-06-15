-- Add counselor review feedback to existing engine_benchmarks table.
alter table public.engine_benchmarks
  add column if not exists review_feedback jsonb;
