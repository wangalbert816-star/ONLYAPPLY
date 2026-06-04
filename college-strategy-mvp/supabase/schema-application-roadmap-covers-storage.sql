-- Public cover images for Resources posts (run after schema-application-roadmap-posts.sql)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-roadmap-covers',
  'application-roadmap-covers',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
