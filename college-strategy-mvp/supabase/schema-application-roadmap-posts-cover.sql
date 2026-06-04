-- Optional cover image URL for Resources cards (run after schema-application-roadmap-posts.sql)
-- Also run schema-application-roadmap-covers-storage.sql for the upload bucket.
alter table public.application_roadmap_posts
  add column if not exists cover_image_url text;
