-- Run once in Supabase → SQL Editor (after schema-crm.sql).
-- Creates / confirms counselor login: weiyiwang603@gmail.com / password set in Auth (123456 if you used Add user or signUp).

create extension if not exists pgcrypto;

do $$
declare
  uid uuid;
begin
  select id into uid
  from auth.users
  where lower(email) = lower('weiyiwang603@gmail.com')
  order by created_at desc
  limit 1;

  if uid is null then
    raise exception 'No Auth user for weiyiwang603@gmail.com. In Dashboard: Authentication → Users → Add user (email + password 123456), then re-run this script.';
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt('123456', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = uid;

  insert into public.counselors (user_id, name, title, email, active)
  values (uid, '王老师', '首席留学顾问', 'weiyiwang603@gmail.com', true)
  on conflict (user_id) do update
  set
    name = excluded.name,
    title = excluded.title,
    email = excluded.email,
    active = true;

  raise notice 'Counselor ready. user_id=%', uid;
end $$;

-- Optional: dev RPC so the app can self-link after login (run once)
create or replace function public.crm_bootstrap_dev_counselor()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uemail text;
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into uemail from auth.users where id = auth.uid();
  if lower(uemail) not in ('weiyiwang603@gmail.com') then
    raise exception 'not allowlisted';
  end if;

  insert into public.counselors (user_id, name, title, email, active)
  values (auth.uid(), '王老师', '首席留学顾问', uemail, true)
  on conflict (user_id) do update
  set name = excluded.name, title = excluded.title, email = excluded.email, active = true
  returning id into cid;

  return cid;
end;
$$;

grant execute on function public.crm_bootstrap_dev_counselor() to authenticated;
