-- English display fields for admin eval cases (run once in Supabase SQL Editor)

alter table public.report_eval_cases
  add column if not exists title_en text,
  add column if not exists notes_en text,
  add column if not exists report_body_en jsonb;
