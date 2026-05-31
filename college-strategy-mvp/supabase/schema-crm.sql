-- CRM: signed-service engagements (run after schema.sql)
-- Local try: run in Supabase SQL Editor, create counselor user (Email+Password), then run schema-crm-seed.example.sql

create table if not exists public.counselors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  title text not null,
  bio text,
  email text,
  calendly_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.engagements (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  student_email text not null default '',
  student_name text,
  application_id uuid not null references public.saved_applications (id) on delete cascade,
  application_title text not null default 'My application',
  counselor_id uuid not null references public.counselors (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  phase text not null default 'planning' check (phase in ('onboarding', 'planning', 'essays', 'applications', 'done')),
  plan_label text,
  needs_follow_up boolean not null default false,
  internal_notes text not null default '',
  next_meeting_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, application_id)
);

create table if not exists public.case_messages (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  author_role text not null check (author_role in ('student', 'counselor', 'system', 'admin')),
  author_label text not null,
  body text not null,
  channel text not null default 'direct' check (channel in ('direct', 'group')),
  pinned boolean not null default false,
  read_by_student boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.case_tasks (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  title text not null,
  description text,
  due_at date,
  status text not null default 'open' check (status in ('open', 'done')),
  link_type text not null default 'none' check (link_type in ('profile', 'activities', 'essay', 'report', 'none')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  name text not null,
  doc_type text not null default 'general',
  status text not null default 'needed' check (status in ('needed', 'draft', 'submitted', 'done')),
  due_at date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.case_files (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  name text not null,
  category text not null default 'general',
  note text,
  storage_path text,
  uploaded_by_role text check (uploaded_by_role in ('student', 'counselor')),
  content_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

create index if not exists engagements_counselor_idx on public.engagements (counselor_id, updated_at desc);
create index if not exists engagements_student_idx on public.engagements (student_user_id, updated_at desc);
create index if not exists case_messages_engagement_idx on public.case_messages (engagement_id, created_at desc);
create index if not exists case_tasks_engagement_idx on public.case_tasks (engagement_id, status, due_at);
create index if not exists case_documents_engagement_idx on public.case_documents (engagement_id, due_at);
create index if not exists case_files_engagement_idx on public.case_files (engagement_id, uploaded_at desc);

alter table public.counselors enable row level security;
alter table public.engagements enable row level security;
alter table public.case_messages enable row level security;
alter table public.case_tasks enable row level security;
alter table public.case_documents enable row level security;
alter table public.case_files enable row level security;

create or replace function public.crm_my_counselor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.counselors where user_id = auth.uid() and active = true limit 1;
$$;

create or replace function public.crm_can_access_engagement(p_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.engagements e
    where e.id = p_engagement_id
      and (
        e.student_user_id = auth.uid()
        or e.counselor_id = public.crm_my_counselor_id()
      )
  );
$$;

-- counselors: own profile + students see assigned counselor row
drop policy if exists counselors_select on public.counselors;
create policy counselors_select on public.counselors for select using (
  user_id = auth.uid()
  or id in (
    select counselor_id from public.engagements where student_user_id = auth.uid()
  )
);

drop policy if exists counselors_update_own on public.counselors;
create policy counselors_update_own on public.counselors for update using (user_id = auth.uid());

-- engagements
drop policy if exists engagements_select on public.engagements;
create policy engagements_select on public.engagements for select using (
  student_user_id = auth.uid() or counselor_id = public.crm_my_counselor_id()
);

drop policy if exists engagements_insert_student on public.engagements;
create policy engagements_insert_student on public.engagements for insert with check (
  student_user_id = auth.uid()
  and exists (
    select 1 from public.saved_applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
);

drop policy if exists engagements_update on public.engagements;
create policy engagements_update on public.engagements for update using (
  student_user_id = auth.uid() or counselor_id = public.crm_my_counselor_id()
);

-- case_messages
drop policy if exists case_messages_select on public.case_messages;
create policy case_messages_select on public.case_messages for select using (
  public.crm_can_access_engagement(engagement_id)
);

drop policy if exists case_messages_insert on public.case_messages;
create policy case_messages_insert on public.case_messages for insert with check (
  public.crm_can_access_engagement(engagement_id)
);

drop policy if exists case_messages_update on public.case_messages;
create policy case_messages_update on public.case_messages for update using (
  public.crm_can_access_engagement(engagement_id)
);

-- case_tasks
drop policy if exists case_tasks_select on public.case_tasks;
create policy case_tasks_select on public.case_tasks for select using (
  public.crm_can_access_engagement(engagement_id)
);

drop policy if exists case_tasks_insert on public.case_tasks;
create policy case_tasks_insert on public.case_tasks for insert with check (
  public.crm_can_access_engagement(engagement_id)
);

drop policy if exists case_tasks_update on public.case_tasks;
create policy case_tasks_update on public.case_tasks for update using (
  public.crm_can_access_engagement(engagement_id)
);

-- case_documents
drop policy if exists case_documents_select on public.case_documents;
create policy case_documents_select on public.case_documents for select using (
  public.crm_can_access_engagement(engagement_id)
);

drop policy if exists case_documents_insert on public.case_documents;
create policy case_documents_insert on public.case_documents for insert with check (
  public.crm_can_access_engagement(engagement_id)
);

drop policy if exists case_documents_update on public.case_documents;
create policy case_documents_update on public.case_documents for update using (
  public.crm_can_access_engagement(engagement_id)
);

-- case_files
drop policy if exists case_files_select on public.case_files;
create policy case_files_select on public.case_files for select using (
  public.crm_can_access_engagement(engagement_id)
);

drop policy if exists case_files_insert on public.case_files;
create policy case_files_insert on public.case_files for insert with check (
  public.crm_can_access_engagement(engagement_id)
);
