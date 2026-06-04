-- If you already ran schema-application-roadmap-posts.sql with href NOT NULL, run this once:
alter table public.application_roadmap_posts
  alter column href drop not null;
