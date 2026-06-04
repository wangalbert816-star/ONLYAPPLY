-- Application Roadmap — admin-published resources (run in Supabase SQL Editor)
-- Public users see rows where published = true; writes go through Admin API (service_role).

create table if not exists public.application_roadmap_posts (
  id uuid primary key default gen_random_uuid(),
  category_id text not null check (
    category_id in (
      'submission',
      'testing',
      'essays',
      'financial',
      'majors',
      'research',
      'summer',
      'scholarships',
      'researchPrograms',
      'official'
    )
  ),
  href text,
  cover_image_url text,
  title_zh text not null,
  title_en text not null,
  description_zh text not null default '',
  description_en text not null default '',
  badge text check (badge is null or badge in ('first', 'recommended')),
  published boolean not null default true,
  sort_order int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_roadmap_posts_published_idx
  on public.application_roadmap_posts (published, category_id, sort_order desc, created_at desc);

alter table public.application_roadmap_posts enable row level security;

drop policy if exists application_roadmap_posts_select_public on public.application_roadmap_posts;
create policy application_roadmap_posts_select_public on public.application_roadmap_posts
  for select
  using (published = true);
