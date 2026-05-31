-- Link counselor weiyiwang603@gmail.com ↔ student michellezlou@gmail.com
-- Prerequisite: schema.sql + schema-crm.sql + bootstrap-counselor-weiyiwang.sql
-- Student must have signed in once. If no saved_applications yet, a placeholder row is created.

do $$
declare
  student_uid uuid;
  counselor_id uuid;
  counselor_name text;
  app_id uuid;
  app_title text;
  v_engagement_id uuid;
  now_ts timestamptz := now();
begin
  select id into student_uid
  from auth.users
  where lower(email) = lower('michellezlou@gmail.com')
  order by created_at desc
  limit 1;

  if student_uid is null then
    raise exception 'No Auth user for michellezlou@gmail.com. Student must sign in once (Google or email).';
  end if;

  select a.id, a.title into app_id, app_title
  from public.saved_applications a
  where a.user_id = student_uid
  order by a.updated_at desc
  limit 1;

  if app_id is null then
    insert into public.saved_applications (user_id, title, form_state, locale, updated_at)
    values (
      student_uid,
      'Premium 服务 · 我的申请',
      '{
        "intakeTerm": "",
        "intakeOtherDetail": "",
        "applicantIdentity": "",
        "citizenship": "",
        "residenceRegion": "",
        "budget": "",
        "testing": "",
        "satScore": "",
        "actScore": "",
        "highSchoolSystem": "",
        "currentHighSchool": "",
        "gpa": "",
        "gpaTrend": "",
        "languageScores": "",
        "academicSpecialFlags": [],
        "academicSpecialNotes": "",
        "majorPrimary": "",
        "majorSecondary": "",
        "schoolSize": "",
        "campusCulturePref": "",
        "geoPrefs": [],
        "activities": "",
        "structuredActivities": [],
        "riskStyle": "",
        "dealbreakers": ""
      }'::jsonb,
      'zh',
      now_ts
    )
    returning id, title into app_id, app_title;
    raise notice 'Created placeholder saved_application id=% (student had no reports yet).', app_id;
  end if;

  select c.id, c.name into counselor_id, counselor_name
  from public.counselors c
  where lower(c.email) = lower('weiyiwang603@gmail.com')
    and c.active = true
  limit 1;

  if counselor_id is null then
    raise exception 'Counselor weiyiwang603@gmail.com not found. Run bootstrap-counselor-weiyiwang.sql first.';
  end if;

  insert into public.engagements (
    student_user_id,
    student_email,
    student_name,
    application_id,
    application_title,
    counselor_id,
    phase,
    status,
    plan_label,
    next_meeting_label,
    updated_at
  )
  values (
    student_uid,
    'michellezlou@gmail.com',
    split_part('michellezlou@gmail.com', '@', 1),
    app_id,
    coalesce(app_title, 'My application'),
    counselor_id,
    'essays',
    'active',
    '标准规划 · Premium 服务',
    '6/12 · 已预约',
    now_ts
  )
  on conflict (student_user_id, application_id) do update
  set
    counselor_id = excluded.counselor_id,
    student_email = excluded.student_email,
    application_title = excluded.application_title,
    status = 'active',
    updated_at = now_ts
  returning id into v_engagement_id;

  if v_engagement_id is null then
    select e.id into v_engagement_id
    from public.engagements e
    where e.student_user_id = student_uid and e.application_id = app_id;
  end if;

  if not exists (select 1 from public.case_messages m where m.engagement_id = v_engagement_id limit 1) then
    insert into public.case_messages (engagement_id, author_role, author_label, body, channel, pinned, read_by_student, created_at)
    values
      (v_engagement_id, 'counselor', counselor_name, '【置顶】ED 校请在 6/15 前确认；确认后我会更新 reach 校说明。', 'direct', true, false, now_ts),
      (v_engagement_id, 'counselor', counselor_name, '欢迎加入 OnlyApply Premium 服务。本周我们先定 ED 校方向，并在待办里完成 #1。', 'direct', false, false, now_ts),
      (v_engagement_id, 'counselor', counselor_name, 'Premium 群公告：文书阶段每周三晚 8 点 sync，有冲突请提前在群里说。', 'group', true, false, now_ts),
      (v_engagement_id, 'system', '系统', 'Premium 服务已开通 · 阶段：文书准备', 'direct', false, true, now_ts);
  end if;

  if not exists (select 1 from public.case_tasks t where t.engagement_id = v_engagement_id limit 1) then
    insert into public.case_tasks (engagement_id, title, due_at, status, link_type, created_at)
    values
      (v_engagement_id, '补 SAT 目标分', (current_date + 7)::date, 'open', 'profile', now_ts),
      (v_engagement_id, 'PIQ 第一稿', (current_date + 14)::date, 'open', 'essay', now_ts),
      (v_engagement_id, '更新夏校结果', null, 'done', 'activities', now_ts);
  end if;

  if not exists (select 1 from public.case_documents d where d.engagement_id = v_engagement_id limit 1) then
    insert into public.case_documents (engagement_id, name, doc_type, status, due_at)
    values
      (v_engagement_id, 'Common App 主文书', 'essay', 'draft', (current_date + 21)::date),
      (v_engagement_id, 'UC PIQ 合集', 'essay', 'needed', (current_date + 28)::date),
      (v_engagement_id, 'Counselor 推荐信', 'recommendation', 'needed', null),
      (v_engagement_id, '9 年级–11 年级成绩单', 'transcript', 'submitted', null);
  end if;

  if not exists (select 1 from public.case_files f where f.engagement_id = v_engagement_id limit 1) then
    insert into public.case_files (engagement_id, name, category, uploaded_at)
    values
      (v_engagement_id, '活动列表.csv', 'activities', now_ts),
      (v_engagement_id, 'Summer program certificate.pdf', 'evidence', now_ts);
  end if;

  raise notice 'Engagement linked. engagement_id=% student=% application=% counselor=%',
    v_engagement_id, student_uid, app_id, counselor_id;
end $$;
