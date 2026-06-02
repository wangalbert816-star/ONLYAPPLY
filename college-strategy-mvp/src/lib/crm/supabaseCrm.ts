import { apiUrl } from "../apiBase";
import { getSupabase, isSupabaseConfigured } from "../supabase/client";
import { normalizeMeetingUrl } from "./meetingBooking";
import type {
  CrmApplicationDocument,
  CrmCounselor,
  CrmEngagement,
  CrmMessage,
  CrmMessageChannel,
  CrmMessageRole,
  CrmPhase,
  CrmFileUploaderRole,
  CrmLibraryItem,
  CrmMeetingRecap,
  CrmStoredFile,
  CrmStoreSnapshot,
  CrmTask,
  CrmTaskItemKind,
  CrmTaskLinkType,
} from "./types";
import { parseGoogleDocsUrl, toGoogleCopyUrl, validateGoogleDocsUrl } from "./libraryLinks";

type EngagementRow = {
  id: string;
  student_user_id: string;
  student_email: string;
  student_name: string | null;
  application_id: string;
  application_title: string;
  counselor_id: string;
  status: string;
  phase: string;
  plan_label: string | null;
  needs_follow_up: boolean;
  internal_notes: string;
  next_meeting_label: string | null;
  meeting_join_url: string | null;
  created_at: string;
  updated_at: string;
};

type CounselorRow = {
  id: string;
  user_id: string | null;
  name: string;
  title: string;
  bio: string | null;
  email: string | null;
  calendly_url: string | null;
  meeting_url: string | null;
};

function mapCounselor(row: CounselorRow): CrmCounselor {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    bio: row.bio ?? undefined,
    email: row.email ?? undefined,
    calendlyUrl: row.calendly_url ?? undefined,
    meetingUrl: row.meeting_url ?? undefined,
  };
}

export async function supabaseUpdateOwnCounselorBooking(input: {
  calendlyUrl?: string;
  meetingUrl?: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("auth_required");

  const profile = await fetchCounselorByUserId(user.id);
  if (!profile) throw new Error("counselor_not_found");

  const patch: Record<string, string | null> = {};
  if (input.calendlyUrl !== undefined) {
    const normalized = input.calendlyUrl.trim();
    patch.calendly_url = normalized || null;
  }
  if (input.meetingUrl !== undefined) {
    patch.meeting_url = normalizeMeetingUrl(input.meetingUrl);
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await sb.from("counselors").update(patch).eq("id", profile.id);
  if (error) throw error;
}

function mapEngagement(row: EngagementRow, counselorIdsByEngagementId?: Map<string, string[]>): CrmEngagement {
  const collaboratorIds = counselorIdsByEngagementId?.get(row.id) ?? [];
  const merged = [row.counselor_id, ...collaboratorIds].filter(Boolean);
  const uniq: string[] = [];
  for (const id of merged) if (!uniq.includes(id)) uniq.push(id);
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    studentEmail: row.student_email,
    studentName: row.student_name ?? undefined,
    applicationId: row.application_id,
    applicationTitle: row.application_title,
    counselorId: row.counselor_id,
    counselorIds: uniq.length ? uniq : [row.counselor_id],
    phase: row.phase as CrmPhase,
    status: row.status as CrmEngagement["status"],
    planLabel: row.plan_label ?? undefined,
    needsFollowUp: row.needs_follow_up,
    internalNotes: row.internal_notes,
    nextMeetingLabel: row.next_meeting_label ?? undefined,
    meetingJoinUrl: row.meeting_join_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function probeSupabaseCrm(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("counselors").select("id").limit(1);
  return !error;
}

export async function bootstrapDevCounselorProfile(): Promise<CrmCounselor | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { error } = await sb.rpc("crm_bootstrap_dev_counselor");
  if (error) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  return fetchCounselorByUserId(user.id);
}

export async function fetchCounselorByUserId(userId: string): Promise<CrmCounselor | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("counselors")
    .select("id, user_id, name, title, bio, email, calendly_url, meeting_url")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    console.error("[crm] fetchCounselorByUserId", error);
    return null;
  }
  if (data) return mapCounselor(data as CounselorRow);

  const {
    data: { user },
  } = await sb.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!email) return null;

  const { data: byEmail, error: emailErr } = await sb
    .from("counselors")
    .select("id, user_id, name, title, bio, email, calendly_url, meeting_url")
    .ilike("email", email)
    .eq("active", true);
  if (emailErr) {
    console.error("[crm] fetchCounselorByEmail", emailErr);
    return null;
  }
  const match = (byEmail ?? []).find((r) => String(r.email ?? "").trim().toLowerCase() === email);
  return match ? mapCounselor(match as CounselorRow) : null;
}

export async function fetchCrmSnapshotForStudent(userId: string): Promise<CrmStoreSnapshot> {
  const sb = getSupabase();
  if (!sb) return emptySnapshot();

  const { data: engagementRows, error: engErr } = await sb
    .from("engagements")
    .select("*")
    .eq("student_user_id", userId)
    .order("updated_at", { ascending: false });
  if (engErr) throw engErr;

  return loadSnapshotForEngagements(sb, (engagementRows ?? []) as EngagementRow[]);
}

export async function fetchCrmSnapshotForCounselor(userId: string): Promise<CrmStoreSnapshot> {
  const sb = getSupabase();
  if (!sb) return emptySnapshot();

  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    try {
      const res = await fetch(apiUrl("/api/counselor/crm/snapshot"), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { snapshot?: CrmStoreSnapshot };
        if (body.snapshot) return body.snapshot;
      } else {
        console.warn("[crm] counselor snapshot api", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.warn("[crm] counselor snapshot api", err);
    }
  }

  const counselor = await fetchCounselorByUserId(userId);
  if (!counselor) return emptySnapshot();

  const engagementIdSet = new Set<string>();

  const { data: collabs, error: collabErr } = await sb
    .from("engagement_counselors")
    .select("engagement_id")
    .eq("counselor_id", counselor.id)
    .eq("active", true);
  if (collabErr) throw collabErr;
  for (const row of collabs ?? []) {
    if (row.engagement_id) engagementIdSet.add(String(row.engagement_id));
  }

  // Fallback when join row is missing but engagements.counselor_id still points here (legacy primary).
  const { data: primaryRows, error: primaryErr } = await sb
    .from("engagements")
    .select("id")
    .eq("counselor_id", counselor.id);
  if (primaryErr) throw primaryErr;
  for (const row of primaryRows ?? []) {
    if (row.id) engagementIdSet.add(String(row.id));
  }

  const engagementIds = [...engagementIdSet];
  if (engagementIds.length === 0) {
    const snapshot = emptySnapshot();
    snapshot.counselors = [counselor];
    return snapshot;
  }

  const { data: engagementRows, error: engErr } = await sb
    .from("engagements")
    .select("*")
    .in("id", engagementIds)
    .order("updated_at", { ascending: false });
  if (engErr) throw engErr;

  const snapshot = await loadSnapshotForEngagements(sb, (engagementRows ?? []) as EngagementRow[]);
  if (!snapshot.counselors.some((c) => c.id === counselor.id)) {
    snapshot.counselors = [counselor, ...snapshot.counselors];
  }
  return snapshot;
}

function emptySnapshot(): CrmStoreSnapshot {
  return {
    counselors: [],
    engagements: [],
    messages: [],
    tasks: [],
    documents: [],
    files: [],
    meetingRecaps: [],
  };
}

async function loadSnapshotForEngagements(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  engagementRows: EngagementRow[],
): Promise<CrmStoreSnapshot> {
  if (engagementRows.length === 0) return emptySnapshot();

  const engagementIds = engagementRows.map((e) => e.id);
  const { data: collabs, error: collabErr } = await sb
    .from("engagement_counselors")
    .select("engagement_id, counselor_id, role, active")
    .in("engagement_id", engagementIds)
    .eq("active", true);
  if (collabErr) throw collabErr;

  const counselorIdsByEngagementId = new Map<string, string[]>();
  for (const row of collabs ?? []) {
    const list = counselorIdsByEngagementId.get(String(row.engagement_id)) ?? [];
    list.push(String(row.counselor_id));
    counselorIdsByEngagementId.set(String(row.engagement_id), list);
  }

  const allCounselorIds = new Set<string>();
  for (const e of engagementRows) allCounselorIds.add(e.counselor_id);
  for (const ids of counselorIdsByEngagementId.values()) for (const id of ids) allCounselorIds.add(id);
  const counselorIds = [...allCounselorIds].filter(Boolean);

  const [counselorRes, messagesRes, tasksRes, documentsRes, filesRes, recapsRes] = await Promise.all([
    sb.from("counselors").select("id, user_id, name, title, bio, email, calendly_url, meeting_url").in("id", counselorIds),
    sb.from("case_messages").select("*").in("engagement_id", engagementIds),
    sb.from("case_tasks").select("*").in("engagement_id", engagementIds),
    sb.from("case_documents").select("*").in("engagement_id", engagementIds),
    sb.from("case_files").select("*").in("engagement_id", engagementIds),
    sb.from("case_meeting_recaps").select("*").in("engagement_id", engagementIds),
  ]);

  if (counselorRes.error) throw counselorRes.error;
  if (messagesRes.error) throw messagesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (documentsRes.error) throw documentsRes.error;
  if (filesRes.error) throw filesRes.error;
  if (recapsRes.error) {
    const msg = (recapsRes.error.message ?? "").toLowerCase();
    if (!msg.includes("case_meeting_recaps") || !msg.includes("does not exist")) {
      throw recapsRes.error;
    }
  }

  const meetingRecaps = recapsRes.error
    ? []
    : ((recapsRes.data ?? []) as Record<string, unknown>[]).map(mapMeetingRecap);

  return {
    counselors: ((counselorRes.data ?? []) as CounselorRow[]).map(mapCounselor),
    engagements: engagementRows.map((row) => mapEngagement(row, counselorIdsByEngagementId)),
    messages: ((messagesRes.data ?? []) as Record<string, unknown>[]).map(mapMessage),
    tasks: ((tasksRes.data ?? []) as Record<string, unknown>[]).map(mapTask),
    documents: ((documentsRes.data ?? []) as Record<string, unknown>[]).map(mapDocument),
    files: ((filesRes.data ?? []) as Record<string, unknown>[]).map(mapFile),
    meetingRecaps,
  };
}

function mapMessage(row: Record<string, unknown>): CrmMessage {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    authorRole: row.author_role as CrmMessageRole,
    authorLabel: String(row.author_label),
    body: String(row.body),
    channel: (row.channel as CrmMessageChannel) ?? "direct",
    pinned: Boolean(row.pinned),
    createdAt: String(row.created_at),
    readByStudent: Boolean(row.read_by_student),
  };
}

function mapTask(row: Record<string, unknown>): CrmTask {
  const attachedRaw = row.attached_file_ids;
  const attachedFileIds = Array.isArray(attachedRaw)
    ? attachedRaw.map((id) => String(id))
    : undefined;
  const submittedRaw = row.submitted_file_ids;
  const submittedFileIds = Array.isArray(submittedRaw)
    ? submittedRaw.map((id) => String(id))
    : undefined;
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    dueAt: row.due_at ? String(row.due_at) : undefined,
    status: row.status as CrmTask["status"],
    linkType: row.link_type as CrmTaskLinkType,
    itemKind: row.item_kind === "resource" ? "resource" : "action",
    attachedFileIds: attachedFileIds?.length ? attachedFileIds : undefined,
    submittedFileIds: submittedFileIds?.length ? submittedFileIds : undefined,
    returnedAt: row.returned_at ? String(row.returned_at) : undefined,
    returnNote: row.return_note ? String(row.return_note) : undefined,
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}

export async function supabaseAppendTaskSubmissionFile(taskId: string, fileId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const { data: row, error: readErr } = await sb
    .from("case_tasks")
    .select("submitted_file_ids")
    .eq("id", taskId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) throw new Error("task_not_found");

  const existing = Array.isArray(row.submitted_file_ids)
    ? row.submitted_file_ids.map((id: string) => String(id))
    : [];
  if (existing.includes(fileId)) return;

  const { error: updateErr } = await sb
    .from("case_tasks")
    .update({
      submitted_file_ids: [...existing, fileId],
      returned_at: null,
      return_note: null,
    })
    .eq("id", taskId);
  if (updateErr) {
    const msg = (updateErr.message ?? "").toLowerCase();
    if (msg.includes("submitted_file_ids") && msg.includes("column")) {
      throw new Error("task_submissions_schema_missing");
    }
    if (msg.includes("returned_at") || msg.includes("return_note")) {
      const { error: fallbackErr } = await sb
        .from("case_tasks")
        .update({ submitted_file_ids: [...existing, fileId] })
        .eq("id", taskId);
      if (fallbackErr) throw fallbackErr;
      return;
    }
    throw updateErr;
  }
}

export async function supabaseReturnTaskSubmission(taskId: string, note?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const { error } = await sb
    .from("case_tasks")
    .update({
      status: "open",
      completed_at: null,
      returned_at: new Date().toISOString(),
      return_note: note?.trim() ? note.trim() : null,
    })
    .eq("id", taskId);
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("returned_at") || msg.includes("return_note")) {
      throw new Error("task_return_schema_missing");
    }
    throw error;
  }
}

function mapDocument(row: Record<string, unknown>): CrmApplicationDocument {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    name: String(row.name),
    docType: String(row.doc_type),
    status: row.status as CrmApplicationDocument["status"],
    dueAt: row.due_at ? String(row.due_at) : undefined,
    note: row.note ? String(row.note) : undefined,
  };
}

function mapMeetingRecap(row: Record<string, unknown>): CrmMeetingRecap {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    title: String(row.title),
    heldAt: row.held_at ? String(row.held_at) : undefined,
    body: String(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const CRM_FILES_BUCKET = "crm-case-files";
const CRM_LIBRARY_BUCKET = "crm-library-files";
const MAX_CASE_FILE_BYTES = 20 * 1024 * 1024;

function sanitizeCaseFileName(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.replace(/[/\\]+/g, "_").replace(/[^a-zA-Z0-9._-]+/g, "_");
  return (base || "file").slice(0, 180);
}

function mapFile(row: Record<string, unknown>): CrmStoredFile {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    name: String(row.name),
    category: String(row.category),
    uploadedAt: String(row.uploaded_at),
    note: row.note ? String(row.note) : undefined,
    storagePath: row.storage_path ? String(row.storage_path) : undefined,
    externalUrl: row.external_url ? String(row.external_url) : undefined,
    uploadedByRole: row.uploaded_by_role ? (String(row.uploaded_by_role) as CrmStoredFile["uploadedByRole"]) : undefined,
    contentType: row.content_type ? String(row.content_type) : undefined,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : undefined,
    taskId: row.task_id ? String(row.task_id) : undefined,
  };
}

function mapLibraryItem(row: Record<string, unknown>): CrmLibraryItem {
  const itemKind = (String(row.item_kind || "file") as CrmLibraryItem["itemKind"]) || "file";
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    category: String(row.category),
    locale: String(row.locale) as CrmLibraryItem["locale"],
    itemKind,
    fileName: row.file_name ? String(row.file_name) : "",
    storagePath: row.storage_path ? String(row.storage_path) : undefined,
    externalUrl: row.external_url ? String(row.external_url) : undefined,
    contentType: row.content_type ? String(row.content_type) : undefined,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : undefined,
    active: Boolean(row.active),
    sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function supabaseCreateDemoEngagement(input: {
  studentUserId: string;
  studentEmail: string;
  studentName?: string;
  applicationId: string;
  applicationTitle: string;
}): Promise<CrmEngagement> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const { data: existing } = await sb
    .from("engagements")
    .select("*")
    .eq("student_user_id", input.studentUserId)
    .eq("application_id", input.applicationId)
    .maybeSingle();
  if (existing) return mapEngagement(existing as EngagementRow);

  const { data: counselorRow, error: counselorErr } = await sb
    .from("counselors")
    .select("id, user_id, name, title, bio, email, calendly_url, meeting_url")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (counselorErr) throw counselorErr;
  if (!counselorRow) throw new Error("no_counselor");

  const counselor = mapCounselor(counselorRow as CounselorRow);
  const now = new Date().toISOString();

  const { data: engagementRow, error: insertErr } = await sb
    .from("engagements")
    .insert({
      student_user_id: input.studentUserId,
      student_email: input.studentEmail,
      student_name: input.studentName ?? null,
      application_id: input.applicationId,
      application_title: input.applicationTitle,
      counselor_id: counselor.id,
      phase: "essays",
      status: "active",
      plan_label: "标准规划 · Supabase 演示",
      next_meeting_label: "6/12 · 已预约",
      updated_at: now,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  // Backfill collaborator row for the seeded counselor in demo/dev.
  await sb.from("engagement_counselors").upsert(
    {
      engagement_id: engagementRow.id,
      counselor_id: counselor.id,
      role: "primary",
      active: true,
    },
    { onConflict: "engagement_id,counselor_id" },
  );

  const engagement = mapEngagement(engagementRow as EngagementRow, new Map([[String(engagementRow.id), [counselor.id]]])); // seed includes primary
  await seedSupabaseEngagementExtras(sb, engagement.id, counselor.name, now);
  return engagement;
}

async function seedSupabaseEngagementExtras(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  engagementId: string,
  counselorName: string,
  createdAt: string,
) {
  await sb.from("case_documents").insert([
    {
      engagement_id: engagementId,
      name: "Common App 主文书",
      doc_type: "essay",
      status: "draft",
      due_at: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
    },
    {
      engagement_id: engagementId,
      name: "UC PIQ 合集",
      doc_type: "essay",
      status: "needed",
      due_at: new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10),
    },
    {
      engagement_id: engagementId,
      name: "Counselor 推荐信",
      doc_type: "recommendation",
      status: "needed",
      note: "向学校 counselor 确认 timeline",
    },
    {
      engagement_id: engagementId,
      name: "9 年级–11 年级成绩单",
      doc_type: "transcript",
      status: "submitted",
    },
  ]);

  await sb.from("case_files").insert([
    { engagement_id: engagementId, name: "活动列表.csv", category: "activities", uploaded_at: createdAt },
    {
      engagement_id: engagementId,
      name: "Summer program certificate.pdf",
      category: "evidence",
      uploaded_at: createdAt,
    },
  ]);

  await sb.from("case_messages").insert([
    {
      engagement_id: engagementId,
      author_role: "counselor",
      author_label: counselorName,
      body: "【置顶】ED 校请在 6/15 前确认；确认后我会更新 reach 校说明。",
      channel: "direct",
      pinned: true,
      read_by_student: false,
      created_at: createdAt,
    },
    {
      engagement_id: engagementId,
      author_role: "counselor",
      author_label: counselorName,
      body: "欢迎加入 OnlyApply Premium 服务。本周我们先定 ED 校方向，并在行动项里完成 #1。",
      channel: "direct",
      pinned: false,
      read_by_student: false,
      created_at: createdAt,
    },
    {
      engagement_id: engagementId,
      author_role: "counselor",
      author_label: counselorName,
      body: "Premium 群公告：文书阶段每周三晚 8 点 sync，有冲突请提前在群里说。",
      channel: "group",
      pinned: true,
      read_by_student: false,
      created_at: createdAt,
    },
    {
      engagement_id: engagementId,
      author_role: "system",
      author_label: "系统",
      body: "Premium 服务已开通 · 阶段：文书准备",
      channel: "direct",
      pinned: false,
      read_by_student: true,
      created_at: createdAt,
    },
  ]);

  await sb.from("case_tasks").insert([
    {
      engagement_id: engagementId,
      title: "补 SAT 目标分",
      due_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: "open",
      link_type: "profile",
      created_at: createdAt,
    },
    {
      engagement_id: engagementId,
      title: "PIQ 第一稿",
      due_at: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: "open",
      link_type: "essay",
      created_at: createdAt,
    },
    {
      engagement_id: engagementId,
      title: "更新夏校结果",
      status: "done",
      link_type: "activities",
      completed_at: createdAt,
      created_at: createdAt,
    },
  ]);
}

export async function supabaseAddMessage(input: {
  engagementId: string;
  authorRole: CrmMessageRole;
  authorLabel: string;
  body: string;
  channel?: CrmMessageChannel;
  pinned?: boolean;
  readByStudent?: boolean;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const now = new Date().toISOString();
  await sb.from("case_messages").insert({
    engagement_id: input.engagementId,
    author_role: input.authorRole,
    author_label: input.authorLabel,
    body: input.body.trim(),
    channel: input.channel ?? "direct",
    pinned: input.pinned ?? false,
    read_by_student: input.readByStudent ?? input.authorRole === "student",
    created_at: now,
  });
  await sb.from("engagements").update({ updated_at: now }).eq("id", input.engagementId);
}

export async function supabaseToggleMessagePin(messageId: string, pinned: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("case_messages").update({ pinned }).eq("id", messageId);
}

export async function supabaseAddTask(input: {
  engagementId: string;
  title: string;
  description?: string;
  dueAt?: string;
  linkType: CrmTaskLinkType;
  itemKind?: CrmTaskItemKind;
  attachedFileIds?: string[];
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const now = new Date().toISOString();
  const description = input.description?.trim();
  await sb.from("case_tasks").insert({
    engagement_id: input.engagementId,
    title: input.title.trim(),
    description: description || null,
    due_at: input.dueAt ?? null,
    status: "open",
    link_type: input.linkType,
    item_kind: input.itemKind === "resource" ? "resource" : "action",
    attached_file_ids: input.attachedFileIds?.length ? input.attachedFileIds : [],
    created_at: now,
  });
  await sb.from("engagements").update({ updated_at: now }).eq("id", input.engagementId);
}

export async function supabaseSetTaskDone(taskId: string, done: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const now = new Date().toISOString();
  await sb
    .from("case_tasks")
    .update({
      status: done ? "done" : "open",
      completed_at: done ? now : null,
    })
    .eq("id", taskId);
}

export async function supabaseUpdateTask(
  taskId: string,
  patch: {
    title?: string;
    description?: string;
    dueAt?: string | null;
    linkType?: CrmTaskLinkType;
    itemKind?: CrmTaskItemKind;
  },
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { data: task, error: fetchErr } = await sb
    .from("case_tasks")
    .select("engagement_id")
    .eq("id", taskId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!task) throw new Error("task_not_found");

  const update: Record<string, unknown> = {};
  if (patch.title != null) update.title = patch.title.trim();
  if (patch.description != null) update.description = patch.description.trim() || null;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt || null;
  if (patch.linkType != null) update.link_type = patch.linkType;
  if (patch.itemKind != null) update.item_kind = patch.itemKind === "resource" ? "resource" : "action";

  const { error } = await sb.from("case_tasks").update(update).eq("id", taskId);
  if (error) throw error;

  await sb
    .from("engagements")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", task.engagement_id);
}

export async function supabaseDeleteTask(taskId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { data: task, error: fetchErr } = await sb
    .from("case_tasks")
    .select("engagement_id")
    .eq("id", taskId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!task) throw new Error("task_not_found");

  const { error } = await sb.from("case_tasks").delete().eq("id", taskId);
  if (error) throw error;

  await sb
    .from("engagements")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", task.engagement_id);
}

export async function supabaseAddDocument(input: {
  engagementId: string;
  name: string;
  docType: string;
  status?: CrmApplicationDocument["status"];
  dueAt?: string;
  note?: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("case_documents").insert({
    engagement_id: input.engagementId,
    name: input.name.trim(),
    doc_type: input.docType.trim() || "general",
    status: input.status ?? "needed",
    due_at: input.dueAt ?? null,
    note: input.note ?? null,
  });
  await sb.from("engagements").update({ updated_at: new Date().toISOString() }).eq("id", input.engagementId);
}

export async function supabaseUpdateDocumentStatus(
  documentId: string,
  status: CrmApplicationDocument["status"],
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("case_documents").update({ status }).eq("id", documentId);
}

export async function supabaseAddStoredFile(input: {
  engagementId: string;
  name: string;
  category: string;
  note?: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const now = new Date().toISOString();
  await sb.from("case_files").insert({
    engagement_id: input.engagementId,
    name: input.name.trim(),
    category: input.category.trim() || "general",
    note: input.note ?? null,
    uploaded_at: now,
  });
  await sb.from("engagements").update({ updated_at: now }).eq("id", input.engagementId);
}

function isMissingTaskIdColumnError(error: { message?: string; code?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("task_id") && (msg.includes("column") || msg.includes("schema cache"));
}

async function insertCaseFileRow(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  row: Record<string, unknown>,
  taskId?: string,
) {
  const withTask = taskId ? { ...row, task_id: taskId } : row;
  let result = await sb.from("case_files").insert(withTask).select("*").single();
  if (result.error && taskId && isMissingTaskIdColumnError(result.error)) {
    result = await sb.from("case_files").insert(row).select("*").single();
  }
  if (result.error) throw result.error;
  return mapFile(result.data as Record<string, unknown>);
}

export async function supabaseSubmitCaseFileGoogleLink(input: {
  engagementId: string;
  url: string;
  name?: string;
  category: string;
  uploadedByRole: CrmFileUploaderRole;
  taskId?: string;
}): Promise<CrmStoredFile> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const validated = validateGoogleDocsUrl(input.url);
  if (!validated.ok) throw new Error(validated.code);

  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = (input.name || "").trim() || defaultGoogleDocFileName(validated.url);

  const stored = await insertCaseFileRow(
    sb,
    {
      id: fileId,
      engagement_id: input.engagementId,
      name: title,
      category: input.category.trim() || "general",
      external_url: validated.url,
      uploaded_by_role: input.uploadedByRole,
      uploaded_at: now,
    },
    input.taskId,
  );

  await sb.from("engagements").update({ updated_at: now }).eq("id", input.engagementId);
  return stored;
}

function defaultGoogleDocFileName(editUrl: string): string {
  const parsed = parseGoogleDocsUrl(editUrl);
  if (!parsed) return "Google Doc";
  const labels: Record<string, string> = {
    document: "Google Doc",
    spreadsheets: "Google Sheet",
    presentation: "Google Slides",
    forms: "Google Form",
  };
  return labels[parsed.kind] ?? "Google Doc";
}

export async function supabaseUploadCaseFile(input: {
  engagementId: string;
  file: File;
  category: string;
  uploadedByRole: CrmFileUploaderRole;
  taskId?: string;
}): Promise<CrmStoredFile> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");
  if (input.file.size > MAX_CASE_FILE_BYTES) throw new Error("file_too_large");

  const fileId = crypto.randomUUID();
  const safeName = sanitizeCaseFileName(input.file.name);
  const storagePath = `${input.engagementId}/${fileId}/${safeName}`;
  const now = new Date().toISOString();

  const { error: uploadErr } = await sb.storage.from(CRM_FILES_BUCKET).upload(storagePath, input.file, {
    contentType: input.file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadErr) {
    throw new Error(uploadErr.message || "upload_failed");
  }

  try {
    const stored = await insertCaseFileRow(
      sb,
      {
        id: fileId,
        engagement_id: input.engagementId,
        name: input.file.name.trim() || safeName,
        category: input.category.trim() || "general",
        storage_path: storagePath,
        uploaded_by_role: input.uploadedByRole,
        content_type: input.file.type || null,
        size_bytes: input.file.size,
        uploaded_at: now,
      },
      input.taskId,
    );
    await sb.from("engagements").update({ updated_at: now }).eq("id", input.engagementId);
    return stored;
  } catch (error) {
    await sb.storage.from(CRM_FILES_BUCKET).remove([storagePath]);
    throw error;
  }
}

export async function supabaseDeleteCaseFile(fileId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const { data: file, error: fetchErr } = await sb
    .from("case_files")
    .select("id, engagement_id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!file) throw new Error("file_not_found");

  const engagementId = String(file.engagement_id);

  const { data: tasks, error: tasksErr } = await sb
    .from("case_tasks")
    .select("id, attached_file_ids, submitted_file_ids")
    .eq("engagement_id", engagementId);
  if (tasksErr) throw tasksErr;

  for (const task of tasks ?? []) {
    const attached = Array.isArray(task.attached_file_ids)
      ? task.attached_file_ids.map((id: string) => String(id))
      : [];
    const submitted = Array.isArray(task.submitted_file_ids)
      ? task.submitted_file_ids.map((id: string) => String(id))
      : [];
    const nextAttached = attached.filter((id) => id !== fileId);
    const nextSubmitted = submitted.filter((id) => id !== fileId);
    if (nextAttached.length !== attached.length) {
      const { error: attachedErr } = await sb
        .from("case_tasks")
        .update({ attached_file_ids: nextAttached })
        .eq("id", task.id);
      if (attachedErr) throw attachedErr;
    }
    if (nextSubmitted.length !== submitted.length) {
      const { error: submittedErr } = await sb
        .from("case_tasks")
        .update({ submitted_file_ids: nextSubmitted })
        .eq("id", task.id);
      if (submittedErr) {
        const msg = (submittedErr.message ?? "").toLowerCase();
        if (!msg.includes("submitted_file_ids") || !msg.includes("column")) {
          throw submittedErr;
        }
      }
    }
  }

  const storagePath = file.storage_path ? String(file.storage_path) : "";
  if (storagePath) {
    const { error: storageErr } = await sb.storage.from(CRM_FILES_BUCKET).remove([storagePath]);
    if (storageErr) {
      const msg = (storageErr.message ?? "").toLowerCase();
      if (!msg.includes("not found") && !msg.includes("object not found")) {
        throw storageErr;
      }
    }
  }

  const { error: delErr } = await sb.from("case_files").delete().eq("id", fileId);
  if (delErr) throw delErr;

  await sb.from("engagements").update({ updated_at: new Date().toISOString() }).eq("id", engagementId);
}

export async function supabaseGetCaseFileDownloadUrl(fileId: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const { data, error } = await sb.from("case_files").select("storage_path, name").eq("id", fileId).maybeSingle();
  if (error) throw error;
  if (!data?.storage_path) throw new Error("file_not_stored");

  const { data: signed, error: signErr } = await sb.storage
    .from(CRM_FILES_BUCKET)
    .createSignedUrl(String(data.storage_path), 3600, { download: String(data.name) });
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("signed_url_failed");
  return signed.signedUrl;
}

export async function supabaseListLibraryItems(): Promise<CrmLibraryItem[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("crm_library_items")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapLibraryItem(row as Record<string, unknown>));
}

export async function supabaseAttachLibraryItemToCase(input: {
  engagementId: string;
  libraryItemId: string;
  uploadedByRole: CrmFileUploaderRole;
}): Promise<CrmStoredFile> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const { data: item, error } = await sb
    .from("crm_library_items")
    .select("*")
    .eq("id", input.libraryItemId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!item) throw new Error("library_item_not_found");

  const itemKind = String(item.item_kind || "file");
  if (itemKind === "link") {
    const templateUrl = item.external_url ? String(item.external_url) : "";
    if (!templateUrl) throw new Error("library_link_missing");
    const externalUrl = toGoogleCopyUrl(templateUrl);

    const fileId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { data, error: insertErr } = await sb
      .from("case_files")
      .insert({
        id: fileId,
        engagement_id: input.engagementId,
        name: String(item.title).trim() || "Google Sheet",
        category: String(item.category || "general"),
        external_url: externalUrl,
        uploaded_by_role: input.uploadedByRole,
        uploaded_at: now,
      })
      .select("*")
      .single();
    if (insertErr) throw insertErr;

    await sb.from("engagements").update({ updated_at: now }).eq("id", input.engagementId);
    return mapFile(data as Record<string, unknown>);
  }

  const storagePath = String(item.storage_path);
  const fileName = String(item.file_name);
  const { data: signed, error: signErr } = await sb.storage
    .from(CRM_LIBRARY_BUCKET)
    .createSignedUrl(storagePath, 300, { download: fileName });
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("signed_url_failed");

  const res = await fetch(signed.signedUrl);
  if (!res.ok) throw new Error("library_download_failed");

  const blob = await res.blob();
  const file = new File([blob], fileName, {
    type: item.content_type ? String(item.content_type) : blob.type || "application/octet-stream",
  });

  return supabaseUploadCaseFile({
    engagementId: input.engagementId,
    file,
    category: String(item.category || "general"),
    uploadedByRole: input.uploadedByRole,
  });
}

export async function supabaseUpdateNextMeetingLabel(engagementId: string, label: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("engagements")
    .update({
      next_meeting_label: label.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", engagementId);
}

export async function supabaseUpdateMeetingJoinUrl(engagementId: string, url: string | null): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const {
    data: { session },
  } = await sb.auth.getSession();
  const token = session?.access_token;
  if (token) {
    const res = await fetch(apiUrl(`/api/counselor/crm/engagements/${encodeURIComponent(engagementId)}/meeting-join-url`), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ meetingJoinUrl: url }),
    });
    if (res.ok) return;
    const body = await res.text().catch(() => "");
    if (res.status !== 404 && res.status !== 503) {
      throw new Error(body || `meeting_join_update_failed_${res.status}`);
    }
  }

  const { error } = await sb
    .from("engagements")
    .update({
      meeting_join_url: url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", engagementId);
  if (error) throw error;
}

export async function supabaseToggleFollowUp(engagementId: string, needsFollowUp: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("engagements")
    .update({ needs_follow_up: needsFollowUp, updated_at: new Date().toISOString() })
    .eq("id", engagementId);
}

export async function supabaseUpdateInternalNotes(engagementId: string, notes: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("engagements")
    .update({ internal_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", engagementId);
}

export async function supabaseAddMeetingRecap(input: {
  engagementId: string;
  title: string;
  heldAt?: string | null;
  body: string;
}): Promise<CrmMeetingRecap> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("case_meeting_recaps")
    .insert({
      engagement_id: input.engagementId,
      title: input.title.trim(),
      held_at: input.heldAt?.trim() || null,
      body: input.body.trim(),
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("case_meeting_recaps")) {
      throw new Error("meeting_recaps_schema_missing");
    }
    throw error;
  }

  await sb.from("engagements").update({ updated_at: now }).eq("id", input.engagementId);
  return mapMeetingRecap(data as Record<string, unknown>);
}

export async function supabaseDeleteMeetingRecap(recapId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");

  const { data: recap, error: fetchErr } = await sb
    .from("case_meeting_recaps")
    .select("engagement_id")
    .eq("id", recapId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!recap) throw new Error("meeting_recap_not_found");

  const { error } = await sb.from("case_meeting_recaps").delete().eq("id", recapId);
  if (error) throw error;

  await sb
    .from("engagements")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", recap.engagement_id);
}

export async function supabaseMarkMessagesReadByStudent(engagementId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("case_messages")
    .update({ read_by_student: true })
    .eq("engagement_id", engagementId)
    .eq("author_role", "counselor")
    .eq("read_by_student", false);
}

export function subscribeCrmRealtime(onEvent: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  const tables = ["case_messages", "case_files", "case_tasks", "case_meeting_recaps"] as const;
  let channel = sb.channel(`crm-live-${crypto.randomUUID()}`);
  for (const table of tables) {
    channel = channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table }, () => onEvent())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table }, () => onEvent())
      .on("postgres_changes", { event: "DELETE", schema: "public", table }, () => onEvent());
  }
  channel.subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}

export function isSupabaseCrmConfigured(): boolean {
  return isSupabaseConfigured();
}
