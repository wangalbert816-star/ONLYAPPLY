-- Alumni / past-cycle student report reviews (questionnaire → report → structured feedback)

create table if not exists public.alumni_report_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.saved_applications (id) on delete set null,
  report_id uuid references public.saved_reports (id) on delete set null,
  intake_term text,
  locale text not null default 'zh' check (locale in ('zh', 'en')),
  report_snapshot jsonb not null default '{}'::jsonb,
  form_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved')),
  rubric_version text not null default '1.0',
  rubric_scores jsonb not null default '{}'::jsonb,
  school_reviews jsonb not null default '[]'::jsonb,
  profile_dimension_reviews jsonb not null default '[]'::jsonb,
  final_approved_recommendation jsonb not null default '{}'::jsonb,
  overall_notes text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alumni_report_reviews_user_idx
  on public.alumni_report_reviews (user_id, updated_at desc);

create index if not exists alumni_report_reviews_report_idx
  on public.alumni_report_reviews (report_id);

-- One review row per user + report (NULL report_id rows are not deduped by this index).
create unique index if not exists alumni_report_reviews_user_report_uidx
  on public.alumni_report_reviews (user_id, report_id);

alter table public.alumni_report_reviews enable row level security;

create policy "alumni_reviews_select_own"
  on public.alumni_report_reviews for select
  using (auth.uid() = user_id);

create policy "alumni_reviews_insert_own"
  on public.alumni_report_reviews for insert
  with check (auth.uid() = user_id);

create policy "alumni_reviews_update_own"
  on public.alumni_report_reviews for update
  using (auth.uid() = user_id);
