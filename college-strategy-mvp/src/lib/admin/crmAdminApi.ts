import { apiUrl } from "../apiBase";

export type AdminCounselor = {
  id: string;
  userId: string | null;
  name: string;
  title: string;
  bio: string | null;
  email: string | null;
  calendlyUrl: string | null;
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
  input: { email: string; name: string; title: string; password: string; calendlyUrl?: string },
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

export function adminErrorMessage(code: string | undefined, t: (key: string) => string): string {
  if (!code) return t("admin.errors.generic");
  const key = `admin.errors.${code}`;
  const msg = t(key);
  return msg === key ? t("admin.errors.generic") : msg;
}
