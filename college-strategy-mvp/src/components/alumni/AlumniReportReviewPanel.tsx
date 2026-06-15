import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "../../i18n/strings";
import { useLanguage } from "../../i18n/LanguageContext";
import type { FormState, ReportPayload } from "../../types";
import type { ProfileDimensionKey } from "../../lib/fiveDimensionProfile";
import { AdminEvalReviewForm } from "../admin/eval/AdminEvalReviewForm";
import {
  alumniReviewToDraft,
  buildInitialAlumniReviewDraft,
  draftToReviewPayload,
} from "../../lib/admin/evalReviewState";
import type { EvalReviewDraft } from "../../lib/admin/evalRubric";
import type { AdminEvalCase, AdminEvalRun, AdminEvalRunResult } from "../../lib/admin/crmAdminApi";
import { buildReportApiBody } from "../../lib/reportApiBody";
import { fetchAlumniReportReview, saveAlumniReportReview, type AlumniReportReview } from "../../lib/alumniReviewApi";
import { isUnreadableApiMessage } from "../../lib/apiError";
import { getEffectiveIntake } from "../../lib/intakeTerm";
import "./AlumniReportReviewPanel.css";

type Props = {
  report: ReportPayload;
  form: FormState;
  locale: Locale;
  applicationId: string | null;
  reportId: string | null;
  isAuthenticated: boolean;
  onRequestSignIn: () => void;
};

function shimEvalCase(form: FormState, report: ReportPayload, locale: Locale, title: string): AdminEvalCase {
  const reportBody = buildReportApiBody(form, undefined, locale);
  const tierNames = (rows: ReportPayload["reach"] | undefined) =>
    (rows ?? []).map((r: { school?: string }) => String(r.school ?? "").trim()).filter(Boolean).slice(0, 3);
  return {
    id: "alumni",
    caseKey: "alumni-live",
    title,
    tags: [],
    locale,
    notes: null,
    active: true,
    reportBody,
    expectedReach: tierNames(report.reach).map((school: string) => ({ school })),
    expectedMatch: tierNames(report.match).map((school: string) => ({ school })),
    expectedSafety: tierNames(report.safety).map((school: string) => ({ school })),
    forbiddenSchools: [],
    createdBy: null,
    createdAt: "",
    updatedAt: "",
  };
}

function shimRun(): AdminEvalRun {
  return {
    id: "alumni-live",
    label: "Alumni feedback",
    status: "completed",
    promptVersion: "live",
    rubricVersion: "1.0",
    reportTemplateVersion: "live",
    caseCount: 1,
    okCount: 1,
    errorCount: 0,
    createdBy: null,
    createdAt: "",
    updatedAt: "",
  };
}

function shimResult(report: ReportPayload): AdminEvalRunResult {
  return {
    id: "alumni-live",
    runId: "alumni-live",
    caseId: "alumni-live",
    status: "ok",
    reportPayload: report as unknown as Record<string, unknown>,
    error: null,
    llmMs: null,
    provider: null,
    model: null,
    createdAt: "",
    updatedAt: "",
    case: null,
    score: null,
    review: null,
  };
}

export function AlumniReportReviewPanel({
  report,
  form,
  locale,
  applicationId,
  reportId,
  isAuthenticated,
  onRequestSignIn,
}: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<EvalReviewDraft | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const lastSavedKeyRef = useRef("");

  const profileLabel = useCallback(
    (key: ProfileDimensionKey) => t(`admin.evalHarness.profile.${key}`),
    [t],
  );

  const intakeLabel = getEffectiveIntake(form) || (locale === "en" ? "Past cycle" : "往届申请季");
  const title = t("alumni.review.caseTitle", { intake: intakeLabel });

  const formatSaveError = useCallback(
    (e: unknown) => {
      const code = (e as Error & { code?: string | null }).code ?? null;
      const message = e instanceof Error ? e.message : "";
      if (code === "alumni_review_table_missing") return t("alumni.review.errTableMissing");
      if (code === "auth_required" || code === "invalid_session") return t("alumni.review.errAuthRequired");
      if (code === "alumni_report_snapshot_required") return t("alumni.review.errSnapshotRequired");
      if (code === "supabase_admin_missing") return t("alumni.review.errStorageUnavailable");
      if (!isUnreadableApiMessage(message)) return message;
      return t("alumni.review.errSaveFailed");
    },
    [t],
  );

  useEffect(() => {
    const initial = buildInitialAlumniReviewDraft(form, report, locale, profileLabel);
    setDraft(initial);
    setReviewId(null);
    setSubmitSuccess(false);
    lastSavedKeyRef.current = JSON.stringify(initial);

    if (!isAuthenticated || !reportId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { reviews } = await fetchAlumniReportReview(reportId);
        const row = reviews[0] as AlumniReportReview | undefined;
        if (cancelled || !row) return;
        setReviewId(row.id);
        const hydrated = alumniReviewToDraft(row as Parameters<typeof alumniReviewToDraft>[0], initial);
        setDraft(hydrated);
        lastSavedKeyRef.current = JSON.stringify(hydrated);
        if (row.status === "submitted") setSubmitSuccess(true);
      } catch {
        /* first visit — no saved review */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form, isAuthenticated, locale, profileLabel, report, reportId]);

  const persistReview = useCallback(
    async (status: EvalReviewDraft["status"], options?: { silent?: boolean }) => {
      if (!draft) return false;
      if (!isAuthenticated) {
        onRequestSignIn();
        return false;
      }
      setSaving(true);
      setSaveState("saving");
      if (!options?.silent) setPanelError(null);
      try {
        const { review } = await saveAlumniReportReview({
          id: reviewId,
          draft: { ...draft, status: status === "submitted" ? "submitted" : "draft" },
          reportId,
          applicationId,
          reportSnapshot: report,
          formSnapshot: form,
          intakeTerm: getEffectiveIntake(form) || null,
          locale,
        });
        setReviewId(review.id);
        const nextDraft = alumniReviewToDraft(review as Parameters<typeof alumniReviewToDraft>[0], draft);
        setDraft(nextDraft);
        lastSavedKeyRef.current = JSON.stringify(draftToReviewPayload(nextDraft));
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 2500);
        if (status === "submitted") setSubmitSuccess(true);
        return true;
      } catch (e) {
        setSaveState("error");
        if (!options?.silent) {
          setPanelError(formatSaveError(e));
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [applicationId, draft, form, formatSaveError, isAuthenticated, locale, onRequestSignIn, report, reportId, reviewId],
  );

  const triggerAutoSave = useCallback(
    (mode: "immediate" | "debounced" = "immediate") => {
      if (!isAuthenticated) return;
      const run = () => void persistReview("draft", { silent: true });
      if (mode === "immediate") {
        if (autoSaveTimerRef.current != null) {
          window.clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        run();
        return;
      }
      if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = window.setTimeout(() => {
        autoSaveTimerRef.current = null;
        run();
      }, 400);
    },
    [isAuthenticated, persistReview],
  );

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
    },
    [],
  );

  if (!draft) return null;

  const evalCase = shimEvalCase(form, report, locale, title);
  const run = shimRun();
  const result = shimResult(report);

  return (
    <section className="alumni-review-panel" aria-labelledby="alumni-review-title">
      <header className="alumni-review-panel__head">
        <div>
          <h2 id="alumni-review-title">{t("alumni.review.title")}</h2>
          <p className="alumni-review-panel__lead">{t("alumni.review.lead")}</p>
        </div>
        {!isAuthenticated ? (
          <button type="button" className="btn btn-primary" onClick={onRequestSignIn}>
            {t("alumni.review.signInToSave")}
          </button>
        ) : null}
      </header>

      {submitSuccess ? (
        <div className="alumni-review-panel__success" role="status">
          <strong>{t("alumni.review.submitSuccessTitle")}</strong>
          <p>{t("alumni.review.submitSuccessLead")}</p>
        </div>
      ) : null}

      {panelError ? <p className="alumni-review-panel__error">{panelError}</p> : null}

      <div className="alumni-review-panel__form admin-portal">
        <AdminEvalReviewForm
          variant="alumni"
          evalCase={evalCase}
          run={run}
          result={result}
          draft={draft}
          onChange={setDraft}
          onSave={(status) => void persistReview(status)}
          onAutoSave={triggerAutoSave}
          saving={saving}
          saveState={saveState}
          t={t}
        />
      </div>
    </section>
  );
}
