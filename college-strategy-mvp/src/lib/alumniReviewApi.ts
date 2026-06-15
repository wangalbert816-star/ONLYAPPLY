import { apiUrl } from "./apiBase";
import { parseApiError } from "./apiError";
import type { FormState, ReportPayload } from "../types";
import type { EvalReviewDraft } from "./admin/evalRubric";
import { draftToReviewPayload } from "./admin/evalReviewState";
import { getSupabase } from "./supabase/client";

export type AlumniReportReview = {
  id: string;
  userId: string;
  applicationId: string | null;
  reportId: string | null;
  intakeTerm: string | null;
  locale: "zh" | "en";
  status: EvalReviewDraft["status"];
  rubricVersion: string;
  rubricScores: Record<string, { score: number | null; notes: string | null }>;
  schoolReviews: Array<{
    school: string;
    aiTier: string | null;
    counselorTier: string | null;
    action: string;
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
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function authFetch(path: string, init?: RequestInit) {
  const sb = getSupabase();
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  const token = session?.access_token;
  if (!token) throw new Error("auth_required");

  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code, message } = parseApiError(data, res.statusText);
    const err = new Error(message);
    (err as Error & { code?: string | null }).code = code;
    throw err;
  }
  return data;
}

export async function fetchAlumniReportReview(
  reportId: string,
): Promise<{ reviews: AlumniReportReview[] }> {
  const q = reportId ? `?reportId=${encodeURIComponent(reportId)}` : "";
  return authFetch(`/api/alumni/report-reviews/mine${q}`);
}

export async function saveAlumniReportReview(input: {
  id?: string | null;
  draft: EvalReviewDraft;
  reportId?: string | null;
  applicationId?: string | null;
  reportSnapshot?: ReportPayload;
  formSnapshot?: FormState;
  intakeTerm?: string | null;
  locale: "zh" | "en";
}): Promise<{ review: AlumniReportReview }> {
  const includeSnapshots = !input.id;
  return authFetch("/api/alumni/report-reviews", {
    method: "PUT",
    body: JSON.stringify({
      id: input.id ?? undefined,
      reportId: input.reportId ?? undefined,
      applicationId: input.applicationId ?? undefined,
      ...(includeSnapshots
        ? { reportSnapshot: input.reportSnapshot, formSnapshot: input.formSnapshot }
        : {}),
      intakeTerm: input.intakeTerm ?? undefined,
      locale: input.locale,
      ...draftToReviewPayload(input.draft),
    }),
  });
}
