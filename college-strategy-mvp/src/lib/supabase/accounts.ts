import type { Locale } from "../../i18n/strings";
import type { FormState, ReportPayload, SupplementaryNote } from "../../types";
import { getEffectiveIntake } from "../intakeTerm";
import { getSupabase } from "./client";

export type SavedApplicationRow = {
  id: string;
  user_id: string;
  title: string;
  form_state: FormState;
  locale: Locale;
  created_at: string;
  updated_at: string;
};

export type SavedReportRow = {
  id: string;
  user_id: string;
  application_id: string;
  report_payload: ReportPayload;
  supplementary_notes: SupplementaryNote[] | null;
  report_unlocked: boolean;
  created_at: string;
};

export type ApplicationListItem = SavedApplicationRow & {
  latest_report_at: string | null;
  report_count: number;
};

export type EssayDraftRow = {
  id: string;
  user_id: string;
  application_id: string;
  report_id: string;
  draft_text: string;
  created_at: string;
  updated_at: string;
};

export type EssayAnalysisPayload = {
  verdict: string;
  checks: { label: string; ok: boolean; detail: string }[];
  issues?: string[];
  nextRevision: string;
  rewriteExample?: {
    before: string;
    after: string;
  };
  id?: string;
  created_at?: string;
};

export type EssayAnalysisRow = {
  id: string;
  user_id: string;
  application_id: string;
  report_id: string;
  draft_text: string;
  analysis_payload: EssayAnalysisPayload;
  created_at: string;
};

function defaultTitle(form: FormState, locale: Locale): string {
  const intake = getEffectiveIntake(form) || (locale === "en" ? "Application" : "申请");
  const d = new Date();
  const date = locale === "en" ? d.toLocaleDateString("en-US") : d.toLocaleDateString("zh-CN");
  return locale === "en" ? `${intake} · ${date}` : `${intake} · ${date}`;
}

export async function listApplications(): Promise<ApplicationListItem[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data: apps, error } = await sb
    .from("saved_applications")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!apps?.length) return [];

  const { data: reports, error: rErr } = await sb
    .from("saved_reports")
    .select("application_id, created_at")
    .order("created_at", { ascending: false });

  if (rErr) throw rErr;

  const byApp = new Map<string, { count: number; latest: string | null }>();
  for (const r of reports ?? []) {
    const cur = byApp.get(r.application_id) ?? { count: 0, latest: null };
    cur.count += 1;
    if (!cur.latest) cur.latest = r.created_at;
    byApp.set(r.application_id, cur);
  }

  return (apps as SavedApplicationRow[]).map((a) => {
    const meta = byApp.get(a.id) ?? { count: 0, latest: null };
    return {
      ...a,
      form_state: a.form_state as FormState,
      locale: a.locale as Locale,
      report_count: meta.count,
      latest_report_at: meta.latest,
    };
  });
}

export async function getApplicationReports(applicationId: string): Promise<{
  application: SavedApplicationRow;
  reports: SavedReportRow[];
}> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data: application, error } = await sb
    .from("saved_applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (error) throw error;

  const { data: reports, error: rErr } = await sb
    .from("saved_reports")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (rErr) throw rErr;

  return {
    application: {
      ...(application as SavedApplicationRow),
      form_state: application.form_state as FormState,
      locale: application.locale as Locale,
    },
    reports: (reports ?? []).map((r) => ({
      ...(r as SavedReportRow),
      report_payload: r.report_payload as ReportPayload,
      supplementary_notes: (r.supplementary_notes as SupplementaryNote[] | null) ?? null,
    })),
  };
}

export type SaveSessionInput = {
  applicationId?: string | null;
  form: FormState;
  locale: Locale;
  report: ReportPayload;
  supplementaryNotes?: SupplementaryNote[];
  /** 已废弃：服务端触发器禁止客户端写解锁；Stripe Webhook + 权益表为准 */
  reportUnlocked?: boolean;
  title?: string;
};

export async function saveUserSession(input: SaveSessionInput): Promise<{ applicationId: string; reportId: string }> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const now = new Date().toISOString();
  let applicationId = input.applicationId ?? null;

  if (applicationId) {
    const { error } = await sb
      .from("saved_applications")
      .update({
        form_state: input.form,
        locale: input.locale,
        updated_at: now,
        ...(input.title ? { title: input.title } : {}),
      })
      .eq("id", applicationId)
      .eq("user_id", user.id);

    if (error) throw error;
  } else {
    const { data, error } = await sb
      .from("saved_applications")
      .insert({
        user_id: user.id,
        title: input.title ?? defaultTitle(input.form, input.locale),
        form_state: input.form,
        locale: input.locale,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) throw error;
    applicationId = data.id;
  }

  const { data: reportRow, error: rErr } = await sb
    .from("saved_reports")
    .insert({
      user_id: user.id,
      application_id: applicationId,
      report_payload: input.report,
      supplementary_notes: input.supplementaryNotes?.length ? input.supplementaryNotes : null,
      report_unlocked: false,
    })
    .select("id")
    .single();

  if (rErr) throw rErr;
  if (!applicationId) throw new Error("Failed to save application");

  return { applicationId, reportId: reportRow.id };
}

/** 返回当前用户已解锁的 application id 列表（Stripe 或邀请码等，以权益表为准） */
export async function fetchUnlockedApplicationIds(): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.from("application_unlock_entitlements").select("application_id");
  if (error) throw error;

  const ids = [...new Set((data ?? []).map((r) => r.application_id as string))];
  return ids;
}

/** 返回当前用户已解锁文书分析的 report id 列表（per-session 或未来订阅均由 SQL 权益表提供） */
export async function fetchEssayAnalysisReportIds(): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("essay_analysis_entitlements")
    .select("report_id")
    .eq("entitlement_kind", "per_session");
  if (error) throw error;

  return [...new Set((data ?? []).map((r) => r.report_id as string).filter(Boolean))];
}

export type RedeemInviteOutcome =
  | { ok: true; already?: boolean }
  | { ok: false; error: string };

/** 需在 SQL 侧创建 redeem_invite_code；见 supabase/schema-invite-codes-v1.sql */
export async function redeemInviteCode(code: string, applicationId: string): Promise<RedeemInviteOutcome> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb.rpc("redeem_invite_code", {
    p_code: code,
    p_application_id: applicationId,
  });

  if (error) throw error;

  const row = data as Record<string, unknown> | null;
  if (!row || typeof row !== "object") {
    return { ok: false, error: "bad_response" };
  }
  if (row.ok === true) {
    return { ok: true, already: Boolean(row.already) };
  }
  const errCode = typeof row.error === "string" ? row.error : "unknown";
  return { ok: false, error: errCode };
}

/** 需在 SQL 侧创建 redeem_essay_analysis_invite_code；见 supabase/schema-essay-analysis-entitlements.sql */
export async function redeemEssayAnalysisInviteCode(
  code: string,
  applicationId: string,
  reportId: string,
): Promise<RedeemInviteOutcome> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data, error } = await sb.rpc("redeem_essay_analysis_invite_code", {
    p_code: code,
    p_application_id: applicationId,
    p_report_id: reportId,
  });

  if (error) throw error;

  const row = data as Record<string, unknown> | null;
  if (!row || typeof row !== "object") {
    return { ok: false, error: "bad_response" };
  }
  if (row.ok === true) {
    return { ok: true, already: Boolean(row.already) };
  }
  const errCode = typeof row.error === "string" ? row.error : "unknown";
  return { ok: false, error: errCode };
}

export async function getEssayWorkspace(reportId: string): Promise<{
  draft: EssayDraftRow | null;
  analyses: EssayAnalysisRow[];
}> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { data: draft, error: dErr } = await sb
    .from("essay_drafts")
    .select("*")
    .eq("report_id", reportId)
    .maybeSingle();
  if (dErr) throw dErr;

  const { data: analyses, error: aErr } = await sb
    .from("essay_analyses")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(6);
  if (aErr) throw aErr;

  return {
    draft: draft ? (draft as EssayDraftRow) : null,
    analyses: (analyses ?? []).map((row) => ({
      ...(row as EssayAnalysisRow),
      analysis_payload: (row as EssayAnalysisRow).analysis_payload as EssayAnalysisPayload,
    })),
  };
}

export async function upsertEssayDraft(input: {
  applicationId: string;
  reportId: string;
  draftText: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await sb.from("essay_drafts").upsert(
    {
      user_id: user.id,
      application_id: input.applicationId,
      report_id: input.reportId,
      draft_text: input.draftText,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,report_id" },
  );
  if (error) throw error;
}

export async function deleteApplication(applicationId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("saved_applications").delete().eq("id", applicationId);
  if (error) throw error;
}
