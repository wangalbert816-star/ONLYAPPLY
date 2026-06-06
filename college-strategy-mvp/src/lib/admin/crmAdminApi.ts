import { apiUrl } from "../apiBase";
import type { ApplicationLinkCategoryId, ApplicationLinkBadge } from "../../components/applicationLinks";

export type AdminCounselor = {
  id: string;
  userId: string | null;
  name: string;
  title: string;
  bio: string | null;
  email: string | null;
  calendlyUrl: string | null;
  meetingUrl: string | null;
  active: boolean;
  createdAt: string;
  studentCount: number;
};

export type AdminEngagement = {
  id: string;
  studentUserId: string;
  studentEmail: string;
  studentName: string | null;
  applicationId: string;
  applicationTitle: string;
  counselorId: string;
  counselorName: string | null;
  counselorEmail: string | null;
  counselorIds: string[];
  counselorNames: string[];
  counselorEmails: string[];
  status: string;
  phase: string;
  planLabel: string | null;
  nextMeetingLabel: string | null;
  needsFollowUp: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudentLookupApplication = {
  id: string;
  title: string;
  locale: string;
  updatedAt: string;
  createdAt: string;
};

export type StudentLookupResult = {
  found: boolean;
  email: string;
  userId?: string;
  message?: string;
  applications: StudentLookupApplication[];
};

export type AdminCaseMessage = {
  id: string;
  engagementId: string;
  authorRole: "student" | "counselor" | "system" | "admin";
  authorLabel: string;
  body: string;
  channel: "direct" | "group";
  pinned: boolean;
  createdAt: string;
  readByStudent: boolean;
};

export type AdminLibraryItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  locale: "zh" | "en" | "all";
  itemKind: "file" | "link";
  fileName: string | null;
  storagePath: string | null;
  externalUrl: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

async function adminFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const raw = await res.text();
  let body: T & { error?: string } = {} as T & { error?: string };
  try {
    body = raw ? (JSON.parse(raw) as T & { error?: string }) : ({} as T & { error?: string });
  } catch {
    body = {
      error: res.status === 404 ? "api_route_missing" : "request_failed",
    } as T & { error?: string };
  }
  if (!res.ok) {
    const err = new Error(body.error || res.statusText || "request_failed");
    (err as Error & { code?: string }).code = body.error || (res.status === 404 ? "api_route_missing" : undefined);
    throw err;
  }
  return body;
}

export async function fetchAdminSession(accessToken: string): Promise<{ ok: true; email: string }> {
  return adminFetch("/api/admin/crm/session", accessToken);
}

export async function listAdminCounselors(accessToken: string): Promise<{ counselors: AdminCounselor[] }> {
  return adminFetch("/api/admin/crm/counselors", accessToken);
}

export async function createAdminCounselor(
  accessToken: string,
  input: {
    email: string;
    name: string;
    title: string;
    password: string;
    calendlyUrl?: string;
    meetingUrl?: string;
  },
): Promise<{ counselor: AdminCounselor; authLinked: boolean }> {
  return adminFetch("/api/admin/crm/counselors", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function patchAdminCounselor(
  accessToken: string,
  id: string,
  patch: Partial<{
    name: string;
    title: string;
    email: string;
    calendlyUrl: string;
    meetingUrl: string;
    active: boolean;
    linkAuth: boolean;
    password: string;
  }>,
): Promise<{ counselor: AdminCounselor }> {
  return adminFetch(`/api/admin/crm/counselors/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function listAdminEngagements(accessToken: string): Promise<{ engagements: AdminEngagement[] }> {
  return adminFetch("/api/admin/crm/engagements", accessToken);
}

export async function lookupAdminStudent(
  accessToken: string,
  email: string,
): Promise<StudentLookupResult> {
  const q = encodeURIComponent(email.trim());
  return adminFetch(`/api/admin/crm/students/lookup?email=${q}`, accessToken);
}

export async function createAdminEngagement(
  accessToken: string,
  input: {
    studentEmail: string;
    counselorId: string;
    applicationId?: string | null;
    createPlaceholderApplication?: boolean;
    placeholderLocale?: "en" | "zh";
    phase?: string;
    planLabel?: string;
    nextMeetingLabel?: string;
  },
): Promise<{ engagement: AdminEngagement }> {
  return adminFetch("/api/admin/crm/engagements", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function patchAdminEngagement(
  accessToken: string,
  id: string,
  patch: Partial<{
    counselorId: string;
    addCounselorId: string;
    removeCounselorId: string;
    status: string;
    phase: string;
    planLabel: string;
    nextMeetingLabel: string;
  }>,
): Promise<{ engagement: AdminEngagement }> {
  return adminFetch(`/api/admin/crm/engagements/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function listAdminGroupMessages(
  accessToken: string,
  engagementId: string,
): Promise<{ messages: AdminCaseMessage[] }> {
  return adminFetch(`/api/admin/crm/engagements/${engagementId}/messages`, accessToken);
}

export async function sendAdminGroupMessage(
  accessToken: string,
  engagementId: string,
  body: string,
): Promise<{ message: AdminCaseMessage }> {
  return adminFetch(`/api/admin/crm/engagements/${engagementId}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function listAdminLibraryItems(accessToken: string): Promise<{ items: AdminLibraryItem[] }> {
  return adminFetch("/api/admin/crm/library", accessToken);
}

export async function prepareAdminLibraryUpload(
  accessToken: string,
  input: {
    title: string;
    description?: string;
    category: string;
    locale: "zh" | "en" | "all";
    fileName: string;
    contentType?: string;
    sizeBytes: number;
  },
): Promise<{ item: AdminLibraryItem; uploadUrl: string; uploadToken: string }> {
  return adminFetch("/api/admin/crm/library/prepare-upload", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createAdminLibraryLink(
  accessToken: string,
  input: {
    title: string;
    description?: string;
    category: string;
    locale: "zh" | "en" | "all";
    externalUrl: string;
  },
): Promise<{ item: AdminLibraryItem }> {
  return adminFetch("/api/admin/crm/library/link", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function patchAdminLibraryItem(
  accessToken: string,
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    category: string;
    locale: "zh" | "en" | "all";
    active: boolean;
    sortOrder: number;
  }>,
): Promise<{ item: AdminLibraryItem }> {
  return adminFetch(`/api/admin/crm/library/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteAdminLibraryItem(accessToken: string, id: string): Promise<{ ok: true }> {
  return adminFetch(`/api/admin/crm/library/${id}`, accessToken, { method: "DELETE" });
}

export type AdminRoadmapPost = {
  id: string;
  categoryId: ApplicationLinkCategoryId;
  href: string | null;
  coverImageUrl: string | null;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  badge?: ApplicationLinkBadge;
  published: boolean;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listAdminRoadmapPosts(accessToken: string): Promise<{ posts: AdminRoadmapPost[] }> {
  return adminFetch("/api/admin/crm/roadmap/posts", accessToken);
}

export async function createAdminRoadmapPost(
  accessToken: string,
  input: {
    categoryId: ApplicationLinkCategoryId;
    href?: string | null;
    coverImageUrl?: string | null;
    titleZh: string;
    titleEn: string;
    descriptionZh?: string;
    descriptionEn?: string;
    badge?: ApplicationLinkBadge | null;
    published?: boolean;
    sortOrder?: number;
  },
): Promise<{ post: AdminRoadmapPost }> {
  return adminFetch("/api/admin/crm/roadmap/posts", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function patchAdminRoadmapPost(
  accessToken: string,
  id: string,
  patch: Partial<{
    categoryId: ApplicationLinkCategoryId;
    href: string | null;
    coverImageUrl: string | null;
    titleZh: string;
    titleEn: string;
    descriptionZh: string;
    descriptionEn: string;
    badge: ApplicationLinkBadge | null;
    published: boolean;
    sortOrder: number;
  }>,
): Promise<{ post: AdminRoadmapPost }> {
  return adminFetch(`/api/admin/crm/roadmap/posts/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteAdminRoadmapPost(accessToken: string, id: string): Promise<{ ok: true }> {
  return adminFetch(`/api/admin/crm/roadmap/posts/${id}`, accessToken, { method: "DELETE" });
}

const ROADMAP_COVER_MAX_BYTES = 3 * 1024 * 1024;

export async function prepareAdminRoadmapCoverUpload(
  accessToken: string,
  input: { fileName: string; contentType?: string; sizeBytes: number },
): Promise<{ uploadUrl: string; uploadToken: string; storagePath: string; publicUrl: string }> {
  return adminFetch("/api/admin/crm/roadmap/cover/prepare-upload", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadAdminRoadmapCover(accessToken: string, file: File): Promise<string> {
  if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type || "")) {
    const err = new Error("roadmap_cover_type_invalid");
    throw err;
  }
  if (file.size > ROADMAP_COVER_MAX_BYTES) {
    const err = new Error("roadmap_cover_too_large");
    throw err;
  }
  const { uploadUrl, publicUrl } = await prepareAdminRoadmapCoverUpload(accessToken, {
    fileName: file.name,
    contentType: file.type || undefined,
    sizeBytes: file.size,
  });
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) {
    const err = new Error("roadmap_cover_upload_failed");
    throw err;
  }
  return publicUrl;
}

export type EvalExpectedSchool = { school: string; note?: string };

export type AdminEvalCase = {
  id: string;
  caseKey: string;
  title: string;
  titleEn?: string | null;
  tags: string[];
  locale: "zh" | "en";
  reportBody: Record<string, unknown>;
  reportBodyEn?: Record<string, unknown> | null;
  expectedReach: EvalExpectedSchool[];
  expectedMatch: EvalExpectedSchool[];
  expectedSafety: EvalExpectedSchool[];
  forbiddenSchools: string[];
  notes: string | null;
  notesEn?: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminEvalRun = {
  id: string;
  label: string;
  promptVersion: string | null;
  rubricVersion: string | null;
  reportTemplateVersion: string | null;
  status: "pending" | "running" | "completed" | "failed";
  caseCount: number;
  okCount: number;
  errorCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminEvalReview = {
  id: string;
  runId: string;
  caseId: string;
  status: "draft" | "submitted" | "approved";
  rubricVersion: string;
  rubricScores: Record<string, { score: number | null; notes?: string | null }>;
  schoolReviews: Array<{
    school: string;
    aiTier: "reach" | "match" | "safety" | null;
    counselorTier: "reach" | "match" | "safety" | null;
    action: "agree" | "adjust" | "reject";
    reason: string | null;
    evidence: string | null;
  }>;
  profileDimensionReviews: Array<{
    key: string;
    label: string;
    aiScore: number | null;
    counselorScore: number | null;
    reason: string | null;
    reasonCategory: string | null;
  }>;
  finalApprovedRecommendation: {
    reach: string[];
    match: string[];
    safety: string[];
    notes: string | null;
  };
  overallNotes: string | null;
  reviewedBy: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminEvalRunResult = {
  id: string;
  runId: string;
  caseId: string;
  status: "pending" | "running" | "ok" | "error";
  reportPayload: Record<string, unknown> | null;
  error: string | null;
  llmMs: number | null;
  provider: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  case: AdminEvalCase | null;
  score: AdminEvalScore | null;
  review: AdminEvalReview | null;
};

export type AdminEvalScore = {
  id: string;
  runId: string;
  caseId: string;
  scoreTier: number | null;
  scorePersonalization: number | null;
  scoreFacts: number | null;
  scoreConsistency: number | null;
  scoreActionable: number | null;
  notes: string | null;
  errorTags: string[];
  scoredBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listAdminEvalCases(accessToken: string): Promise<{ cases: AdminEvalCase[] }> {
  return adminFetch("/api/admin/crm/eval/cases", accessToken);
}

export async function createAdminEvalCase(
  accessToken: string,
  input: Record<string, unknown>,
): Promise<{ case: AdminEvalCase }> {
  return adminFetch("/api/admin/crm/eval/cases", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function importAdminEvalCases(
  accessToken: string,
  cases: Record<string, unknown>[],
): Promise<{ imported: number; failed: { caseKey: string; error: string }[]; cases: AdminEvalCase[] }> {
  return adminFetch("/api/admin/crm/eval/cases/import", accessToken, {
    method: "POST",
    body: JSON.stringify({ cases }),
  });
}

export async function patchAdminEvalCase(
  accessToken: string,
  id: string,
  input: Record<string, unknown>,
): Promise<{ case: AdminEvalCase }> {
  return adminFetch(`/api/admin/crm/eval/cases/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminEvalCase(accessToken: string, id: string): Promise<{ ok: true }> {
  return adminFetch(`/api/admin/crm/eval/cases/${id}`, accessToken, { method: "DELETE" });
}

export async function listAdminEvalRuns(accessToken: string): Promise<{ runs: AdminEvalRun[] }> {
  return adminFetch("/api/admin/crm/eval/runs", accessToken);
}

export async function createAdminEvalRun(
  accessToken: string,
  input: {
    label: string;
    promptVersion?: string | null;
    rubricVersion?: string | null;
    reportTemplateVersion?: string | null;
    caseIds?: string[];
  },
): Promise<{ run: AdminEvalRun }> {
  return adminFetch("/api/admin/crm/eval/runs", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchAdminEvalRun(
  accessToken: string,
  runId: string,
): Promise<{ run: AdminEvalRun; results: AdminEvalRunResult[] }> {
  return adminFetch(`/api/admin/crm/eval/runs/${runId}`, accessToken);
}

export async function generateAdminEvalRunCase(
  accessToken: string,
  runId: string,
  caseId: string,
): Promise<{ result: AdminEvalRunResult; run: AdminEvalRun | null }> {
  return adminFetch(`/api/admin/crm/eval/runs/${runId}/generate/${caseId}`, accessToken, {
    method: "POST",
  });
}

export async function fetchAdminEvalFeedbackExport(
  accessToken: string,
): Promise<{ entries: EvalFeedbackExportEntry[]; caseCount: number }> {
  return adminFetch("/api/admin/crm/eval/feedback/export", accessToken);
}

export type EvalFeedbackExportEntry = {
  case: AdminEvalCase;
  run: AdminEvalRun;
  result: AdminEvalRunResult;
  score: AdminEvalScore;
};

export async function saveAdminEvalReview(
  accessToken: string,
  runId: string,
  caseId: string,
  input: Record<string, unknown>,
): Promise<{ review: AdminEvalReview }> {
  return adminFetch(`/api/admin/crm/eval/runs/${runId}/reviews/${caseId}`, accessToken, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export type AdminEvalDashboard = {
  reviewedCount: number;
  draftCount: number;
  averageReportScore: number | null;
  dimensionAverages: Record<string, number | null>;
  correctionCategoryCounts: Record<string, number>;
  adjustedProfileCounts: Record<string, number>;
  schoolTierAccuracyRate: number | null;
  schoolReviewCount: number;
  byPromptVersion: Array<{
    promptVersion: string;
    reviewCount: number;
    averageReportScore: number | null;
  }>;
  activeCaseCount: number;
  versions: {
    promptVersion: string;
    rubricVersion: string;
    reportTemplateVersion: string;
  };
};

export async function fetchAdminEvalDashboard(accessToken: string): Promise<AdminEvalDashboard> {
  return adminFetch("/api/admin/crm/eval/dashboard", accessToken);
}

export async function downloadAdminEvalExport(
  accessToken: string,
  kind: "json" | "csv" | "summary",
): Promise<{ blob: Blob; filename: string }> {
  const base = "/api/admin/crm/eval/export";
  const path = kind === "json" ? `${base}/json` : kind === "csv" ? `${base}/csv` : `${base}/summary`;
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "export_failed");
  }
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === "json") {
    const data = await res.json();
    return {
      blob: new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      filename: `onlyapply-eval-cases-${stamp}.json`,
    };
  }
  const text = await res.text();
  const ext = kind === "csv" ? "csv" : "txt";
  const name = kind === "csv" ? `onlyapply-corrections-${stamp}.${ext}` : `onlyapply-eval-summary-${stamp}.${ext}`;
  return { blob: new Blob([text], { type: "text/plain;charset=utf-8" }), filename: name };
}

export async function saveAdminEvalScore(
  accessToken: string,
  runId: string,
  caseId: string,
  input: {
    scoreTier?: number | null;
    scorePersonalization?: number | null;
    scoreFacts?: number | null;
    scoreConsistency?: number | null;
    scoreActionable?: number | null;
    notes?: string | null;
    errorTags?: string[];
  },
): Promise<{ score: AdminEvalScore }> {
  return adminFetch(`/api/admin/crm/eval/runs/${runId}/scores/${caseId}`, accessToken, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function adminErrorMessage(code: string | undefined, t: (key: string) => string): string {
  if (!code) return t("admin.errors.generic");
  const key = `admin.errors.${code}`;
  const msg = t(key);
  return msg === key ? t("admin.errors.generic") : msg;
}
