import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { Locale } from "../../../i18n/strings";
import type { ProfileDimensionKey } from "../../../lib/fiveDimensionProfile";
import {
  buildEvalCasePayload,
  emptyEvalCaseDraft,
  type buildEvalCaseExpectedPatch,
} from "../../../lib/admin/evalCaseForm";
import { getEvalCaseTitle } from "../../../lib/admin/evalCaseDisplay";
import {
  CORRECTION_REASON_CATEGORIES,
  REPORT_PROMPT_VERSION,
  REPORT_RUBRIC_VERSION,
  REPORT_TEMPLATE_VERSION,
  RUBRIC_DIMENSIONS,
  PROFILE_DIMENSION_KEYS,
  rubricAverage,
} from "../../../lib/admin/evalRubric";
import {
  buildInitialReviewDraft,
  countProfileAdjustments,
  countSchoolCorrections,
  draftToReviewPayload,
  reviewToDraft,
} from "../../../lib/admin/evalReviewState";
import { AdminEvalQuestionnaireForm } from "../AdminEvalQuestionnaireForm";
import { AdminEvalReviewForm } from "./AdminEvalReviewForm";
import { EvalCaseDetail } from "./EvalCaseDetail";
import { EvalCaseList } from "./EvalCaseList";
import { EvalRunHistory } from "./EvalRunHistory";
import {
  createAdminEvalCase,
  createAdminEvalRun,
  deleteAdminEvalCase,
  downloadAdminEvalExport,
  downloadTrainingSftExport,
  fetchAdminEvalCaseStatus,
  fetchAdminEvalDashboard,
  fetchTrainingCorpusStats,
  fetchEngineStandardsStats,
  writeEngineStandardFromDraft,
  trialRunEngineStandards,
  publishEngineStandards,
  fetchAdminEvalRun,
  generateAdminEvalRunCase,
  listAdminEvalCases,
  listAdminEvalRuns,
  patchAdminEvalCase,
  saveAdminEvalReview,
  type AdminEvalDashboard,
  type AdminEvalRun,
  type AdminEvalRunResult,
  type TrainingCorpusStats,
  type EngineStandardsStats,
  type EngineTrialRunReport,
} from "../../../lib/admin/crmAdminApi";
import type { EvalReviewDraft } from "../../../lib/admin/evalRubric";

type Props = {
  token: string;
  busy: boolean;
  onRun: (fn: () => Promise<void>) => Promise<void>;
};

type EvalStep = "library" | "generate" | "review" | "history" | "summary" | "dashboard" | "export";

const STEPS: EvalStep[] = ["library", "generate", "review", "history", "summary", "dashboard", "export"];

function evalErrorMessage(code: string | undefined, t: (key: string) => string) {
  if (!code) return t("admin.errors.generic");
  if (code === "api_route_missing") return t("admin.errors.eval_api_missing");
  if (/report_eval|relation.*does not exist/i.test(code)) return t("admin.errors.eval_table_missing");
  if (/eval_review_table_missing/i.test(code)) return t("admin.errors.eval_review_table_missing");
  if (/incomplete_schools/i.test(code)) return t("admin.evalHarness.engineWriteNeedSubmit");
  if (/review_not_submitted/i.test(code)) return t("admin.evalHarness.engineWriteNeedSubmit");
  if (/draft_empty/i.test(code)) return t("admin.evalHarness.enginePublishEmpty");
  const key = `admin.errors.${code}`;
  const msg = t(key);
  return msg === key ? t("admin.errors.generic") : msg;
}

function autoRunLabel(locale: Locale) {
  const d = new Date();
  return locale === "en" ? `Eval ${d.toLocaleDateString("en-US")}` : `评测 ${d.toLocaleDateString("zh-CN")}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function draftHasNineSchools(draft: EvalReviewDraft | null) {
  if (!draft) return false;
  const f = draft.finalApprovedRecommendation;
  return f.reach.filter((s) => s.trim()).length >= 3 &&
    f.match.filter((s) => s.trim()).length >= 3 &&
    f.safety.filter((s) => s.trim()).length >= 3;
}

export function AdminEvalHarness({ token, busy, onRun }: Props) {
  const { t, locale } = useLanguage();
  const [step, setStep] = useState<EvalStep>("library");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cases, setCases] = useState<Awaited<ReturnType<typeof listAdminEvalCases>>["cases"]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [addingCase, setAddingCase] = useState(false);
  const [caseDraft, setCaseDraft] = useState(() => emptyEvalCaseDraft(locale));
  const [savingCase, setSavingCase] = useState(false);
  const [savingExpected, setSavingExpected] = useState(false);

  const [selectedRunId, setSelectedRunId] = useState("");
  const [runs, setRuns] = useState<AdminEvalRun[]>([]);
  const [runDetail, setRunDetail] = useState<Awaited<ReturnType<typeof fetchAdminEvalRun>> | null>(null);
  const [caseStatusResults, setCaseStatusResults] = useState<AdminEvalRunResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [reviewCaseId, setReviewCaseId] = useState("");
  const [reviewDraft, setReviewDraft] = useState<EvalReviewDraft | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaveState, setReviewSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const reviewLastSavedKeyRef = useRef("");
  const reviewSyncKeyRef = useRef("");

  const [dashboard, setDashboard] = useState<AdminEvalDashboard | null>(null);
  const [trainingCorpus, setTrainingCorpus] = useState<TrainingCorpusStats | null>(null);
  const [engineStandards, setEngineStandards] = useState<EngineStandardsStats | null>(null);
  const [engineWriteBusy, setEngineWriteBusy] = useState(false);
  const [engineWriteOk, setEngineWriteOk] = useState(false);
  const [engineActionBusy, setEngineActionBusy] = useState<"trial" | "publish" | null>(null);
  const [engineTrialReport, setEngineTrialReport] = useState<EngineTrialRunReport | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [libraryPanel, setLibraryPanel] = useState<"list" | "detail" | "add">("list");
  const [generatePanel, setGeneratePanel] = useState<"list" | "detail">("list");
  const [reviewPanel, setReviewPanel] = useState<"list" | "detail">("list");
  const prevStepRef = useRef<EvalStep>(step);
  const selectedRunIdRef = useRef(selectedRunId);
  selectedRunIdRef.current = selectedRunId;

  const profileLabel = useCallback(
    (key: ProfileDimensionKey) => t(`admin.evalHarness.profile.${key}`),
    [t],
  );

  const refreshCases = useCallback(async () => {
    const { cases: next } = await listAdminEvalCases(token);
    setCases(next);
  }, [token]);

  const loadRunDetail = useCallback(
    async (runId: string) => {
      if (!runId) {
        setRunDetail(null);
        return;
      }
      const detail = await fetchAdminEvalRun(token, runId);
      setRunDetail(detail);
    },
    [token],
  );

  const refreshDashboard = useCallback(async () => {
    const data = await fetchAdminEvalDashboard(token);
    setDashboard(data);
  }, [token]);

  const refreshTrainingCorpus = useCallback(async () => {
    try {
      const data = await fetchTrainingCorpusStats(token);
      setTrainingCorpus(data);
    } catch {
      setTrainingCorpus(null);
    }
  }, [token]);

  const refreshEngineStandards = useCallback(async () => {
    try {
      const data = await fetchEngineStandardsStats(token);
      setEngineStandards(data);
    } catch {
      setEngineStandards(null);
    }
  }, [token]);

  const refreshCaseStatus = useCallback(async () => {
    const { results } = await fetchAdminEvalCaseStatus(token);
    setCaseStatusResults(results);
  }, [token]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setPanelError(null);
    try {
      await refreshCases();
      const { runs: nextRuns } = await listAdminEvalRuns(token);
      setRuns(nextRuns);
      const runId =
        selectedRunIdRef.current && nextRuns.some((r) => r.id === selectedRunIdRef.current)
          ? selectedRunIdRef.current
          : nextRuns[0]?.id || "";
      if (runId !== selectedRunIdRef.current) setSelectedRunId(runId);
      if (runId) await loadRunDetail(runId);
      await Promise.all([refreshDashboard(), refreshCaseStatus(), refreshTrainingCorpus(), refreshEngineStandards()]);
    } catch (e) {
      setPanelError(evalErrorMessage((e as Error & { code?: string }).code, t));
    } finally {
      setLoading(false);
    }
  }, [loadRunDetail, refreshCaseStatus, refreshCases, refreshDashboard, refreshEngineStandards, refreshTrainingCorpus, t, token]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (loading) return;
    if (cases.length === 0) {
      setAddingCase(true);
      setLibraryPanel("add");
      setSelectedCaseId("");
      return;
    }
    if (!addingCase) {
      setSelectedCaseId((prev) => (prev && cases.some((c) => c.id === prev) ? prev : cases[0].id));
    }
  }, [addingCase, cases, loading]);

  const activeCases = useMemo(() => cases.filter((c) => c.active), [cases]);
  const selectedCase = useMemo(() => cases.find((c) => c.id === selectedCaseId) ?? null, [cases, selectedCaseId]);
  const showAddForm = addingCase || libraryPanel === "add" || (cases.length === 0 && !loading);

  const reviewableResults = useMemo(
    () => runDetail?.results.filter((r) => r.status === "ok" && r.case) ?? [],
    [runDetail],
  );

  const selectedReviewRow = useMemo(
    () => reviewableResults.find((r) => r.caseId === reviewCaseId) ?? null,
    [reviewableResults, reviewCaseId],
  );

  useEffect(() => {
    if (!selectedReviewRow?.case || !runDetail) {
      setReviewDraft(null);
      reviewLastSavedKeyRef.current = "";
      reviewSyncKeyRef.current = "";
      return;
    }
    const syncKey = `${runDetail.run.id}:${selectedReviewRow.caseId}`;
    if (reviewSyncKeyRef.current === syncKey) return;
    reviewSyncKeyRef.current = syncKey;

    const fallback = buildInitialReviewDraft(selectedReviewRow.case, selectedReviewRow, profileLabel);
    const nextDraft = selectedReviewRow.review ? reviewToDraft(selectedReviewRow.review, fallback) : fallback;
    setReviewDraft(nextDraft);
    reviewLastSavedKeyRef.current = JSON.stringify(nextDraft);
  }, [runDetail, selectedReviewRow, profileLabel]);

  useEffect(() => {
    const prev = prevStepRef.current;
    if (step === "generate" && prev !== "generate" && prev !== "library") {
      setGeneratePanel("list");
    }
    if (step === "review" && prev !== "review") {
      if (reviewableResults.length === 1) {
        setReviewCaseId(reviewableResults[0].caseId);
        setReviewPanel("detail");
      } else if (reviewableResults.length > 1 && prev !== "generate") {
        setReviewCaseId("");
        setReviewPanel("list");
      }
    }
    if (step === "library" && prev !== "library" && !addingCase) {
      setLibraryPanel("list");
    }
    prevStepRef.current = step;
  }, [addingCase, step, reviewableResults]);

  useEffect(() => {
    if (step !== "summary" || !selectedRunId) return;
    let cancelled = false;
    setSummaryLoading(true);
    setPanelError(null);
    void (async () => {
      try {
        await loadRunDetail(selectedRunId);
        await refreshDashboard();
      } catch (e) {
        if (!cancelled) {
          setPanelError(evalErrorMessage((e as Error & { code?: string }).code, t));
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, selectedRunId, loadRunDetail, refreshDashboard, t]);

  const handleSaveCase = async () => {
    if (savingCase || busy) return;
    setPanelError(null);
    const built = buildEvalCasePayload(caseDraft, cases.map((c) => c.caseKey));
    if ("error" in built) {
      setPanelError(evalErrorMessage(built.error, t));
      return;
    }
    setSavingCase(true);
    try {
      const { case: created } = await createAdminEvalCase(token, built.payload);
      setCaseDraft(emptyEvalCaseDraft(caseDraft.locale));
      setAddingCase(false);
      setSelectedCaseId(created.id);
      setLibraryPanel("detail");
      await refreshCases();
    } catch (e) {
      setPanelError(evalErrorMessage((e as Error & { code?: string }).code, t));
    } finally {
      setSavingCase(false);
    }
  };

  const handleSaveExpected = useCallback(
    async (caseId: string, patch: ReturnType<typeof buildEvalCaseExpectedPatch>) => {
      if (savingExpected || busy) return;
      setSavingExpected(true);
      setPanelError(null);
      try {
        await patchAdminEvalCase(token, caseId, patch);
        await refreshCases();
      } catch (e) {
        setPanelError(evalErrorMessage((e as Error & { code?: string }).code, t));
        throw e;
      } finally {
        setSavingExpected(false);
      }
    },
    [busy, refreshCases, savingExpected, t, token],
  );

  const handleSelectRun = useCallback(
    async (runId: string) => {
      setSelectedRunId(runId);
      setPanelError(null);
      try {
        await loadRunDetail(runId);
      } catch (e) {
        setPanelError(evalErrorMessage((e as Error & { code?: string }).code, t));
      }
    },
    [loadRunDetail, t],
  );

  const handleGenerate = async () => {
    if (testing || busy || !selectedCaseId) return;
    setTesting(true);
    setPanelError(null);
    try {
      const { run } = await createAdminEvalRun(token, {
        label: autoRunLabel(locale),
        caseIds: [selectedCaseId],
        promptVersion: REPORT_PROMPT_VERSION,
        rubricVersion: REPORT_RUBRIC_VERSION,
        reportTemplateVersion: REPORT_TEMPLATE_VERSION,
      });
      setSelectedRunId(run.id);
      setRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)]);
      await generateAdminEvalRunCase(token, run.id, selectedCaseId);
      const detail = await fetchAdminEvalRun(token, run.id);
      setRunDetail(detail);
      await refreshCaseStatus();
      const resultRow = detail.results.find((r) => r.caseId === selectedCaseId);
      if (resultRow?.case && resultRow.status === "ok") {
        const initialDraft = buildInitialReviewDraft(resultRow.case, resultRow, profileLabel);
        try {
          await saveAdminEvalReview(token, run.id, selectedCaseId, draftToReviewPayload(initialDraft));
          await loadRunDetail(run.id);
        } catch (e) {
          setPanelError(evalErrorMessage((e as Error & { code?: string }).code, t));
        }
      }
      setReviewCaseId(selectedCaseId);
      setReviewPanel("detail");
      setStep("review");
    } catch (e) {
      setPanelError(evalErrorMessage((e as Error & { code?: string }).code, t));
    } finally {
      setTesting(false);
    }
  };

  const handleSaveReview = useCallback(
    async (
      status: EvalReviewDraft["status"],
      options?: { silent?: boolean; draftOverride?: EvalReviewDraft },
    ) => {
      const draft = options?.draftOverride ?? reviewDraft;
      if (!runDetail || !selectedReviewRow || !draft || savingReview) return false;
      setSavingReview(true);
      setReviewSaveState("saving");
      if (!options?.silent) setPanelError(null);
      try {
        const payload = draftToReviewPayload({ ...draft, status: status === "submitted" ? status : "draft" });
        const runId = runDetail.run.id;
        const caseId = selectedReviewRow.caseId;
        const { review, trainingCorpus: corpusSync, decisionEngine: engineSync } = await saveAdminEvalReview(token, runId, caseId, payload);
        if (corpusSync?.ok) {
          await refreshTrainingCorpus();
        }
        if (engineSync?.ok) {
          await refreshEngineStandards();
        }
        if (options?.silent) {
          setRunDetail((prev) =>
            prev
              ? {
                  ...prev,
                  results: prev.results.map((row) => (row.caseId === caseId ? { ...row, review } : row)),
                }
              : prev,
          );
        } else {
          await loadRunDetail(runId);
        }
        await Promise.all([refreshDashboard(), refreshCaseStatus()]);
        reviewLastSavedKeyRef.current = JSON.stringify({ ...draft, status: status === "submitted" ? status : "draft" });
        setReviewSaveState("saved");
        window.setTimeout(() => setReviewSaveState("idle"), 2500);
        if (corpusSync?.ok && !options?.silent) {
          setPanelError(null);
        }
        if (status === "submitted" && !options?.silent) {
          if (engineSync?.ok) {
            setPanelError(t("admin.evalHarness.engineAutoSynced"));
          }
          setStep("summary");
        }
        return true;
      } catch (e) {
        setReviewSaveState("error");
        if (!options?.silent) {
          setPanelError(evalErrorMessage((e as Error & { code?: string }).code, t));
        }
        return false;
      } finally {
        setSavingReview(false);
      }
    },
    [loadRunDetail, refreshCaseStatus, refreshDashboard, refreshEngineStandards, refreshTrainingCorpus, reviewDraft, runDetail, savingReview, selectedReviewRow, t, token],
  );

  const autoSaveTimerRef = useRef<number | null>(null);

  const triggerAutoSave = useCallback(
    (mode: "immediate" | "debounced" = "immediate", draftOverride?: EvalReviewDraft) => {
      const run = () => void handleSaveReview("draft", { silent: true, draftOverride });
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
    [handleSaveReview],
  );

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
    },
    [],
  );

  const handleExportSft = async () => {
    if (exporting) return;
    setExporting("sft");
    setPanelError(null);
    try {
      const { blob, filename } = await downloadTrainingSftExport(token);
      triggerDownload(blob, filename);
    } catch (e) {
      setPanelError(evalErrorMessage((e as Error & { message?: string }).message, t));
    } finally {
      setExporting(null);
    }
  };

  const handleWriteEngineStandard = useCallback(async () => {
    if (!selectedReviewRow?.case || !reviewDraft || engineWriteBusy) return;
    if (!draftHasNineSchools(reviewDraft)) {
      setPanelError(t("admin.evalHarness.engineWriteNeedSubmit"));
      return;
    }
    setEngineWriteBusy(true);
    setEngineWriteOk(false);
    setPanelError(null);
    try {
      const out = await writeEngineStandardFromDraft(token, selectedReviewRow.case, reviewDraft);
      if (!out.ok) {
        setPanelError(evalErrorMessage(out.reason, t));
        return;
      }
      setEngineWriteOk(true);
      await refreshEngineStandards();
      window.setTimeout(() => setEngineWriteOk(false), 2500);
    } catch (e) {
      setPanelError(evalErrorMessage((e as Error & { message?: string }).message, t));
    } finally {
      setEngineWriteBusy(false);
    }
  }, [engineWriteBusy, refreshEngineStandards, reviewDraft, selectedReviewRow?.case, t, token]);

  const handleEngineTrialRun = async () => {
    if (engineActionBusy) return;
    setEngineActionBusy("trial");
    setPanelError(null);
    try {
      const report = await trialRunEngineStandards(token);
      setEngineTrialReport(report);
      if (report.draftCount === 0) {
        setPanelError(t("admin.evalHarness.engineTrialEmpty"));
      }
    } catch (e) {
      setPanelError(evalErrorMessage((e as Error & { message?: string }).message, t));
    } finally {
      setEngineActionBusy(null);
    }
  };

  const handleEnginePublish = async () => {
    if (engineActionBusy) return;
    if (!engineStandards?.draftCount) {
      setPanelError(t("admin.evalHarness.enginePublishEmpty"));
      return;
    }
    if (!window.confirm(t("admin.evalHarness.enginePublishConfirm"))) return;
    setEngineActionBusy("publish");
    setPanelError(null);
    try {
      const out = await publishEngineStandards(token);
      if (!out.ok) {
        setPanelError(evalErrorMessage(out.reason, t));
        return;
      }
      setPanelError(t("admin.evalHarness.enginePublished"));
      await refreshEngineStandards();
    } catch (e) {
      setPanelError(evalErrorMessage((e as Error & { message?: string }).message, t));
    } finally {
      setEngineActionBusy(null);
    }
  };

  const handleExport = async (kind: "json" | "csv" | "summary", scope: "reviewed" | "generated" = "reviewed") => {
    if (exporting) return;
    setExporting(kind === "json" ? (scope === "generated" ? "json-generated" : "json-reviewed") : kind);
    setPanelError(null);
    try {
      const { blob, filename } = await downloadAdminEvalExport(token, kind, kind === "json" ? scope : "reviewed");
      triggerDownload(blob, filename);
    } catch (e) {
      setPanelError(evalErrorMessage((e as Error & { message?: string }).message, t));
    } finally {
      setExporting(null);
    }
  };

  const generatedOkCount = caseStatusResults.filter((r) => r.status === "ok").length;

  return (
    <div className="admin-eval admin-eval-harness">
      <header className="admin-eval-harness__header">
        <div>
          <h2 className="admin-eval-harness__title">{t("admin.evalHarness.title")}</h2>
          <p className="admin-eval-harness__subtitle">{t("admin.evalHarness.notFineTuning")}</p>
          {trainingCorpus ? (
            <p className="admin-eval-harness__subtitle admin-eval-harness__subtitle--muted">
              {t("admin.evalHarness.brainCorpus", { n: String(trainingCorpus.goldCaseCount) })}
              {" · "}
              {t("admin.evalHarness.brainCorpusHint")}
            </p>
          ) : null}
          {engineStandards ? (
            <p className="admin-eval-harness__subtitle admin-eval-harness__subtitle--muted">
              {t("admin.evalHarness.engineDraft", { n: String(engineStandards.draftCount) })}
              {" · "}
              {t("admin.evalHarness.engineLive", { n: String(engineStandards.liveCount) })}
              {engineStandards.catalogSchoolCount != null ? (
                <>
                  {" · "}
                  {t("admin.evalHarness.engineCatalog", { n: String(engineStandards.catalogSchoolCount) })}
                </>
              ) : null}
              {engineStandards.v2Enabled ? (
                <>
                  {" · "}
                  {t("admin.evalHarness.engineV2On")}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {dashboard ? (
          <div className="admin-eval-harness__header-actions">
            <button
              type="button"
              className="admin-portal__btn admin-portal__btn--ghost admin-eval-harness__export-quick"
              disabled={!!engineActionBusy || !engineStandards?.draftCount}
              onClick={() => void handleEngineTrialRun()}
            >
              {engineActionBusy === "trial" ? t("admin.evalHarness.engineTrialing") : t("admin.evalHarness.engineTrialRun")}
            </button>
            <button
              type="button"
              className="admin-portal__btn admin-portal__btn--primary admin-eval-harness__export-quick"
              disabled={!!engineActionBusy || !engineStandards?.draftCount}
              onClick={() => void handleEnginePublish()}
            >
              {engineActionBusy === "publish" ? t("admin.evalHarness.enginePublishing") : t("admin.evalHarness.enginePublish")}
            </button>
            {trainingCorpus && trainingCorpus.goldCaseCount > 0 ? (
              <button
                type="button"
                className="admin-portal__btn admin-portal__btn--ghost admin-eval-harness__export-quick"
                disabled={!!exporting}
                onClick={() => void handleExportSft()}
              >
                {exporting === "sft" ? t("admin.eval.exportingFeedback") : t("admin.evalHarness.brainExportSft")}
              </button>
            ) : null}
            <span className="admin-eval-harness__progress">
              {t("admin.eval.exportProgress", {
                saved: String(dashboard.reviewedCount),
                total: String(dashboard.activeCaseCount || activeCases.length),
              })}
            </span>
            <button
              type="button"
              className="admin-portal__btn admin-portal__btn--ghost admin-eval-harness__export-quick"
              disabled={!!exporting || generatedOkCount === 0}
              onClick={() => void handleExport("json", "generated")}
            >
              {exporting === "json-generated"
                ? t("admin.eval.exportingFeedback")
                : t("admin.evalHarness.exportGeneratedJson", { n: String(generatedOkCount) })}
            </button>
            <button
              type="button"
              className="admin-portal__btn admin-portal__btn--primary admin-eval-harness__export-quick"
              disabled={!!exporting || dashboard.reviewedCount === 0}
              onClick={() => void handleExport("json", "reviewed")}
            >
              {exporting === "json-reviewed"
                ? t("admin.eval.exportingFeedback")
                : t("admin.evalHarness.exportReviewedJson", { n: String(dashboard.reviewedCount) })}
            </button>
          </div>
        ) : null}
      </header>

      <ol className="admin-eval-harness__stepper" aria-label={t("admin.evalHarness.navLabel")}>
        {STEPS.map((s, i) => {
          const done =
            (s === "library" && cases.length > 0) ||
            (s === "generate" && reviewableResults.length > 0) ||
            (s === "review" && (selectedReviewRow?.review?.status === "submitted" || selectedReviewRow?.review?.status === "approved")) ||
            (s === "history" && runs.length > 1) ||
            (s === "summary" && (runDetail?.results.some((r) => r.review?.status === "submitted" || r.review?.status === "approved") ?? false)) ||
            (s === "dashboard" && (dashboard?.reviewedCount ?? 0) > 0) ||
            (s === "export" && (dashboard?.reviewedCount ?? 0) > 0);
          return (
            <li
              key={s}
              className={`admin-eval-harness__step${step === s ? " admin-eval-harness__step--active" : ""}${done ? " admin-eval-harness__step--done" : ""}`}
            >
              <button type="button" className="admin-eval-harness__step-btn" onClick={() => setStep(s)}>
                <span className="admin-eval-harness__step-num">{i + 1}</span>
                <span className="admin-eval-harness__step-label">{t(`admin.evalHarness.stepsShort.${s}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {selectedCase && step !== "library" ? (
        <div className="admin-eval-harness__context">
          <span>{t("admin.evalHarness.currentCase", { name: getEvalCaseTitle(selectedCase, locale) })}</span>
          {runDetail?.run && step !== "history" ? (
            <span className="admin-eval-harness__context-run">
              {t("admin.evalHarness.activeRun", {
                label: runDetail.run.label,
                prompt: runDetail.run.promptVersion ?? "—",
              })}
              <button type="button" className="admin-eval-harness__context-link" onClick={() => setStep("history")}>
                {t("admin.evalHarness.openRunHistory")}
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {panelError ? <p className="admin-portal__notice admin-eval-harness__error">{panelError}</p> : null}
      {engineTrialReport && engineTrialReport.draftCount > 0 ? (
        <p className="admin-portal__notice admin-eval-harness__engine-trial">
          {t("admin.evalHarness.engineTrialTitle")}
          {" — "}
          {t("admin.evalHarness.engineTrialSummary", {
            n: String(engineTrialReport.evaluatedCaseCount),
            draft: engineTrialReport.draftSchoolMatchRate != null
              ? Math.round(engineTrialReport.draftSchoolMatchRate * 100).toString()
              : "—",
            live: engineTrialReport.liveSchoolMatchRate != null
              ? Math.round(engineTrialReport.liveSchoolMatchRate * 100).toString()
              : "—",
            engine: engineTrialReport.engineSchoolMatchRate != null
              ? Math.round(engineTrialReport.engineSchoolMatchRate * 100).toString()
              : "—",
            scored: String(engineTrialReport.engineScoredCaseCount ?? 0),
            bench: String(engineTrialReport.engineBenchmarkCaseCount ?? 0),
          })}
        </p>
      ) : null}

      <div className="admin-eval-harness__panel">
        {step === "library" ? (
          <section className="admin-eval__section">
            <h3 className="admin-eval__heading">{t("admin.evalHarness.steps.library")}</h3>
            <p className="admin-eval__sub">{t("admin.evalHarness.stepsLead.library")}</p>
            {showAddForm ? (
              <>
                <AdminEvalQuestionnaireForm draft={caseDraft} onChange={setCaseDraft} onSave={() => void handleSaveCase()} saving={savingCase} />
                {cases.length > 0 ? (
                  <button type="button" className="admin-portal__btn admin-portal__btn--ghost admin-eval__cancel-add" onClick={() => { setAddingCase(false); setLibraryPanel("list"); }}>
                    {t("admin.evalHarness.backToList")}
                  </button>
                ) : null}
              </>
            ) : libraryPanel === "detail" && selectedCase ? (
              <EvalCaseDetail
                evalCase={selectedCase}
                results={caseStatusResults}
                t={t}
                onBack={() => setLibraryPanel("list")}
                onSaveExpected={(patch) => handleSaveExpected(selectedCase.id, patch)}
                savingExpected={savingExpected}
                onDelete={() => void onRun(async () => { await deleteAdminEvalCase(token, selectedCase.id); setLibraryPanel("list"); await refreshCases(); })}
                onGenerate={() => { setGeneratePanel("detail"); setStep("generate"); }}
              />
            ) : (
              <>
                <EvalCaseList
                  cases={cases}
                  selectedId={selectedCaseId}
                  results={caseStatusResults}
                  onSelect={(id) => { setSelectedCaseId(id); setLibraryPanel("detail"); }}
                  t={t}
                />
                <button type="button" className="admin-portal__btn admin-portal__btn--primary admin-eval-case-list__add" disabled={busy} onClick={() => { setCaseDraft(emptyEvalCaseDraft(locale)); setAddingCase(true); setLibraryPanel("add"); }}>
                  {t("admin.eval.addAnotherCase")}
                </button>
              </>
            )}
          </section>
        ) : null}

        {step === "generate" ? (
          <section className="admin-eval__section">
            <h3 className="admin-eval__heading">{t("admin.evalHarness.steps.generate")}</h3>
            {generatePanel === "list" || !selectedCase ? (
              <>
                <p className="admin-eval__sub">{t("admin.evalHarness.pickCaseToGenerate")}</p>
                <EvalCaseList
                  cases={activeCases.length ? activeCases : cases}
                  selectedId={selectedCaseId}
                  results={caseStatusResults}
                  onSelect={(id) => { setSelectedCaseId(id); setGeneratePanel("detail"); }}
                  t={t}
                />
              </>
            ) : selectedCase ? (
              <>
                <EvalCaseDetail
                  evalCase={selectedCase}
                  results={caseStatusResults}
                  t={t}
                  onBack={() => setGeneratePanel("list")}
                  onSaveExpected={(patch) => handleSaveExpected(selectedCase.id, patch)}
                  savingExpected={savingExpected}
                />
                <div className="admin-eval-harness__generate-card">
                  <p className="admin-eval__sub">{t("admin.eval.testLeadOne", { name: getEvalCaseTitle(selectedCase, locale) })}</p>
                  <p className="admin-eval-harness__versions">
                    {t("admin.evalHarness.versionLine", {
                      prompt: REPORT_PROMPT_VERSION,
                      rubric: REPORT_RUBRIC_VERSION,
                      template: REPORT_TEMPLATE_VERSION,
                      model: "—",
                    })}
                  </p>
                  <p className="admin-eval-harness__generate-lead">{t("admin.evalHarness.generateCtaLead")}</p>
                  <button
                    type="button"
                    className="admin-portal__btn admin-portal__btn--primary admin-portal__btn--xl admin-eval-harness__generate-cta"
                    disabled={testing || busy}
                    onClick={() => void handleGenerate()}
                  >
                    {testing ? t("admin.eval.generatingLabel") : t("admin.eval.startTest")}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {step === "review" ? (
          <section className="admin-eval__section admin-eval__section--flush">
            {reviewableResults.length === 0 ? (
              <>
                <h3 className="admin-eval__heading">{t("admin.evalHarness.steps.review")}</h3>
                <p className="admin-eval__empty">{t("admin.evalHarness.noReportYet")}</p>
              </>
            ) : reviewPanel === "list" ? (
              <>
                <h3 className="admin-eval__heading">{t("admin.evalHarness.steps.review")}</h3>
                <p className="admin-eval__sub">{t("admin.evalHarness.pickCaseToReview")}</p>
                <EvalCaseList
                  cases={reviewableResults.map((r) => r.case!).filter(Boolean)}
                  selectedId={reviewCaseId}
                  results={runDetail?.results}
                  onSelect={(id) => { setReviewCaseId(id); setReviewPanel("detail"); }}
                  t={t}
                />
              </>
            ) : selectedReviewRow?.case && runDetail && reviewDraft ? (
              <>
                <button type="button" className="admin-eval-case-detail__back admin-portal__btn admin-portal__btn--ghost" onClick={() => setReviewPanel("list")}>
                  {t("admin.evalHarness.backToList")}
                </button>
                <AdminEvalReviewForm
                  evalCase={selectedReviewRow.case}
                  run={runDetail.run}
                  result={selectedReviewRow}
                  draft={reviewDraft}
                  onChange={setReviewDraft}
                  onSave={(status) => void handleSaveReview(status)}
                  onAutoSave={triggerAutoSave}
                  saving={savingReview}
                  saveState={reviewSaveState}
                  onWriteEngineStandard={() => void handleWriteEngineStandard()}
                  engineWriteBusy={engineWriteBusy}
                  engineWriteOk={engineWriteOk}
                  canWriteEngineStandard={draftHasNineSchools(reviewDraft)}
                  t={t}
                />
              </>
            ) : null}
          </section>
        ) : null}

        {step === "history" ? (
          <section className="admin-eval__section admin-eval__section--flush">
            <EvalRunHistory
              token={token}
              locale={locale}
              runs={runs}
              cases={cases}
              selectedRunId={selectedRunId}
              selectedCaseId={selectedCaseId}
              onSelectRun={(runId) => void handleSelectRun(runId)}
              onSelectCase={setSelectedCaseId}
              onOpenReview={() => {
                if (selectedCaseId) setReviewCaseId(selectedCaseId);
                setReviewPanel("detail");
                setStep("review");
              }}
              t={t}
            />
          </section>
        ) : null}

        {step === "summary" ? (
          <section className="admin-eval__section">
            <h3 className="admin-eval__heading">{t("admin.evalHarness.steps.summary")}</h3>
            <p className="admin-eval__sub">{t("admin.evalHarness.summaryLead")}</p>
            {summaryLoading ? <p className="admin-eval__empty">{t("admin.evalHarness.summaryLoading")}</p> : null}
            {!summaryLoading ? (
              <>
                <ReviewSummaryList results={runDetail?.results ?? []} t={t} />
                <RunCorrectionSummary results={runDetail?.results ?? []} t={t} />
              </>
            ) : null}
          </section>
        ) : null}

        {step === "dashboard" ? (
          <section className="admin-eval__section">
            <div className="admin-eval-harness__section-head">
              <h3 className="admin-eval__heading">{t("admin.evalHarness.steps.dashboard")}</h3>
              <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={() => void refreshDashboard()}>
                {t("admin.evalHarness.refreshDashboard")}
              </button>
            </div>
            {dashboard ? <DashboardView dashboard={dashboard} t={t} /> : <p className="admin-eval__empty">{t("admin.evalHarness.dashboardEmpty")}</p>}
          </section>
        ) : null}

        {step === "export" ? (
          <section className="admin-eval__section">
            <h3 className="admin-eval__heading">{t("admin.evalHarness.steps.export")}</h3>
            <p className="admin-eval__sub">{t("admin.evalHarness.exportLead")}</p>
            <p className="admin-eval__sub admin-eval-harness__export-note">{t("admin.evalHarness.exportBulkNote")}</p>
            <div className="admin-eval-harness__export-grid">
              <button type="button" className="admin-eval-harness__export-card" disabled={!!exporting || generatedOkCount === 0} onClick={() => void handleExport("json", "generated")}>
                <strong>{exporting === "json-generated" ? t("admin.eval.exportingFeedback") : t("admin.evalHarness.exportGeneratedJsonTitle")}</strong>
                <span>{t("admin.evalHarness.exportGeneratedJsonHint", { n: String(generatedOkCount) })}</span>
              </button>
              <button type="button" className="admin-eval-harness__export-card" disabled={!!exporting || (dashboard?.reviewedCount ?? 0) === 0} onClick={() => void handleExport("json", "reviewed")}>
                <strong>{exporting === "json-reviewed" ? t("admin.eval.exportingFeedback") : t("admin.evalHarness.exportJson")}</strong>
                <span>{t("admin.evalHarness.exportJsonHint")}</span>
              </button>
              <button type="button" className="admin-eval-harness__export-card" disabled={!!exporting || (dashboard?.reviewedCount ?? 0) === 0} onClick={() => void handleExport("csv")}>
                <strong>{exporting === "csv" ? t("admin.eval.exportingFeedback") : t("admin.evalHarness.exportCsv")}</strong>
                <span>{t("admin.evalHarness.exportCsvHint")}</span>
              </button>
              <button type="button" className="admin-eval-harness__export-card" disabled={!!exporting || (dashboard?.reviewedCount ?? 0) === 0} onClick={() => void handleExport("summary")}>
                <strong>{exporting === "summary" ? t("admin.eval.exportingFeedback") : t("admin.evalHarness.exportSummary")}</strong>
                <span>{t("admin.evalHarness.exportSummaryHint")}</span>
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <footer className="admin-eval-harness__footer">
        {(() => {
          const stepIndex = STEPS.indexOf(step);
          const isLastStep = stepIndex >= STEPS.length - 1;
          return (
            <>
              <button
                type="button"
                className="admin-portal__btn admin-portal__btn--ghost"
                disabled={stepIndex === 0}
                onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)])}
              >
                {t("admin.evalHarness.prevStep")}
              </button>
              <button
                type="button"
                className="admin-portal__btn admin-portal__btn--primary"
                onClick={() => {
                  if (isLastStep) {
                    setLibraryPanel("list");
                    setStep("library");
                    queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
                    return;
                  }
                  setStep(STEPS[stepIndex + 1]);
                }}
              >
                {isLastStep ? t("admin.evalHarness.finishFlow") : t("admin.evalHarness.nextStep")}
              </button>
            </>
          );
        })()}
      </footer>
    </div>
  );
}

function ReviewSummaryList({ results, t }: { results: AdminEvalRunResult[]; t: (k: string, p?: Record<string, string>) => string }) {
  const reviewed = results.filter((r) => r.case && r.review);
  if (!reviewed.length) {
    const hasGenerated = results.some((r) => r.status === "ok" && r.case);
    return (
      <p className="admin-eval__empty">
        {hasGenerated ? t("admin.evalHarness.summaryNeedSave") : t("admin.evalHarness.summaryEmpty")}
      </p>
    );
  }

  const submittedCount = reviewed.filter(
    (r) => r.review?.status === "submitted" || r.review?.status === "approved",
  ).length;
  const draftCount = reviewed.filter((r) => r.review?.status === "draft").length;

  return (
    <>
      {draftCount > 0 && submittedCount === 0 ? (
        <p className="admin-eval-harness__notice admin-eval-harness__notice--warn">
          {t("admin.evalHarness.summaryDraftOnly")}
        </p>
      ) : null}
      <ul className="admin-eval__case-list">
        {reviewed.map((row) => {
          const fallback = buildInitialReviewDraft(row.case!, row, (k) => t(`admin.evalHarness.profile.${k}`));
          const draft = row.review ? reviewToDraft(row.review, fallback) : fallback;
          const avg = rubricAverage(draft.rubricScores);
          const statusLabel =
            row.review?.status === "submitted"
              ? t("admin.evalHarness.submitted")
              : row.review?.status === "approved"
                ? t("admin.evalHarness.approved")
                : t("admin.evalHarness.draftStatus");
          return (
            <li key={row.id} className="admin-eval__case-item">
              <div>
                <strong>{row.case?.title}</strong>
                <span className="admin-eval__tags">
                  {statusLabel}
                  {avg != null ? ` · ${t("admin.evalHarness.rubricAvg", { avg: avg.toFixed(1) })}` : ""}
                  {" · "}
                  {t("admin.evalHarness.reviewStats", {
                    schools: String(countSchoolCorrections(draft)),
                    profile: String(countProfileAdjustments(draft)),
                  })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function RunCorrectionSummary({
  results,
  t,
}: {
  results: AdminEvalRunResult[];
  t: (k: string, p?: Record<string, string>) => string;
}) {
  const submitted = results.filter((r) => r.case && r.review);
  if (!submitted.length) return null;

  const submittedOnly = submitted.filter(
    (r) => r.review?.status === "submitted" || r.review?.status === "approved",
  );
  const rowsForStats = submittedOnly.length ? submittedOnly : submitted;

  const categoryCounts: Record<string, number> = {};
  const profileAdjustCounts: Record<string, number> = {};
  let schoolCorrections = 0;

  for (const row of rowsForStats) {
    const draft = reviewToDraft(row.review!, buildInitialReviewDraft(row.case!, row, (k) => t(`admin.evalHarness.profile.${k}`)));
    schoolCorrections += countSchoolCorrections(draft);
    for (const dim of draft.profileDimensionReviews) {
      if (dim.aiScore != null && dim.counselorScore != null && dim.aiScore !== dim.counselorScore) {
        profileAdjustCounts[dim.key] = (profileAdjustCounts[dim.key] ?? 0) + 1;
      }
      if (dim.reasonCategory) {
        categoryCounts[dim.reasonCategory] = (categoryCounts[dim.reasonCategory] ?? 0) + 1;
      }
    }
  }

  const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topProfile = Object.entries(profileAdjustCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="admin-eval-dashboard">
      <h3>{t("admin.evalHarness.summaryCorrectionsTitle")}</h3>
      <p className="admin-eval__sub">
        {t("admin.evalHarness.summaryCorrectionsLead", { schools: String(schoolCorrections) })}
      </p>
      {topProfile.length ? (
        <>
          <h4>{t("admin.evalHarness.dashboardAdjustedDimensions")}</h4>
          <ul className="admin-eval-dashboard__list">
            {topProfile.map(([key, count]) => (
              <li key={key}>
                {t(`admin.evalHarness.profile.${key}`)}: {count}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {topCategories.length ? (
        <>
          <h4>{t("admin.evalHarness.dashboardCorrectionCategories")}</h4>
          <ul className="admin-eval-dashboard__list">
            {topCategories.map(([cat, count]) => (
              <li key={cat}>
                {t(`admin.evalHarness.reasonCategories.${cat}`)}: {count}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function DashboardView({ dashboard, t }: { dashboard: AdminEvalDashboard; t: (k: string, p?: Record<string, string>) => string }) {
  return (
    <div className="admin-eval-dashboard">
      <div className="admin-eval-dashboard__cards">
        <div className="admin-eval-dashboard__card">
          <span>{t("admin.evalHarness.dashboardReviewed")}</span>
          <strong>{dashboard.reviewedCount}</strong>
        </div>
        <div className="admin-eval-dashboard__card">
          <span>{t("admin.evalHarness.dashboardAvg")}</span>
          <strong>{dashboard.averageReportScore != null ? dashboard.averageReportScore.toFixed(2) : "—"}</strong>
        </div>
        <div className="admin-eval-dashboard__card">
          <span>{t("admin.evalHarness.dashboardTierRate")}</span>
          <strong>
            {dashboard.schoolTierAccuracyRate != null
              ? `${Math.round(dashboard.schoolTierAccuracyRate * 100)}%`
              : "—"}
          </strong>
        </div>
      </div>

      <div className="admin-eval-dashboard__sections">
        <section className="admin-eval-dashboard__section">
          <h4>{t("admin.evalHarness.dashboardByDimension")}</h4>
          <div className="admin-eval-dashboard__metric-grid">
            {RUBRIC_DIMENSIONS.map((key) => (
              <div key={key} className="admin-eval-dashboard__metric">
                <span>{t(`admin.evalHarness.rubric.${key}`)}</span>
                <strong>{dashboard.dimensionAverages[key] != null ? dashboard.dimensionAverages[key]!.toFixed(1) : "—"}</strong>
              </div>
            ))}
          </div>
        </section>

        {dashboard.byPromptVersion.length ? (
          <section className="admin-eval-dashboard__section">
            <h4>{t("admin.evalHarness.dashboardByPrompt")}</h4>
            <ul className="admin-eval-dashboard__list admin-eval-dashboard__list--compact">
              {dashboard.byPromptVersion.map((row) => (
                <li key={row.promptVersion}>
                  <strong>{row.promptVersion}</strong> · {row.reviewCount} · avg{" "}
                  {row.averageReportScore != null ? row.averageReportScore.toFixed(2) : "—"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {CORRECTION_REASON_CATEGORIES.some((cat) => (dashboard.correctionCategoryCounts[cat] ?? 0) > 0) ? (
          <section className="admin-eval-dashboard__section">
            <h4>{t("admin.evalHarness.dashboardCorrectionCategories")}</h4>
            <ul className="admin-eval-dashboard__list admin-eval-dashboard__list--compact">
              {CORRECTION_REASON_CATEGORIES.filter((cat) => (dashboard.correctionCategoryCounts[cat] ?? 0) > 0).map((cat) => (
                <li key={cat}>
                  {t(`admin.evalHarness.reasonCategories.${cat}`)} · {dashboard.correctionCategoryCounts[cat]}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {PROFILE_DIMENSION_KEYS.some((key) => (dashboard.adjustedProfileCounts[key] ?? 0) > 0) ? (
          <section className="admin-eval-dashboard__section">
            <h4>{t("admin.evalHarness.dashboardAdjustedDimensions")}</h4>
            <ul className="admin-eval-dashboard__list admin-eval-dashboard__list--compact">
              {PROFILE_DIMENSION_KEYS.filter((key) => (dashboard.adjustedProfileCounts[key] ?? 0) > 0).map((key) => (
                <li key={key}>
                  {t(`admin.evalHarness.profile.${key}`)} · {dashboard.adjustedProfileCounts[key]}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
