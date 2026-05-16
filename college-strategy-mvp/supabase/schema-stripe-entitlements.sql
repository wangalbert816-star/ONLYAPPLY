-- Stripe：按「已保存的申请 application」一次性解锁完整报告（适用于该记录下所有报告版本）
-- 在 Dashboard → SQL 中与本项目原有 schema.sql 一并执行／迁移。

create table if not exists public.application_unlock_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.saved_applications (id) on delete cascade,
  stripe_checkout_session_id text,
  source text not null default 'stripe' check (source in ('stripe', 'invite', 'manual')),
  created_at timestamptz not null default now(),
  unique (user_id, application_id)
);

alter table public.application_unlock_entitlements
  add column if not exists source text;

update public.application_unlock_entitlements
set source = 'stripe'
where source is null;

alter table public.application_unlock_entitlements
  alter column source set default 'stripe';

alter table public.application_unlock_entitlements
  alter column source set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'application_unlock_entitlements_source_check'
  ) then
    alter table public.application_unlock_entitlements
      add constraint application_unlock_entitlements_source_check
      check (source in ('stripe', 'invite', 'manual'));
  end if;
end $$;

create index if not exists application_unlock_entitlements_user_idx
  on public.application_unlock_entitlements (user_id);

alter table public.application_unlock_entitlements enable row level security;

drop policy if exists "unlock_entitlements_select_own"
  on public.application_unlock_entitlements;

create policy "unlock_entitlements_select_own"
  on public.application_unlock_entitlements for select
  using (auth.uid() = user_id);

-- 写入仅允许 service_role（Node Webhook）；客户端 anon/authenticated 无 insert/update

-- 从历史 report_unlocked 回填权益（可选）
insert into public.application_unlock_entitlements (user_id, application_id)
select distinct sr.user_id, sr.application_id
from public.saved_reports sr
where sr.report_unlocked is true
on conflict (user_id, application_id) do nothing;

-- 禁止客户端在 saved_reports 上自行写 report_unlocked = true（仅保留旧行仍为 true 时的其它字段更新）
create or replace function public.saved_reports_reject_client_unlock_flag()
returns trigger
language plpgsql
as $$
begin
  if new.report_unlocked is not true then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'report_unlocked must not be set on insert';
  end if;
  -- UPDATE：仅允许在行已经是解锁态时继续保持 true（迁移/历史数据），禁止 false → true
  if old.report_unlocked is distinct from true then
    raise exception 'report_unlocked cannot be flipped to true from the client';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_saved_reports_reject_client_unlock on public.saved_reports;

create trigger tr_saved_reports_reject_client_unlock
  before insert or update on public.saved_reports
  for each row
  execute procedure public.saved_reports_reject_client_unlock_flag();
