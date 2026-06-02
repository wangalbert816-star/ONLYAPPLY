import { apiUrl } from "../apiBase";
import { getSupabase, isSupabaseConfigured } from "../supabase/client";
import { migrateResumeDraft } from "./resumeForm";
import type { ResumeFormData } from "./types";

export function isResumeServerSyncEnabled(): boolean {
  return isSupabaseConfigured();
}

export async function fetchResumeDraftFromServer(engagementId: string): Promise<ResumeFormData | null> {
  const sb = getSupabase();
  if (!sb || !engagementId) return null;

  const { data, error } = await sb
    .from("engagements")
    .select("resume_draft")
    .eq("id", engagementId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.resume_draft) return null;
  return migrateResumeDraft(data.resume_draft);
}

export async function saveResumeDraftToServer(engagementId: string, draft: ResumeFormData): Promise<void> {
  const sb = getSupabase();
  if (!sb || !engagementId) return;

  const { error } = await sb
    .from("engagements")
    .update({
      resume_draft: draft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", engagementId);
  if (error) throw error;
}

async function counselorAuthHeaders(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) throw new Error("supabase_not_configured");
  const {
    data: { session },
  } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("auth_required");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchResumeDraftForCounselor(engagementId: string): Promise<ResumeFormData | null> {
  const headers = await counselorAuthHeaders();
  const res = await fetch(apiUrl(`/api/counselor/crm/engagements/${encodeURIComponent(engagementId)}/resume`), {
    headers,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `resume_fetch_failed_${res.status}`);
  }
  const body = (await res.json()) as { resume?: unknown };
  if (!body.resume) return null;
  return migrateResumeDraft(body.resume);
}

export async function saveResumeDraftForCounselor(engagementId: string, draft: ResumeFormData): Promise<void> {
  const headers = await counselorAuthHeaders();
  const res = await fetch(apiUrl(`/api/counselor/crm/engagements/${encodeURIComponent(engagementId)}/resume`), {
    method: "PUT",
    headers,
    body: JSON.stringify({ resume: draft }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `resume_save_failed_${res.status}`);
  }
}

export async function loadRemoteResumeDraft(
  engagementId: string,
  role: "student" | "counselor",
): Promise<ResumeFormData | null> {
  if (!isResumeServerSyncEnabled()) return null;
  return role === "counselor"
    ? fetchResumeDraftForCounselor(engagementId)
    : fetchResumeDraftFromServer(engagementId);
}

export async function saveRemoteResumeDraft(
  engagementId: string,
  draft: ResumeFormData,
  role: "student" | "counselor",
): Promise<void> {
  if (!isResumeServerSyncEnabled()) return;
  if (role === "counselor") {
    await saveResumeDraftForCounselor(engagementId, draft);
    return;
  }
  await saveResumeDraftToServer(engagementId, draft);
}
