-- Essay analysis：文书深度分析独立权益（第一版支持 per_session，预留 subscription）
-- 在 Supabase SQL Editor 中执行；可重复运行。

create table if not exists public.essay_analysis_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.saved_applications (id) on delete cascade,
  report_id uuid references public.saved_reports (id) on delete cascade,
  entitlement_kind text not null default 'per_session'
    check (entitlement_kind in ('per_session', 'subscription')),
  stripe_checkout_session_id text,
  invite_code_id uuid references public.invite_codes (id) on delete set null,
  source text not null default 'stripe'
    check (source in ('stripe', 'invite', 'manual')),
  created_at timestamptz not null default now(),
  check (
    (entitlement_kind = 'per_session' and report_id is not null)
    or entitlement_kind = 'subscription'
  )
);

alter table public.essay_analysis_entitlements
  add column if not exists report_id uuid references public.saved_reports (id) on delete cascade;

alter table public.essay_analysis_entitlements
  add column if not exists entitlement_kind text;

update public.essay_analysis_entitlements
set entitlement_kind = 'per_session'
where entitlement_kind is null;

alter table public.essay_analysis_entitlements
  alter column entitlement_kind set default 'per_session';

alter table public.essay_analysis_entitlements
  alter column entitlement_kind set not null;

alter table public.essay_analysis_entitlements
  add column if not exists stripe_checkout_session_id text;

alter table public.essay_analysis_entitlements
  add column if not exists invite_code_id uuid;

alter table public.essay_analysis_entitlements
  drop constraint if exists essay_analysis_entitlements_invite_code_id_fkey;

alter table public.essay_analysis_entitlements
  add constraint essay_analysis_entitlements_invite_code_id_fkey
  foreign key (invite_code_id)
  references public.invite_codes (id)
  on delete set null;

alter table public.essay_analysis_entitlements
  add column if not exists source text;

update public.essay_analysis_entitlements
set source = 'stripe'
where source is null;

alter table public.essay_analysis_entitlements
  alter column source set default 'stripe';

alter table public.essay_analysis_entitlements
  alter column source set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'essay_analysis_entitlements_kind_check'
  ) then
    alter table public.essay_analysis_entitlements
      add constraint essay_analysis_entitlements_kind_check
      check (entitlement_kind in ('per_session', 'subscription'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'essay_analysis_entitlements_source_check'
  ) then
    alter table public.essay_analysis_entitlements
      add constraint essay_analysis_entitlements_source_check
      check (source in ('stripe', 'invite', 'manual'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'essay_analysis_entitlements_report_required_check'
  ) then
    alter table public.essay_analysis_entitlements
      add constraint essay_analysis_entitlements_report_required_check
      check (
        (entitlement_kind = 'per_session' and report_id is not null)
        or entitlement_kind = 'subscription'
      );
  end if;
end $$;

-- 若旧版本约束只允许 stripe/manual，重建为包含 invite。
alter table public.essay_analysis_entitlements
  drop constraint if exists essay_analysis_entitlements_source_check;

alter table public.essay_analysis_entitlements
  add constraint essay_analysis_entitlements_source_check
  check (source in ('stripe', 'invite', 'manual'));

create unique index if not exists essay_analysis_entitlements_session_idx
  on public.essay_analysis_entitlements (user_id, application_id, report_id)
  where entitlement_kind = 'per_session';

create unique index if not exists essay_analysis_entitlements_subscription_idx
  on public.essay_analysis_entitlements (user_id, application_id)
  where entitlement_kind = 'subscription';

create index if not exists essay_analysis_entitlements_user_idx
  on public.essay_analysis_entitlements (user_id);

create index if not exists essay_analysis_entitlements_report_idx
  on public.essay_analysis_entitlements (report_id);

alter table public.essay_analysis_entitlements enable row level security;

drop policy if exists "essay_analysis_entitlements_select_own"
  on public.essay_analysis_entitlements;

create policy "essay_analysis_entitlements_select_own"
  on public.essay_analysis_entitlements for select
  using (auth.uid() = user_id);

-- 写入仅允许 service_role（Stripe Webhook / 后台手动授权）；客户端 anon/authenticated 无 insert/update。

-- ── 文书草稿与分析历史 ───────────────────────────────────────────────
create table if not exists public.essay_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.saved_applications (id) on delete cascade,
  report_id uuid not null references public.saved_reports (id) on delete cascade,
  draft_text text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, report_id)
);

create table if not exists public.essay_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.saved_applications (id) on delete cascade,
  report_id uuid not null references public.saved_reports (id) on delete cascade,
  draft_text text not null,
  analysis_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists essay_drafts_user_idx
  on public.essay_drafts (user_id, updated_at desc);

create index if not exists essay_drafts_report_idx
  on public.essay_drafts (report_id);

create index if not exists essay_analyses_user_idx
  on public.essay_analyses (user_id, created_at desc);

create index if not exists essay_analyses_report_idx
  on public.essay_analyses (report_id, created_at desc);

alter table public.essay_drafts enable row level security;
alter table public.essay_analyses enable row level security;

drop policy if exists "essay_drafts_select_own" on public.essay_drafts;
drop policy if exists "essay_drafts_insert_own" on public.essay_drafts;
drop policy if exists "essay_drafts_update_own" on public.essay_drafts;
drop policy if exists "essay_drafts_delete_own" on public.essay_drafts;

create policy "essay_drafts_select_own"
  on public.essay_drafts for select
  using (auth.uid() = user_id);

create policy "essay_drafts_insert_own"
  on public.essay_drafts for insert
  with check (auth.uid() = user_id);

create policy "essay_drafts_update_own"
  on public.essay_drafts for update
  using (auth.uid() = user_id);

create policy "essay_drafts_delete_own"
  on public.essay_drafts for delete
  using (auth.uid() = user_id);

drop policy if exists "essay_analyses_select_own" on public.essay_analyses;
drop policy if exists "essay_analyses_insert_own" on public.essay_analyses;
drop policy if exists "essay_analyses_delete_own" on public.essay_analyses;

create policy "essay_analyses_select_own"
  on public.essay_analyses for select
  using (auth.uid() = user_id);

create policy "essay_analyses_insert_own"
  on public.essay_analyses for insert
  with check (auth.uid() = user_id);

create policy "essay_analyses_delete_own"
  on public.essay_analyses for delete
  using (auth.uid() = user_id);

-- ── 文书分析邀请码核销 ───────────────────────────────────────────────
create table if not exists public.essay_analysis_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.saved_applications (id) on delete cascade,
  report_id uuid not null references public.saved_reports (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists essay_analysis_invite_redemptions_code_idx
  on public.essay_analysis_invite_redemptions (invite_code_id);

create index if not exists essay_analysis_invite_redemptions_user_idx
  on public.essay_analysis_invite_redemptions (user_id);

create unique index if not exists essay_analysis_invite_redemptions_code_user_report_idx
  on public.essay_analysis_invite_redemptions (invite_code_id, user_id, report_id);

alter table public.essay_analysis_invite_redemptions enable row level security;

drop policy if exists "essay_analysis_invite_redemptions_select_own"
  on public.essay_analysis_invite_redemptions;

create policy "essay_analysis_invite_redemptions_select_own"
  on public.essay_analysis_invite_redemptions for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.redeem_essay_analysis_invite_code(
  p_code text,
  p_application_id uuid,
  p_report_id uuid
)
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

  if p_report_id is null then
    return jsonb_build_object('ok', false, 'error', 'report_missing');
  end if;

  v_norm := upper(trim(coalesce(p_code, '')));
  if v_norm = '' then
    return jsonb_build_object('ok', false, 'error', 'empty_code');
  end if;

  if not exists (
    select 1
    from public.saved_reports sr
    join public.saved_applications sa on sa.id = sr.application_id
    where sr.id = p_report_id
      and sr.application_id = p_application_id
      and sr.user_id = v_uid
      and sa.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'report_not_found');
  end if;

  if exists (
    select 1 from public.essay_analysis_entitlements e
    where e.user_id = v_uid
      and e.application_id = p_application_id
      and e.report_id = p_report_id
      and e.entitlement_kind = 'per_session'
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

  select count(*) into v_user_uses
  from public.essay_analysis_invite_redemptions
  where invite_code_id = ic.id and user_id = v_uid;

  if ic.max_uses_per_user is not null and v_user_uses >= ic.max_uses_per_user then
    return jsonb_build_object('ok', false, 'error', 'user_limit');
  end if;

  select count(*) into v_here
  from public.essay_analysis_invite_redemptions
  where invite_code_id = ic.id and user_id = v_uid and report_id = p_report_id;

  if v_here > 0 then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed_here');
  end if;

  insert into public.essay_analysis_invite_redemptions (
    invite_code_id,
    user_id,
    application_id,
    report_id
  )
  values (ic.id, v_uid, p_application_id, p_report_id);

  update public.invite_codes
  set used_count = used_count + 1
  where id = ic.id;

  insert into public.essay_analysis_entitlements (
    user_id,
    application_id,
    report_id,
    entitlement_kind,
    stripe_checkout_session_id,
    invite_code_id,
    source
  )
  values (v_uid, p_application_id, p_report_id, 'per_session', null, ic.id, 'invite')
  on conflict (user_id, application_id, report_id)
  where entitlement_kind = 'per_session'
  do update set
    source = excluded.source,
    invite_code_id = excluded.invite_code_id,
    stripe_checkout_session_id = coalesce(essay_analysis_entitlements.stripe_checkout_session_id, excluded.stripe_checkout_session_id);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.redeem_essay_analysis_invite_code(text, uuid, uuid)
  to authenticated;
