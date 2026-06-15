import { useCallback, useEffect, useState } from "react";
import type { Locale } from "../../../i18n/strings";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { FormState, ReportPayload } from "../../../types";
import type { ProfileDimensionKey } from "../../../lib/fiveDimensionProfile";
import { buildReportApiBody } from "../../../lib/reportApiBody";
import {
  adminErrorMessage,
  approveAdminAlumniReview,
  fetchAdminAlumniReview,
  listAdminAlumniReviews,
  rejectAdminAlumniReview,
  saveAdminAlumniReview,
  type AdminAlumniReview,
  type AdminEvalCase,
  type AdminEvalRun,
  type AdminEvalRunResult,
} from "../../../lib/admin/crmAdminApi";
import {
  alumniReviewToDraft,
  buildInitialAlumniReviewDraft,
  draftToReviewPayload,
} from "../../../lib/admin/evalReviewState";
import type { EvalReviewDraft } from "../../../lib/admin/evalRubric";
import { AdminEvalReviewForm } from "../eval/AdminEvalReviewForm";

type Props = {
  token: string;
  busy: boolean;
  onRun: (fn: () => Promise<void>) => Promise<void>;
  onNotice: (message: string | null) => void;
};

type QueueFilter = "draft" | "submitted" | "approved" | "all";

function formatWhen(iso: string | null | undefined, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string, t: (key: string) => string) {
  const key = `admin.alumniReviews.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function shimEvalCase(review: AdminAlumniReview, title: string): AdminEvalCase {
  const form = review.formSnapshot as unknown as FormState;
  const report = review.reportSnapshot as unknown as ReportPayload;
  const locale = (review.locale === "en" ? "en" : "zh") as Locale;
  const reportBody = buildReportApiBody(form, undefined, locale);
  const tierNames = (rows: ReportPayload["reach"] | undefined) =>
    (rows ?? []).map((r) => String(r.school ?? "").trim()).filter(Boolean).slice(0, 3);
  return {
    id: review.id,
    caseKey: `alumni-${review.id}`,
    title,
    tags: ["alumni"],
    locale,
    notes: review.overallNotes,
    active: true,
    reportBody,
    expectedReach: tierNames(report.reach).map((school) => ({ school })),
    expectedMatch: tierNames(report.match).map((school) => ({ school })),
    expectedSafety: tierNames(report.safety).map((school) => ({ school })),
    forbiddenSchools: [],
    createdBy: review.userEmail,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function shimRun(review: AdminAlumniReview): AdminEvalRun {
  return {
    id: review.id,
    label: review.intakeTerm ?? "Alumni",
    status: "completed",
    promptVersion: "live",
    rubricVersion: review.rubricVersion ?? "1.0",
    reportTemplateVersion: "live",
    caseCount: 1,
    okCount: 1,
    errorCount: 0,
    createdBy: review.userEmail,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function shimResult(review: AdminAlumniReview): AdminEvalRunResult {
  return {
    id: review.id,
    runId: review.id,
    caseId: review.id,
    status: "ok",
    reportPayload: review.reportSnapshot as Record<string, unknown>,
    error: null,
    llmMs: null,
    provider: null,
    model: null,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    case: null,
    score: null,
    review: review,
  };
}

function draftFromReview(detail: AdminAlumniReview, profileLabel: (key: ProfileDimensionKey) => string) {
  const form = detail.formSnapshot as unknown as FormState;
  const report = detail.reportSnapshot as unknown as ReportPayload;
  const loc = (detail.locale === "en" ? "en" : "zh") as Locale;
  const fallback = buildInitialAlumniReviewDraft(form, report, loc, profileLabel);
  return alumniReviewToDraft(detail as Parameters<typeof alumniReviewToDraft>[0], fallback);
}

export function AdminAlumniReviewsPanel({ token, busy, onRun, onNotice }: Props) {
  const { t, locale } = useLanguage();
  const [filter, setFilter] = useState<QueueFilter>("submitted");
  const [reviews, setReviews] = useState<AdminAlumniReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminAlumniReview | null>(null);
  const [draft, setDraft] = useState<EvalReviewDraft | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const profileLabel = useCallback(
    (key: ProfileDimensionKey) => t(`admin.evalHarness.profile.${key}`),
    [t],
  );

  const refreshList = useCallback(async () => {
    setLoading(true);
    setPanelError(null);
    try {
      const status = filter === "all" ? undefined : filter;
      const { reviews: rows } = await listAdminAlumniReviews(token, status);
      setReviews(rows);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      setPanelError(adminErrorMessage(code, t));
    } finally {
      setLoading(false);
    }
  }, [filter, t, token]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDraft(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDraft(null);
    void (async () => {
      try {
        const { review } = await fetchAdminAlumniReview(token, selectedId);
        if (cancelled) return;
        setDetail(review);
        setDraft(draftFromReview(review, profileLabel));
      } catch (e) {
        if (!cancelled) {
          const code = (e as Error & { code?: string }).code;
          setPanelError(adminErrorMessage(code, t));
          setSelectedId(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileLabel, selectedId, t, token]);

  const intakeLabel = detail?.intakeTerm || t("alumni.flow.reportIntakeFallback");
  const caseTitle = t("alumni.review.caseTitle", { intake: intakeLabel });
  const readOnly = detail?.status === "approved";
  const editable = detail?.status === "draft" || detail?.status === "submitted";

  const saveReviewToServer = useCallback(
    async (nextDraft: EvalReviewDraft, status: "draft" | "submitted") => {
      const payload = draftToReviewPayload({
        ...nextDraft,
        status: status === "submitted" ? "submitted" : "draft",
      });
      const { review } = await saveAdminAlumniReview(token, detail!.id, payload);
      setDetail(review);
      setDraft(draftFromReview(review, profileLabel));
      return review;
    },
    [detail, profileLabel, token],
  );

  const persistReview = useCallback(
    async (status: EvalReviewDraft["status"]) => {
      if (!detail || !draft || saving || readOnly) return false;
      setSaving(true);
      setSaveState("saving");
      setPanelError(null);
      try {
        await saveReviewToServer(draft, status === "submitted" ? "submitted" : "draft");
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 2500);
        onNotice(t("admin.alumniReviews.saveSuccess"));
        await refreshList();
        return true;
      } catch (e) {
        const code = (e as Error & { code?: string }).code;
        setPanelError(adminErrorMessage(code, t));
        setSaveState("error");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [detail, draft, onNotice, readOnly, refreshList, saveReviewToServer, saving, t],
  );

  const handleApprove = () => {
    if (!detail || !draft || actionBusy || busy) return;
    void onRun(async () => {
      setActionBusy(true);
      onNotice(null);
      setPanelError(null);
      try {
        if (detail.status === "submitted") {
          await saveReviewToServer(draft, "submitted");
        }
        const { review } = await approveAdminAlumniReview(token, detail.id);
        setDetail(review);
        setDraft(draftFromReview(review, profileLabel));
        onNotice(t("admin.alumniReviews.approveSuccess"));
        await refreshList();
      } catch (e) {
        const code = (e as Error & { code?: string }).code;
        onNotice(adminErrorMessage(code, t));
      } finally {
        setActionBusy(false);
      }
    });
  };

  const handleReject = () => {
    if (!detail || actionBusy || busy) return;
    if (!window.confirm(t("admin.alumniReviews.rejectConfirm"))) return;
    void onRun(async () => {
      setActionBusy(true);
      onNotice(null);
      try {
        const { review } = await rejectAdminAlumniReview(token, detail.id);
        setDetail(review);
        setDraft(draftFromReview(review, profileLabel));
        onNotice(t("admin.alumniReviews.rejectSuccess"));
        await refreshList();
      } catch (e) {
        const code = (e as Error & { code?: string }).code;
        onNotice(adminErrorMessage(code, t));
      } finally {
        setActionBusy(false);
      }
    });
  };

  if (selectedId) {
    return (
      <div className="admin-eval admin-alumni-reviews">
        <header className="admin-eval__head">
          <button
            type="button"
            className="admin-portal__btn admin-portal__btn--ghost"
            onClick={() => {
              setSelectedId(null);
              setDetail(null);
              setDraft(null);
            }}
          >
            {t("admin.alumniReviews.backToQueue")}
          </button>
          <div className="admin-alumni-reviews__detail-meta">
            <h2>{caseTitle}</h2>
            {detail ? (
              <p className="admin-eval__sub">
                {detail.userEmail ?? detail.userId}
                {" · "}
                {statusLabel(detail.status, t)}
                {detail.submittedAt ? ` · ${formatWhen(detail.submittedAt, locale)}` : ""}
              </p>
            ) : null}
            {editable ? <p className="admin-eval__sub">{t("admin.alumniReviews.editLead")}</p> : null}
          </div>
          {detail?.status === "submitted" ? (
            <div className="admin-alumni-reviews__actions">
              <button
                type="button"
                className="admin-portal__btn admin-portal__btn--ghost"
                disabled={actionBusy || busy || detailLoading}
                onClick={handleReject}
              >
                {actionBusy ? t("admin.alumniReviews.rejecting") : t("admin.alumniReviews.reject")}
              </button>
              <button
                type="button"
                className="admin-portal__btn admin-portal__btn--primary"
                disabled={actionBusy || busy || detailLoading || saving}
                onClick={handleApprove}
              >
                {actionBusy ? t("admin.alumniReviews.approving") : t("admin.alumniReviews.approve")}
              </button>
            </div>
          ) : null}
        </header>

        {panelError ? <p className="admin-portal__notice admin-portal__notice--err">{panelError}</p> : null}
        {detailLoading || !detail || !draft ? (
          <p className="admin-eval__empty">{t("admin.alumniReviews.loadingDetail")}</p>
        ) : (
          <AdminEvalReviewForm
            variant="alumni"
            readOnly={readOnly}
            evalCase={shimEvalCase(detail, caseTitle)}
            run={shimRun(detail)}
            result={shimResult(detail)}
            draft={draft}
            onChange={setDraft}
            onSave={(status) => void persistReview(status)}
            saving={saving}
            saveState={saveState}
            t={t}
          />
        )}
      </div>
    );
  }

  return (
    <div className="admin-eval admin-alumni-reviews">
      <header className="admin-eval__head">
        <div>
          <h2>{t("admin.alumniReviews.title")}</h2>
          <p className="admin-eval__sub">{t("admin.alumniReviews.lead")}</p>
        </div>
      </header>

      <div className="admin-alumni-reviews__filters" role="tablist" aria-label={t("admin.alumniReviews.filterLabel")}>
        {(["draft", "submitted", "approved", "all"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`admin-portal__btn admin-portal__btn--ghost${filter === id ? " is-active" : ""}`}
            onClick={() => setFilter(id)}
          >
            {t(`admin.alumniReviews.filters.${id}`)}
          </button>
        ))}
      </div>

      {panelError ? <p className="admin-portal__notice admin-portal__notice--err">{panelError}</p> : null}

      {loading ? (
        <p className="admin-eval__empty">{t("admin.alumniReviews.loading")}</p>
      ) : reviews.length === 0 ? (
        <p className="admin-eval__empty">{t("admin.alumniReviews.empty")}</p>
      ) : (
        <div className="admin-alumni-reviews__table-wrap">
          <table className="admin-eval-run-history__compare-table admin-alumni-reviews__table">
            <thead>
              <tr>
                <th>{t("admin.alumniReviews.colIntake")}</th>
                <th>{t("admin.alumniReviews.colUser")}</th>
                <th>{t("admin.alumniReviews.colStatus")}</th>
                <th>{t("admin.alumniReviews.colSubmitted")}</th>
                <th>{t("admin.alumniReviews.colUpdated")}</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      type="button"
                      className="admin-alumni-reviews__link"
                      onClick={() => setSelectedId(row.id)}
                    >
                      {row.intakeTerm || t("alumni.flow.reportIntakeFallback")}
                    </button>
                  </td>
                  <td>{row.userEmail ?? row.userId.slice(0, 8)}</td>
                  <td>
                    <span className={`admin-alumni-reviews__status admin-alumni-reviews__status--${row.status}`}>
                      {statusLabel(row.status, t)}
                    </span>
                  </td>
                  <td>{formatWhen(row.submittedAt, locale)}</td>
                  <td>{formatWhen(row.updatedAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
