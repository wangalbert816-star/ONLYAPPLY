import { getAssignedExpert } from "../assignedExpert";
import {
  fetchCrmSnapshotForCounselor,
  fetchCrmSnapshotForStudent,
  probeSupabaseCrm,
  supabaseAddDocument,
  supabaseAddMessage,
  supabaseAddStoredFile,
  supabaseAddTask,
  supabaseCreateDemoEngagement,
  supabaseMarkMessagesReadByStudent,
  supabaseSetTaskDone,
  supabaseToggleFollowUp,
  supabaseToggleMessagePin,
  supabaseUpdateDocumentStatus,
  supabaseUpdateInternalNotes,
  supabaseUpdateNextMeetingLabel,
} from "./supabaseCrm";
import type {
  CrmApplicationDocument,
  CrmCounselor,
  CrmEngagement,
  CrmMessage,
  CrmMessageChannel,
  CrmMessageRole,
  CrmPhase,
  CrmStoredFile,
  CrmStoreSnapshot,
  CrmTask,
  CrmTaskLinkType,
} from "./types";

const STORAGE_KEY = "onlyapply_crm_v1";

type CrmBackend = "local" | "supabase";
type CrmRole = "student" | "counselor";

let crmBackend: CrmBackend = "local";
let memoryCache: CrmStoreSnapshot | null = null;
let crmUserId: string | null = null;
let crmRole: CrmRole | null = null;
let crmInitPromise: Promise<void> | null = null;

function getSnapshot(): CrmStoreSnapshot {
  if (crmBackend === "supabase") return memoryCache ?? emptyStore();
  return readStore();
}

async function persistRefresh(): Promise<void> {
  if (crmBackend !== "supabase" || !crmUserId || !crmRole) return;
  memoryCache =
    crmRole === "counselor"
      ? await fetchCrmSnapshotForCounselor(crmUserId)
      : await fetchCrmSnapshotForStudent(crmUserId);
  notifyCrmStoreChange();
}

function afterMutation(run: () => Promise<void>) {
  if (crmBackend === "supabase") {
    void run()
      .then(() => persistRefresh())
      .catch((err) => console.error("[crm]", err));
    return;
  }
  notifyCrmStoreChange();
}

export async function initCrmForUser(userId: string, role: CrmRole): Promise<CrmBackend> {
  if (crmInitPromise && crmUserId === userId && crmRole === role) {
    await crmInitPromise;
    return crmBackend;
  }
  crmUserId = userId;
  crmRole = role;
  crmInitPromise = (async () => {
    const canUseSupabase = await probeSupabaseCrm();
    if (canUseSupabase) {
      crmBackend = "supabase";
      await persistRefresh();
    } else if (isCrmDemoUiEnabled()) {
      crmBackend = "local";
      memoryCache = null;
    } else {
      crmBackend = "supabase";
      memoryCache = emptyStore();
    }
  })();
  await crmInitPromise;
  return crmBackend;
}

export function getCrmBackend(): CrmBackend {
  return crmBackend;
}

export async function refreshCrmCache(): Promise<void> {
  await persistRefresh();
}

function nowIso() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

function normalizeMessage(raw: Partial<CrmMessage> & { engagementId: string; body: string }): CrmMessage {
  return {
    id: raw.id ?? id(),
    engagementId: raw.engagementId,
    authorRole: raw.authorRole ?? "system",
    authorLabel: raw.authorLabel ?? "System",
    body: raw.body,
    channel: raw.channel ?? "direct",
    pinned: Boolean(raw.pinned),
    createdAt: raw.createdAt ?? nowIso(),
    readByStudent: raw.readByStudent ?? raw.authorRole === "student",
  };
}

function readStore(): CrmStoreSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<CrmStoreSnapshot>;
    return {
      counselors: Array.isArray(parsed.counselors) ? parsed.counselors : [],
      engagements: Array.isArray(parsed.engagements) ? parsed.engagements : [],
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.map((m) => normalizeMessage(m as CrmMessage))
        : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(snapshot: CrmStoreSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function emptyStore(): CrmStoreSnapshot {
  return { counselors: [], engagements: [], messages: [], tasks: [], documents: [], files: [] };
}

function defaultCounselor(): CrmCounselor {
  const expert = getAssignedExpert();
  if (expert) {
    return {
      id: "counselor-default",
      name: expert.name,
      title: expert.title,
      bio: expert.bio,
      email: expert.email,
      calendlyUrl: expert.calendlyUrl,
    };
  }
  return {
    id: "counselor-default",
    name: "王老师",
    title: "首席留学顾问",
    bio: "专注美本选校与活动主线梳理，OnlyApply 签约顾问。",
    email: "advisor@onlyapply.ai",
    calendlyUrl: "https://calendly.com",
  };
}

function ensureDefaultCounselor(store: CrmStoreSnapshot): CrmCounselor {
  const existing = store.counselors.find((c) => c.id === "counselor-default");
  if (existing) return existing;
  const counselor = defaultCounselor();
  store.counselors.push(counselor);
  writeStore(store);
  return counselor;
}

function seedEngagementExtras(store: CrmStoreSnapshot, engagementId: string, counselorName: string, createdAt: string) {
  store.documents.push(
    {
      id: id(),
      engagementId,
      name: "Common App 主文书",
      docType: "essay",
      status: "draft",
      dueAt: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
    },
    {
      id: id(),
      engagementId,
      name: "UC PIQ 合集",
      docType: "essay",
      status: "needed",
      dueAt: new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10),
    },
    {
      id: id(),
      engagementId,
      name: "Counselor 推荐信",
      docType: "recommendation",
      status: "needed",
      note: "向学校 counselor 确认 timeline",
    },
    {
      id: id(),
      engagementId,
      name: "9 年级–11 年级成绩单",
      docType: "transcript",
      status: "submitted",
    },
  );
  store.files.push(
    {
      id: id(),
      engagementId,
      name: "活动列表.csv",
      category: "activities",
      uploadedAt: createdAt,
    },
    {
      id: id(),
      engagementId,
      name: "Summer program certificate.pdf",
      category: "evidence",
      uploadedAt: createdAt,
    },
  );
  store.messages.push(
    normalizeMessage({
      id: id(),
      engagementId,
      authorRole: "counselor",
      authorLabel: counselorName,
      body: "【置顶】ED 校请在 6/15 前确认；确认后我会更新 reach 校说明。",
      channel: "direct",
      pinned: true,
      createdAt,
      readByStudent: false,
    }),
    normalizeMessage({
      id: id(),
      engagementId,
      authorRole: "counselor",
      authorLabel: counselorName,
      body: "欢迎加入 OnlyApply 签约服务。本周我们先定 ED 校方向，并在待办里完成 #1。",
      channel: "direct",
      pinned: false,
      createdAt,
      readByStudent: false,
    }),
    normalizeMessage({
      id: id(),
      engagementId,
      authorRole: "counselor",
      authorLabel: counselorName,
      body: "签约群公告：文书阶段每周三晚 8 点 sync，有冲突请提前在群里说。",
      channel: "group",
      pinned: true,
      createdAt,
      readByStudent: false,
    }),
    normalizeMessage({
      id: id(),
      engagementId,
      authorRole: "system",
      authorLabel: "系统",
      body: "签约服务已开通 · 阶段：文书准备",
      channel: "direct",
      pinned: false,
      createdAt,
      readByStudent: true,
    }),
  );
}

export function getCounselor(counselorId: string): CrmCounselor | null {
  return getSnapshot().counselors.find((c) => c.id === counselorId) ?? null;
}

export function listEngagements(): CrmEngagement[] {
  return getSnapshot().engagements.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getEngagementById(engagementId: string): CrmEngagement | null {
  return getSnapshot().engagements.find((e) => e.id === engagementId) ?? null;
}

export function getEngagementForApplication(studentUserId: string, applicationId: string): CrmEngagement | null {
  return (
    getSnapshot().engagements.find(
      (e) => e.studentUserId === studentUserId && e.applicationId === applicationId && e.status === "active",
    ) ?? null
  );
}

export async function createDemoEngagement(input: {
  studentUserId: string;
  studentEmail: string;
  studentName?: string;
  applicationId: string;
  applicationTitle: string;
}): Promise<CrmEngagement> {
  if (crmBackend === "supabase") {
    const engagement = await supabaseCreateDemoEngagement(input);
    await persistRefresh();
    return engagement;
  }
  const store = readStore();
  const counselor = ensureDefaultCounselor(store);
  const existing = store.engagements.find(
    (e) => e.studentUserId === input.studentUserId && e.applicationId === input.applicationId,
  );
  if (existing) return existing;

  const createdAt = nowIso();
  const engagement: CrmEngagement = {
    id: id(),
    studentUserId: input.studentUserId,
    studentEmail: input.studentEmail,
    studentName: input.studentName,
    applicationId: input.applicationId,
    applicationTitle: input.applicationTitle,
    counselorId: counselor.id,
    phase: "essays",
    status: "active",
    planLabel: "标准规划 · 本地演示",
    needsFollowUp: false,
    internalNotes: "",
    nextMeetingLabel: "6/12 · 已预约",
    createdAt,
    updatedAt: createdAt,
  };

  store.engagements.push(engagement);
  seedEngagementExtras(store, engagement.id, counselor.name, createdAt);
  store.tasks.push(
    {
      id: id(),
      engagementId: engagement.id,
      title: "补 SAT 目标分",
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: "open",
      linkType: "profile",
      createdAt,
    },
    {
      id: id(),
      engagementId: engagement.id,
      title: "PIQ 第一稿",
      dueAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: "open",
      linkType: "essay",
      createdAt,
    },
    {
      id: id(),
      engagementId: engagement.id,
      title: "更新夏校结果",
      status: "done",
      linkType: "activities",
      createdAt,
      completedAt: createdAt,
    },
  );
  writeStore(store);
  return engagement;
}

export function listMessages(engagementId: string, channel?: CrmMessageChannel): CrmMessage[] {
  return getSnapshot()
    .messages.filter(
      (m) => m.engagementId === engagementId && (channel == null || m.channel === channel),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listPinnedMessages(engagementId: string): CrmMessage[] {
  return getSnapshot()
    .messages.filter((m) => m.engagementId === engagementId && m.pinned)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listTasks(engagementId: string): CrmTask[] {
  return getSnapshot()
    .tasks.filter((t) => t.engagementId === engagementId)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return (a.dueAt ?? "").localeCompare(b.dueAt ?? "");
    });
}

export function listDocuments(engagementId: string): CrmApplicationDocument[] {
  return getSnapshot()
    .documents.filter((d) => d.engagementId === engagementId)
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

export function listFiles(engagementId: string): CrmStoredFile[] {
  return getSnapshot()
    .files.filter((f) => f.engagementId === engagementId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function addMessage(input: {
  engagementId: string;
  authorRole: CrmMessageRole;
  authorLabel: string;
  body: string;
  channel?: CrmMessageChannel;
  pinned?: boolean;
  readByStudent?: boolean;
}): CrmMessage {
  const message = normalizeMessage({
    id: id(),
    engagementId: input.engagementId,
    authorRole: input.authorRole,
    authorLabel: input.authorLabel,
    body: input.body.trim(),
    channel: input.channel ?? "direct",
    pinned: input.pinned ?? false,
    createdAt: nowIso(),
    readByStudent: input.readByStudent,
  });
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseAddMessage(input));
    return message;
  }
  const store = readStore();
  store.messages.push(message);
  const engagement = store.engagements.find((e) => e.id === input.engagementId);
  if (engagement) engagement.updatedAt = message.createdAt;
  writeStore(store);
  notifyCrmStoreChange();
  return message;
}

export function toggleMessagePin(messageId: string): boolean {
  const snapshot = getSnapshot();
  const message = snapshot.messages.find((m) => m.id === messageId);
  if (!message) return false;
  const nextPinned = !message.pinned;
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseToggleMessagePin(messageId, nextPinned));
    return nextPinned;
  }
  const store = readStore();
  const localMessage = store.messages.find((m) => m.id === messageId);
  if (!localMessage) return false;
  localMessage.pinned = nextPinned;
  writeStore(store);
  notifyCrmStoreChange();
  return nextPinned;
}

export function addStoredFile(input: {
  engagementId: string;
  name: string;
  category: string;
  note?: string;
}): CrmStoredFile {
  const file: CrmStoredFile = {
    id: id(),
    engagementId: input.engagementId,
    name: input.name.trim(),
    category: input.category.trim() || "general",
    uploadedAt: nowIso(),
    note: input.note,
  };
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseAddStoredFile(input));
    return file;
  }
  const store = readStore();
  store.files.push(file);
  const engagement = store.engagements.find((e) => e.id === input.engagementId);
  if (engagement) engagement.updatedAt = file.uploadedAt;
  writeStore(store);
  notifyCrmStoreChange();
  return file;
}

export function addDocument(input: {
  engagementId: string;
  name: string;
  docType: string;
  status?: CrmApplicationDocument["status"];
  dueAt?: string;
  note?: string;
}): CrmApplicationDocument {
  const doc: CrmApplicationDocument = {
    id: id(),
    engagementId: input.engagementId,
    name: input.name.trim(),
    docType: input.docType.trim() || "general",
    status: input.status ?? "needed",
    dueAt: input.dueAt,
    note: input.note,
  };
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseAddDocument(input));
    return doc;
  }
  const store = readStore();
  store.documents.push(doc);
  const engagement = store.engagements.find((e) => e.id === input.engagementId);
  if (engagement) engagement.updatedAt = nowIso();
  writeStore(store);
  notifyCrmStoreChange();
  return doc;
}

export function updateDocumentStatus(documentId: string, status: CrmApplicationDocument["status"]): void {
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseUpdateDocumentStatus(documentId, status));
    return;
  }
  const store = readStore();
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return;
  doc.status = status;
  const engagement = store.engagements.find((e) => e.id === doc.engagementId);
  if (engagement) engagement.updatedAt = nowIso();
  writeStore(store);
  notifyCrmStoreChange();
}

export function updateNextMeetingLabel(engagementId: string, label: string): void {
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseUpdateNextMeetingLabel(engagementId, label));
    return;
  }
  const store = readStore();
  const engagement = store.engagements.find((e) => e.id === engagementId);
  if (!engagement) return;
  engagement.nextMeetingLabel = label.trim() || undefined;
  engagement.updatedAt = nowIso();
  writeStore(store);
  notifyCrmStoreChange();
}

export function addTask(input: {
  engagementId: string;
  title: string;
  dueAt?: string;
  linkType: CrmTaskLinkType;
}): CrmTask {
  const createdAt = nowIso();
  const task: CrmTask = {
    id: id(),
    engagementId: input.engagementId,
    title: input.title.trim(),
    dueAt: input.dueAt,
    status: "open",
    linkType: input.linkType,
    createdAt,
  };
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseAddTask(input));
    return task;
  }
  const store = readStore();
  store.tasks.push(task);
  const engagement = store.engagements.find((e) => e.id === input.engagementId);
  if (engagement) engagement.updatedAt = createdAt;
  writeStore(store);
  notifyCrmStoreChange();
  return task;
}

export function setTaskDone(taskId: string, done: boolean): void {
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseSetTaskDone(taskId, done));
    return;
  }
  const store = readStore();
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.status = done ? "done" : "open";
  task.completedAt = done ? nowIso() : undefined;
  const engagement = store.engagements.find((e) => e.id === task.engagementId);
  if (engagement) engagement.updatedAt = nowIso();
  writeStore(store);
  notifyCrmStoreChange();
}

export function toggleFollowUp(engagementId: string): boolean {
  const engagement = getSnapshot().engagements.find((e) => e.id === engagementId);
  if (!engagement) return false;
  const next = !engagement.needsFollowUp;
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseToggleFollowUp(engagementId, next));
    return next;
  }
  const store = readStore();
  const localEngagement = store.engagements.find((e) => e.id === engagementId);
  if (!localEngagement) return false;
  localEngagement.needsFollowUp = next;
  localEngagement.updatedAt = nowIso();
  writeStore(store);
  notifyCrmStoreChange();
  return next;
}

export function updateInternalNotes(engagementId: string, notes: string): void {
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseUpdateInternalNotes(engagementId, notes));
    return;
  }
  const store = readStore();
  const engagement = store.engagements.find((e) => e.id === engagementId);
  if (!engagement) return;
  engagement.internalNotes = notes;
  engagement.updatedAt = nowIso();
  writeStore(store);
  notifyCrmStoreChange();
}

export function setEngagementPhase(engagementId: string, phase: CrmPhase): void {
  if (crmBackend === "supabase") {
    // not exposed in UI yet
    return;
  }
  const store = readStore();
  const engagement = store.engagements.find((e) => e.id === engagementId);
  if (!engagement) return;
  engagement.phase = phase;
  engagement.updatedAt = nowIso();
  writeStore(store);
  notifyCrmStoreChange();
}

export function markMessagesReadByStudent(engagementId: string): void {
  if (crmBackend === "supabase") {
    afterMutation(() => supabaseMarkMessagesReadByStudent(engagementId));
    return;
  }
  const store = readStore();
  let changed = false;
  for (const message of store.messages) {
    if (message.engagementId === engagementId && message.authorRole === "counselor" && !message.readByStudent) {
      message.readByStudent = true;
      changed = true;
    }
  }
  if (changed) {
    writeStore(store);
    notifyCrmStoreChange();
  }
}

export function countUnreadCounselorMessages(engagementId: string): number {
  return getSnapshot().messages.filter(
    (m) => m.engagementId === engagementId && m.authorRole === "counselor" && !m.readByStudent,
  ).length;
}

export function countOpenTasks(engagementId: string): number {
  return getSnapshot().tasks.filter((t) => t.engagementId === engagementId && t.status === "open").length;
}

export function subscribeCrmStore(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("onlyapply-crm-change", listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("onlyapply-crm-change", listener);
  };
}

export function notifyCrmStoreChange() {
  window.dispatchEvent(new Event("onlyapply-crm-change"));
}

function envFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/** Production: set VITE_ENABLE_SIGNED_SERVICE=true on Vercel. */
export function isSignedServiceEnabled(): boolean {
  return (
    import.meta.env.DEV ||
    envFlag(import.meta.env.VITE_ENABLE_SIGNED_SERVICE) ||
    envFlag(import.meta.env.VITE_CRM_DEMO)
  );
}

/** Demo bar + localStorage fallback — dev or VITE_CRM_DEMO only. */
export function isCrmDemoUiEnabled(): boolean {
  return import.meta.env.DEV || envFlag(import.meta.env.VITE_CRM_DEMO);
}
