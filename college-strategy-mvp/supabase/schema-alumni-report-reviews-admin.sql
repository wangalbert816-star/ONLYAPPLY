-- Add admin approval metadata to alumni report reviews (run if table already exists).

alter table public.alumni_report_reviews
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text;
