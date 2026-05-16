-- 邀请码解锁（第一版）：表 + RPC
-- 在 Supabase → SQL Editor 执行（建议在 schema.sql 与 schema-stripe-entitlements.sql 之后）
--
-- 运营插入示例码（建议在 SQL 中使用大写、无空格；用户输入由 RPC 规范化）：
--   insert into public.invite_codes (code, label, max_uses, max_uses_per_user, active)
--   values ('BETA2026', '内测', null, 1, true);
--
-- 前端：VITE_ENABLE_STRIPE_CHECKOUT=true 或 VITE_ENABLE_INVITE_CODES=true 时显示兑换区

-- ── 权益表扩展 ───────────────────────────────────────────────────────
alter table public.application_unlock_entitlements
  add column if not exists source text;

update public.application_unlock_entitlements set source = 'stripe' where source is null;

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

alter table public.application_unlock_entitlements
  add column if not exists invite_code_id uuid;

-- ── invite_codes ─────────────────────────────────────────────────────
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text,
  max_uses int,
  used_count int not null default 0,
  max_uses_per_user int not null default 1,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.invite_codes
  add column if not exists used_count int not null default 0;

-- 唯一：规范化后相同视为同一码（upper + trim）
create unique index if not exists invite_codes_code_normalized_idx
  on public.invite_codes ((upper(trim(code))));

-- FK：权益表 → 邀请码
alter table public.application_unlock_entitlements
  drop constraint if exists application_unlock_entitlements_invite_code_id_fkey;

alter table public.application_unlock_entitlements
  add constraint application_unlock_entitlements_invite_code_id_fkey
  foreign key (invite_code_id)
  references public.invite_codes (id)
  on delete set null;

-- ── invite_redemptions ───────────────────────────────────────────────
create table if not exists public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.saved_applications (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists invite_redemptions_code_idx on public.invite_redemptions (invite_code_id);
create index if not exists invite_redemptions_user_idx on public.invite_redemptions (user_id);
create unique index if not exists invite_redemptions_code_user_application_idx
  on public.invite_redemptions (invite_code_id, user_id, application_id);

update public.invite_codes c
set used_count = coalesce(r.count, 0)
from (
  select invite_code_id, count(*)::int
  from public.invite_redemptions
  group by invite_code_id
) r
where c.id = r.invite_code_id;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.invite_codes enable row level security;

alter table public.invite_redemptions enable row level security;

drop policy if exists "invite_redemptions_select_own" on public.invite_redemptions;

create policy "invite_redemptions_select_own"
  on public.invite_redemptions for select
  to authenticated
  using (auth.uid() = user_id);

-- invite_codes：不开放给匿名/Authenticated 直连读写（仅用 Dashboard / service_role）

-- ── RPC：登录用户核销 → 写入权益 ───────────────────────────────────────
create or replace function public.redeem_invite_code(p_code text, p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_norm text;
  ic record;
  v_total int;
  v_user_uses int;
  v_here int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_application_id is null then
    return jsonb_build_object('ok', false, 'error', 'application_missing');
  end if;

  v_norm := upper(trim(coalesce(p_code, '')));
  if v_norm = '' then
    return jsonb_build_object('ok', false, 'error', 'empty_code');
  end if;

  if not exists (
    select 1 from public.saved_applications sa
    where sa.id = p_application_id and sa.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'application_not_found');
  end if;

  if exists (
    select 1 from public.application_unlock_entitlements e
    where e.user_id = v_uid and e.application_id = p_application_id
  ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  select * into ic
  from public.invite_codes c
  where upper(trim(c.code)) = v_norm
  limit 1
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if not ic.active then
    return jsonb_build_object('ok', false, 'error', 'inactive_code');
  end if;

  if ic.valid_from is not null and ic.valid_from > now() then
    return jsonb_build_object('ok', false, 'error', 'not_started');
  end if;

  if ic.valid_until is not null and ic.valid_until < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  v_total := coalesce(ic.used_count, 0);
  if ic.max_uses is not null and v_total >= ic.max_uses then
    return jsonb_build_object('ok', false, 'error', 'code_exhausted');
  end if;

  select count(*) into v_user_uses from public.invite_redemptions
  where invite_code_id = ic.id and user_id = v_uid;

  if ic.max_uses_per_user is not null and v_user_uses >= ic.max_uses_per_user then
    return jsonb_build_object('ok', false, 'error', 'user_limit');
  end if;

  select count(*) into v_here from public.invite_redemptions
  where invite_code_id = ic.id and user_id = v_uid and application_id = p_application_id;

  if v_here > 0 then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed_here');
  end if;

  insert into public.invite_redemptions (invite_code_id, user_id, application_id)
  values (ic.id, v_uid, p_application_id);

  update public.invite_codes
  set used_count = used_count + 1
  where id = ic.id;

  insert into public.application_unlock_entitlements (
    user_id,
    application_id,
    stripe_checkout_session_id,
    source,
    invite_code_id
  )
  values (v_uid, p_application_id, null, 'invite', ic.id)
  on conflict (user_id, application_id)
  do update set
    source = excluded.source,
    invite_code_id = excluded.invite_code_id,
    stripe_checkout_session_id = coalesce(application_unlock_entitlements.stripe_checkout_session_id, excluded.stripe_checkout_session_id);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.redeem_invite_code(text, uuid) to authenticated;
