#!/usr/bin/env node
/**
 * Link a student to a counselor engagement (Premium service).
 *
 * Requires in college-strategy-mvp/.env:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   STUDENT_EMAIL=michellezlou@gmail.com COUNSELOR_EMAIL=weiyiwang603@gmail.com node scripts/seed-engagement.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const EMPTY_FORM_STATE = {
  intakeTerm: "",
  intakeOtherDetail: "",
  applicantIdentity: "",
  citizenship: "",
  residenceRegion: "",
  budget: "",
  testing: "",
  satScore: "",
  actScore: "",
  highSchoolSystem: "",
  currentHighSchool: "",
  gpa: "",
  gpaTrend: "",
  languageScores: "",
  academicSpecialFlags: [],
  academicSpecialNotes: "",
  majorPrimary: "",
  majorSecondary: "",
  schoolSize: "",
  campusCulturePref: "",
  geoPrefs: [],
  activities: "",
  structuredActivities: [],
  riskStyle: "",
  dealbreakers: "",
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
  }
}

loadDotEnv();

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const studentEmail = (process.env.STUDENT_EMAIL || "").trim().toLowerCase();
const counselorEmail = (process.env.COUNSELOR_EMAIL || "weiyiwang603@gmail.com").trim().toLowerCase();

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!studentEmail) {
  console.error("Set STUDENT_EMAIL in the environment.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function findUserByEmail(users, email) {
  return users.find((u) => u.email?.toLowerCase() === email);
}

async function listAllUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page += 1;
  }
  return users;
}

const users = await listAllUsers();
const student = findUserByEmail(users, studentEmail);
if (!student) {
  console.error(`No Auth user for ${studentEmail}. Student must sign in once, then retry.`);
  process.exit(1);
}

let { data: app, error: appErr } = await admin
  .from("saved_applications")
  .select("id, title")
  .eq("user_id", student.id)
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (appErr) {
  console.error("saved_applications query failed:", appErr.message);
  process.exit(1);
}
if (!app) {
  const { data: createdApp, error: createAppErr } = await admin
    .from("saved_applications")
    .insert({
      user_id: student.id,
      title: "Premium 服务 · 我的申请",
      form_state: EMPTY_FORM_STATE,
      locale: "zh",
      updated_at: new Date().toISOString(),
    })
    .select("id, title")
    .single();
  if (createAppErr) {
    console.error("saved_applications insert failed:", createAppErr.message);
    process.exit(1);
  }
  app = createdApp;
  console.log("Created placeholder saved_application (student had no reports yet).");
}

const { data: counselor, error: counselorErr } = await admin
  .from("counselors")
  .select("id, name")
  .eq("active", true)
  .ilike("email", counselorEmail)
  .limit(1)
  .maybeSingle();
if (counselorErr) {
  console.error("counselors query failed:", counselorErr.message);
  process.exit(1);
}
if (!counselor) {
  console.error(`Counselor ${counselorEmail} not found. Run bootstrap-counselor-weiyiwang.sql first.`);
  process.exit(1);
}

const now = new Date().toISOString();
const { data: engagement, error: engErr } = await admin
  .from("engagements")
  .upsert(
    {
      student_user_id: student.id,
      student_email: studentEmail,
      student_name: studentEmail.split("@")[0],
      application_id: app.id,
      application_title: app.title || "My application",
      counselor_id: counselor.id,
      phase: "essays",
      status: "active",
      plan_label: "标准规划 · Premium 服务",
      next_meeting_label: "6/12 · 已预约",
      updated_at: now,
    },
    { onConflict: "student_user_id,application_id" },
  )
  .select("id")
  .single();
if (engErr) {
  console.error("engagements upsert failed:", engErr.message);
  process.exit(1);
}

const engagementId = engagement.id;

const { count: msgCount } = await admin
  .from("case_messages")
  .select("id", { count: "exact", head: true })
  .eq("engagement_id", engagementId);
if (!msgCount) {
  const { error } = await admin.from("case_messages").insert([
    {
      engagement_id: engagementId,
      author_role: "counselor",
      author_label: counselor.name,
      body: "【置顶】ED 校请在 6/15 前确认；确认后我会更新 reach 校说明。",
      channel: "direct",
      pinned: true,
      read_by_student: false,
      created_at: now,
    },
    {
      engagement_id: engagementId,
      author_role: "counselor",
      author_label: counselor.name,
      body: "欢迎加入 OnlyApply Premium 服务。本周我们先定 ED 校方向，并在待办里完成 #1。",
      channel: "direct",
      pinned: false,
      read_by_student: false,
      created_at: now,
    },
    {
      engagement_id: engagementId,
      author_role: "counselor",
      author_label: counselor.name,
      body: "Premium 群公告：文书阶段每周三晚 8 点 sync，有冲突请提前在群里说。",
      channel: "group",
      pinned: true,
      read_by_student: false,
      created_at: now,
    },
    {
      engagement_id: engagementId,
      author_role: "system",
      author_label: "系统",
      body: "Premium 服务已开通 · 阶段：文书准备",
      channel: "direct",
      pinned: false,
      read_by_student: true,
      created_at: now,
    },
  ]);
  if (error) {
    console.error("case_messages insert failed:", error.message);
    process.exit(1);
  }
}

const { count: taskCount } = await admin
  .from("case_tasks")
  .select("id", { count: "exact", head: true })
  .eq("engagement_id", engagementId);
if (!taskCount) {
  const due7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const due14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const { error } = await admin.from("case_tasks").insert([
    { engagement_id: engagementId, title: "补 SAT 目标分", due_at: due7, status: "open", link_type: "profile", created_at: now },
    { engagement_id: engagementId, title: "PIQ 第一稿", due_at: due14, status: "open", link_type: "essay", created_at: now },
    { engagement_id: engagementId, title: "更新夏校结果", status: "done", link_type: "activities", created_at: now },
  ]);
  if (error) {
    console.error("case_tasks insert failed:", error.message);
    process.exit(1);
  }
}

const { count: docCount } = await admin
  .from("case_documents")
  .select("id", { count: "exact", head: true })
  .eq("engagement_id", engagementId);
if (!docCount) {
  const due21 = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  const due28 = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
  const { error } = await admin.from("case_documents").insert([
    { engagement_id: engagementId, name: "Common App 主文书", doc_type: "essay", status: "draft", due_at: due21 },
    { engagement_id: engagementId, name: "UC PIQ 合集", doc_type: "essay", status: "needed", due_at: due28 },
    { engagement_id: engagementId, name: "Counselor 推荐信", doc_type: "recommendation", status: "needed" },
    { engagement_id: engagementId, name: "9 年级–11 年级成绩单", doc_type: "transcript", status: "submitted" },
  ]);
  if (error) {
    console.error("case_documents insert failed:", error.message);
    process.exit(1);
  }
}

const { count: fileCount } = await admin
  .from("case_files")
  .select("id", { count: "exact", head: true })
  .eq("engagement_id", engagementId);
if (!fileCount) {
  const { error } = await admin.from("case_files").insert([
    { engagement_id: engagementId, name: "活动列表.csv", category: "activities", uploaded_at: now },
    { engagement_id: engagementId, name: "Summer program certificate.pdf", category: "evidence", uploaded_at: now },
  ]);
  if (error) {
    console.error("case_files insert failed:", error.message);
    process.exit(1);
  }
}

console.log("Done.");
console.log("  Student:", studentEmail, student.id);
console.log("  Counselor:", counselorEmail, counselor.id);
console.log("  Application:", app.id, app.title);
console.log("  Engagement:", engagementId);
