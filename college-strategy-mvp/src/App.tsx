import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormState, ReportDiff, ReportPayload, SupplementaryNote } from "./types";
import { getEffectiveIntake } from "./lib/intakeTerm";
import { buildReportApiBody } from "./lib/reportApiBody";
import { collectHighlightKeys, compareReports, reportDiffIsEmpty } from "./lib/reportDiff";
import { apiUrl } from "./lib/apiBase";
import { clearUnlockStorage, ReportView, writeUnlockToStorage } from "./ReportView";
import { BrandLogo } from "./components/BrandLogo";
import { FormLiveSummary, GuidedStep1, GuidedStep2, GuidedStep3, type GuideTouch } from "./components/GuidedQuestionnaire";
import { FullscreenLogoMarquee } from "./components/FullscreenLogoMarquee";
import { useLanguage } from "./i18n/LanguageContext";
import { useAuth } from "./auth/AuthContext";
import { AuthModal } from "./components/auth/AuthModal";
import { AccountHome } from "./components/auth/AccountHome";
import { AuthMenuButton } from "./components/auth/AuthMenuButton";
import { saveUserSession } from "./lib/supabase/accounts";
import { clearPendingSave, readPendingSave, writePendingSave } from "./lib/pendingSave";
import "./App.css";

const initialForm: FormState = {
  intakeTerm: "",
  intakeOtherDetail: "",
  applicantIdentity: "",
  budget: "",
  testing: "",
  satScore: "",
  actScore: "",
  highSchoolSystem: "",
  gpa: "",
  majorPrimary: "",
  majorSecondary: "",
  schoolSize: "",
  geoPrefs: [],
  activities: "",
  riskStyle: "",
  dealbreakers: "",
};

const LOADING_TIP_KEYS = ["app.loading.tip0", "app.loading.tip1", "app.loading.tip2", "app.loading.tip3"] as const;

function validateStep(step: number, f: FormState, tr: (path: string) => string): string | null {
  if (step === 1) {
    if (!getEffectiveIntake(f).trim()) return tr("validation.intake");
    if (!f.applicantIdentity) return tr("validation.identity");
    if (!f.budget) return tr("validation.budget");
    if (!f.testing) return tr("validation.testing");
    if (f.testing === "will_submit") {
      const hasSat = f.satScore.trim().length > 0;
      const hasAct = f.actScore.trim().length > 0;
      if (!hasSat && !hasAct) return tr("validation.testScore");
    }
  }
  if (step === 2) {
    if (!f.highSchoolSystem) return tr("validation.hs");
    if (!f.gpa.trim()) return tr("validation.gpa");
    if (!f.majorPrimary.trim()) return tr("validation.major");
    if (!f.schoolSize) return tr("validation.schoolSize");
    if (f.geoPrefs.length === 0) return tr("validation.geo");
  }
  if (step === 3) {
    if (!f.riskStyle) return tr("validation.risk");
    if (f.activities.length > 600) return tr("validation.activitiesLen");
  }
  return null;
}

export default function App() {
  const { t, locale } = useLanguage();
  const [flowStarted, setFlowStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [guideTouch, setGuideTouch] = useState<GuideTouch>({});
  const [view, setView] = useState<"form" | "report" | "account">("form");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentApplicationId, setCurrentApplicationId] = useState<string | null>(null);
  const [saveBannerDismissed, setSaveBannerDismissed] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const { user, loading: authLoading, configured: authConfigured } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const submitLockRef = useRef(false);
  const applicationHubTriggerRef = useRef<HTMLButtonElement>(null);
  const [applicationHubOpen, setApplicationHubOpen] = useState(false);
  const [reportRefreshing, setReportRefreshing] = useState(false);
  const [reportDiff, setReportDiff] = useState<ReportDiff | null>(null);
  const [highlightSchoolKeys, setHighlightSchoolKeys] = useState<Set<string>>(new Set());
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [subtleRefreshNotice, setSubtleRefreshNotice] = useState<string | null>(null);
  const refreshLockRef = useRef(false);
  /** 五维「下一步」下提交的补充；与信息缺口触发的刷新合并后一并 POST */
  const profileFiveSupplementaryRef = useRef<SupplementaryNote[]>([]);
  const highlightTimerRef = useRef<number | null>(null);

  const stepError = useMemo(() => validateStep(step, form, t), [step, form, t]);

  const persistToCloud = useCallback(
    async (payload: {
      formState: FormState;
      reportPayload: ReportPayload;
      unlocked?: boolean;
      applicationId?: string | null;
    }) => {
      if (!user || !authConfigured) return false;
      try {
        const { applicationId } = await saveUserSession({
          applicationId: payload.applicationId ?? currentApplicationId,
          form: payload.formState,
          locale,
          report: payload.reportPayload,
          supplementaryNotes: profileFiveSupplementaryRef.current,
          reportUnlocked: payload.unlocked ?? reportUnlocked,
        });
        setCurrentApplicationId(applicationId);
        clearPendingSave();
        setSessionSaved(true);
        setSaveNotice(t("auth.saveSuccess"));
        return true;
      } catch {
        setSaveNotice(t("auth.saveErr"));
        return false;
      }
    },
    [user, authConfigured, currentApplicationId, locale, reportUnlocked, t],
  );

  useEffect(() => {
    if (authLoading || !user) return;
    const pending = readPendingSave();
    if (!pending) return;
    setForm(pending.form);
    setReport(pending.report);
    setReportUnlocked(Boolean(pending.reportUnlocked));
    setView("report");
    void persistToCloud({
      formState: pending.form,
      reportPayload: pending.report,
      unlocked: pending.reportUnlocked,
    });
  }, [authLoading, user, persistToCloud]);

  useEffect(() => {
    if (view !== "account" || authLoading || user) return;
    setView(report ? "report" : "form");
    setAuthModalOpen(true);
  }, [view, authLoading, user, report]);

  useEffect(() => {
    if (!loading) return;
    setLoadingTipIndex(0);
    const id = window.setInterval(() => {
      setLoadingTipIndex((i) => (i + 1) % LOADING_TIP_KEYS.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current != null) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  /** 首屏介绍态：压低底层校徽墙视觉权重 */
  useEffect(() => {
    const root = document.documentElement;
    if (view !== "form") {
      root.removeAttribute("data-intro");
      return;
    }
    if (!flowStarted) root.setAttribute("data-intro", "");
    else root.removeAttribute("data-intro");
    return () => root.removeAttribute("data-intro");
  }, [flowStarted, view]);

  /** 有底部固定免责声明时：底层走马灯整体上移，避免被遮挡 */
  useEffect(() => {
    const root = document.documentElement;
    if (view === "form") root.setAttribute("data-app-disclaimer", "");
    else root.removeAttribute("data-app-disclaimer");
    return () => root.removeAttribute("data-app-disclaimer");
  }, [view]);

  function update<K extends keyof FormState>(key: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [key]: v }));
  }

  const markGuideTouch = useCallback((key: keyof GuideTouch) => {
    setGuideTouch((s) => ({ ...s, [key]: true }));
  }, []);

  useEffect(() => {
    setGuideTouch({});
  }, [step]);

  async function submitReport() {
    if (submitLockRef.current) return;
    const e1 = validateStep(1, form, t);
    const e2 = validateStep(2, form, t);
    const e3 = validateStep(3, form, t);
    const first = e1 || e2 || e3;
    if (first) {
      setErr(first);
      return;
    }
    setErr(null);
    submitLockRef.current = true;
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch(apiUrl("/api/report"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReportApiBody(form, undefined, locale)),
      });
      const llmMs = res.headers.get("X-LLM-Duration-Ms");
      const data = await res.json();
      if (import.meta.env.DEV) {
        const total = Math.round(performance.now() - t0);
        console.debug(
          `[report] client_total_ms=${total}` + (llmMs != null ? ` server_llm_ms=${llmMs}` : ""),
        );
      }
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : t("app.errGenerate"));
        return;
      }
      setReportDiff(null);
      setHighlightSchoolKeys(new Set());
      setRefreshError(null);
      setSubtleRefreshNotice(null);
      profileFiveSupplementaryRef.current = [];
      const nextReport = data as ReportPayload;
      setReport(nextReport);
      setView("report");
      clearUnlockStorage();
      setReportUnlocked(false);
      setSessionSaved(false);
      setSaveNotice(null);
      writePendingSave({ form, locale, report: nextReport, reportUnlocked: false });
      if (user) {
        void persistToCloud({ formState: form, reportPayload: nextReport, unlocked: false });
      }
      queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch {
      setErr(t("app.errNetwork"));
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  }

  function next() {
    const e = validateStep(step, form, t);
    setErr(e);
    if (e) return;
    setStep((s) => Math.min(3, s + 1));
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function prev() {
    setErr(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function dismissReportDiff() {
    setReportDiff(null);
    setHighlightSchoolKeys(new Set());
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }

  async function refreshReportWithGapNotes(gapNotes: SupplementaryNote[]) {
    if (!report || refreshLockRef.current) return;
    refreshLockRef.current = true;
    setRefreshError(null);
    setSubtleRefreshNotice(null);
    setReportRefreshing(true);
    const prev = report;
    const merged = [...gapNotes, ...profileFiveSupplementaryRef.current];
    try {
      const res = await fetch(apiUrl("/api/report"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReportApiBody(form, merged.length > 0 ? merged : undefined, locale)),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefreshError(typeof data.error === "string" ? data.error : t("app.errGenerate"));
        return;
      }
      const next = data as ReportPayload;
      setReport(next);
      if (user) {
        void persistToCloud({ formState: form, reportPayload: next, unlocked: reportUnlocked });
      } else {
        writePendingSave({ form, locale, report: next, reportUnlocked });
      }
      const diff = compareReports(prev, next);
      if (reportDiffIsEmpty(diff)) {
        setReportDiff(null);
        setHighlightSchoolKeys(new Set());
        setSubtleRefreshNotice(t("report.diff.subtle"));
        window.setTimeout(() => setSubtleRefreshNotice(null), 6500);
      } else {
        setReportDiff(diff);
        const keys = collectHighlightKeys(diff);
        setHighlightSchoolKeys(keys);
        if (highlightTimerRef.current != null) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => {
          setHighlightSchoolKeys(new Set());
          highlightTimerRef.current = null;
        }, 12000);
      }
    } catch {
      setRefreshError(t("app.errNetwork"));
    } finally {
      refreshLockRef.current = false;
      setReportRefreshing(false);
    }
  }

  async function commitProfileFiveNotesAndRefresh(notes: SupplementaryNote[]) {
    profileFiveSupplementaryRef.current = notes;
    await refreshReportWithGapNotes([]);
  }

  if (view === "account" && user) {
    return (
      <>
        <AccountHome
          onBack={() => {
            if (report) setView("report");
            else if (flowStarted) setView("form");
            else setView("form");
          }}
          onNewApplication={() => {
            setForm(initialForm);
            setReport(null);
            setCurrentApplicationId(null);
            setStep(1);
            setFlowStarted(true);
            setView("form");
            setSessionSaved(false);
            setSaveBannerDismissed(false);
            clearPendingSave();
          }}
          onEditForm={({ form: f, applicationId }) => {
            setForm(f);
            setCurrentApplicationId(applicationId);
            setReport(null);
            setStep(1);
            setFlowStarted(true);
            setView("form");
          }}
          onOpenReport={({ form: f, report: r, applicationId, reportUnlocked: u }) => {
            setForm(f);
            setReport(r);
            setCurrentApplicationId(applicationId);
            if (u) {
              writeUnlockToStorage();
              setReportUnlocked(true);
            } else {
              clearUnlockStorage();
              setReportUnlocked(false);
            }
            setView("report");
            queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          }}
        />
        <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} successHint={saveNotice} />
      </>
    );
  }

  if (view === "report" && report) {
    return (
      <>
      <ReportView
        report={report}
        form={form}
        unlocked={reportUnlocked}
        authConfigured={authConfigured}
        isAuthenticated={Boolean(user)}
        showSaveBanner={authConfigured && !user && !saveBannerDismissed && !authLoading}
        sessionSaved={sessionSaved}
        onRequestSignIn={() => setAuthModalOpen(true)}
        onOpenAccount={() => setView("account")}
        onDismissSaveBanner={() => setSaveBannerDismissed(true)}
        reportRefreshing={reportRefreshing}
        refreshError={refreshError}
        onClearRefreshError={() => setRefreshError(null)}
        subtleRefreshNotice={subtleRefreshNotice}
        onClearSubtleRefreshNotice={() => setSubtleRefreshNotice(null)}
        reportDiff={reportDiff}
        onDismissReportDiff={dismissReportDiff}
        highlightSchoolKeys={highlightSchoolKeys}
        onRefreshReportWithGaps={refreshReportWithGapNotes}
        onCommitProfileFiveNotes={commitProfileFiveNotesAndRefresh}
        onUnlock={() => {
          writeUnlockToStorage();
          setReportUnlocked(true);
          if (user && report) {
            void persistToCloud({ formState: form, reportPayload: report, unlocked: true });
          }
        }}
        onReset={() => {
          clearUnlockStorage();
          setReportUnlocked(false);
          profileFiveSupplementaryRef.current = [];
          setCurrentApplicationId(null);
          setSessionSaved(false);
          setSaveBannerDismissed(false);
          clearPendingSave();
          setView("form");
          setReport(null);
          setStep(1);
          setFlowStarted(false);
          setApplicationHubOpen(false);
          setReportDiff(null);
          setHighlightSchoolKeys(new Set());
          setRefreshError(null);
          setSubtleRefreshNotice(null);
          setSaveNotice(null);
          if (highlightTimerRef.current != null) {
            window.clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = null;
          }
        }}
      />
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} successHint={saveNotice} />
      </>
    );
  }

  if (!flowStarted) {
    return (
      <div className="app app--landing">
        <div className="landing-sheet">
          <header className="landing-hero">
            <div className="landing-hero__top">
              <BrandLogo className="landing-logo" />
              <AuthMenuButton onSignIn={() => setAuthModalOpen(true)} onOpenAccount={() => setView("account")} />
            </div>
            <div className="landing-copy">
              <h1 className="landing-title">
                <span className="landing-title__l1">{t("app.hero.titleLine1")}</span>
                <span className="landing-title__l2">{t("app.hero.titleLine2")}</span>
              </h1>
              <p className="landing-lead">{t("app.hero.lead")}</p>
            </div>
          </header>

          <div className="landing-cta-wrap">
            <button
              type="button"
              className="btn btn-primary btn-block btn-cta-landing"
              onClick={() => {
                setApplicationHubOpen(false);
                setFlowStarted(true);
                queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
              }}
            >
              {t("app.welcome.start")}
            </button>
            <p className="landing-trust">{t("app.welcome.meta")}</p>
          </div>

          <div className="app-links-entry-wrap">
            <button
              ref={applicationHubTriggerRef}
              type="button"
              className="app-links-entry"
              aria-expanded={applicationHubOpen}
              aria-controls="application-hub-dialog"
              onClick={() => setApplicationHubOpen(true)}
            >
              {t("appLinks.entry")}
            </button>
          </div>
        </div>

        <FullscreenLogoMarquee
          open={applicationHubOpen}
          onClose={() => {
            setApplicationHubOpen(false);
            queueMicrotask(() => applicationHubTriggerRef.current?.focus());
          }}
        />

        <footer className="app-disclaimer-fixed" role="contentinfo">
          <p>{t("app.disclaimer")}</p>
        </footer>
        <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} successHint={saveNotice} />
      </div>
    );
  }

  return (
    <>
    <div className="app app--flow">
      <header className="hero--compact">
        <BrandLogo />
        <div className="hero--compact-copy">
          <h1>{t("app.flow.headline")}</h1>
          <p className="hero-flow-tagline">{t("app.flow.tagline")}</p>
        </div>
        <AuthMenuButton onSignIn={() => setAuthModalOpen(true)} onOpenAccount={() => setView("account")} />
      </header>

      <p className="steps-caption" aria-live="polite">
        {t("app.steps.caption", { step })}
        {step === 3 ? t("app.steps.captionFinal") : t("app.steps.captionMid")}
      </p>

      <div className="steps" aria-hidden>
        {[1, 2, 3].map((n) => (
          <div key={n} className={`step-dot ${step >= n ? "on" : ""}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="card card--step">
          <h2>{t("steps.1.title")}</h2>
          <p className="step-lead">{t("steps.1.lead")}</p>
          <GuidedStep1 form={form} update={update} t={t} />
          <FormLiveSummary form={form} t={t} />
        </div>
      )}

      {step === 2 && (
        <div className="card card--step">
          <h2>{t("steps.2.title")}</h2>
          <p className="step-lead">{t("steps.2.lead")}</p>
          <GuidedStep2 form={form} update={update} t={t} guideTouch={guideTouch} markTouch={markGuideTouch} />
          <FormLiveSummary form={form} t={t} />
        </div>
      )}

      {step === 3 && (
        <div className="card card--step">
          <h2>{t("steps.3.title")}</h2>
          <p className="step-lead">{t("steps.3.lead")}</p>
          <GuidedStep3 form={form} update={update} t={t} guideTouch={guideTouch} markTouch={markGuideTouch} />
          <FormLiveSummary form={form} t={t} />
        </div>
      )}

      {err && <div className="error">{err}</div>}

      <div className="actions">
        {step === 1 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setApplicationHubOpen(false);
              setFlowStarted(false);
              setErr(null);
            }}
            disabled={loading}
          >
            {t("app.actions.backIntro")}
          </button>
        )}
        {step > 1 && (
          <button type="button" className="btn btn-secondary" onClick={prev} disabled={loading}>
            {t("app.actions.prev")}
          </button>
        )}
        {step < 3 && (
          <button type="button" className="btn btn-primary" onClick={next} disabled={loading}>
            {step === 1 ? t("app.actions.next2") : t("app.actions.next3")}
          </button>
        )}
        {step === 3 && (
          <button type="button" className="btn btn-primary" onClick={submitReport} disabled={loading || !!stepError}>
            {loading ? t("app.actions.generating") : t("app.actions.submit")}
          </button>
        )}
      </div>

      {step === 3 && stepError && <p className="field-hint warn">{t("app.hintStep3")}</p>}

      {loading && (
        <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="loading-card">
            <div className="loading-spinner" aria-hidden />
            <p className="loading-title">{t("app.loading.title")}</p>
            <p className="loading-tip">{t(LOADING_TIP_KEYS[loadingTipIndex])}</p>
            <p className="loading-note">{t("app.loading.note")}</p>
          </div>
        </div>
      )}

      <footer className="app-disclaimer-fixed" role="contentinfo">
        <p>{t("app.disclaimer")}</p>
      </footer>
    </div>
    <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} successHint={saveNotice} />
    </>
  );
}
