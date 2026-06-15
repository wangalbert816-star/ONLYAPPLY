-- Fix alumni_report_reviews upsert: replace partial unique index with full unique index.
-- Safe to run if the table already exists from an earlier migration.

drop index if exists public.alumni_report_reviews_user_report_uidx;

create unique index if not exists alumni_report_reviews_user_report_uidx
  on public.alumni_report_reviews (user_id, report_id);
