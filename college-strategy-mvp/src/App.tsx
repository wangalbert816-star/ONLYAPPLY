import { useEffect, useMemo, useRef, useState } from "react";
import type { FormState, GeoPref, ReportDiff, ReportPayload, SupplementaryNote } from "./types";
import { buildReportApiBody } from "./lib/reportApiBody";
import { collectHighlightKeys, compareReports, reportDiffIsEmpty } from "./lib/reportDiff";
import { apiUrl } from "./lib/apiBase";
import { clearUnlockStorage, ReportView, writeUnlockToStorage } from "./ReportView";
import { BrandLogo } from "./components/BrandLogo";
import { UniversityLogoMarquee } from "./components/UniversityLogoMarquee";
import { useLanguage } from "./i18n/LanguageContext";
import "./App.css";

const initialForm: FormState = {
  intakeTerm: "2026 Fall",
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

function toggleGeo(prefs: GeoPref[], g: GeoPref): GeoPref[] {
  if (g === "any") return prefs.includes("any") ? [] : ["any"];
  const withoutAny = prefs.filter((x) => x !== "any");
  if (withoutAny.includes(g)) return withoutAny.filter((x) => x !== g);
  return [...withoutAny, g];
}

function validateStep(step: number, f: FormState, tr: (path: string) => string): string | null {
  if (step === 1) {
    if (!f.intakeTerm.trim()) return tr("validation.intake");
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
  const { t } = useLanguage();
  const [flowStarted, setFlowStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [view, setView] = useState<"form" | "report">("form");
  const [loading, setLoading] = useState(false);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const submitLockRef = useRef(false);
  const [reportRefreshing, setReportRefreshing] = useState(false);
  const [reportDiff, setReportDiff] = useState<ReportDiff | null>(null);
  const [highlightSchoolKeys, setHighlightSchoolKeys] = useState<Set<string>>(new Set());
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [subtleRefreshNotice, setSubtleRefreshNotice] = useState<string | null>(null);
  const refreshLockRef = useRef(false);
  const highlightTimerRef = useRef<number | null>(null);

  const stepError = useMemo(() => validateStep(step, form, t), [step, form, t]);

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

  function update<K extends keyof FormState>(key: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [key]: v }));
  }

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
        body: JSON.stringify(buildReportApiBody(form)),
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
      setReport(data as ReportPayload);
      setView("report");
      clearUnlockStorage();
      setReportUnlocked(false);
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

  async function refreshReportWithGapNotes(notes: SupplementaryNote[]) {
    if (!report || refreshLockRef.current) return;
    refreshLockRef.current = true;
    setRefreshError(null);
    setSubtleRefreshNotice(null);
    setReportRefreshing(true);
    const prev = report;
    try {
      const res = await fetch(apiUrl("/api/report"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReportApiBody(form, notes)),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefreshError(typeof data.error === "string" ? data.error : t("app.errGenerate"));
        return;
      }
      const next = data as ReportPayload;
      setReport(next);
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

  if (view === "report" && report) {
    return (
      <ReportView
        report={report}
        unlocked={reportUnlocked}
        reportRefreshing={reportRefreshing}
        refreshError={refreshError}
        onClearRefreshError={() => setRefreshError(null)}
        subtleRefreshNotice={subtleRefreshNotice}
        onClearSubtleRefreshNotice={() => setSubtleRefreshNotice(null)}
        reportDiff={reportDiff}
        onDismissReportDiff={dismissReportDiff}
        highlightSchoolKeys={highlightSchoolKeys}
        onRefreshReportWithGaps={refreshReportWithGapNotes}
        onUnlock={() => {
          writeUnlockToStorage();
          setReportUnlocked(true);
        }}
        onReset={() => {
          clearUnlockStorage();
          setReportUnlocked(false);
          setView("form");
          setReport(null);
          setStep(1);
          setFlowStarted(false);
          setReportDiff(null);
          setHighlightSchoolKeys(new Set());
          setRefreshError(null);
          setSubtleRefreshNotice(null);
          if (highlightTimerRef.current != null) {
            window.clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = null;
          }
        }}
      />
    );
  }

  if (!flowStarted) {
    return (
      <div className="app">
        <header className="hero">
          <BrandLogo />
          <h1>{t("app.hero.title")}</h1>
          <p>{t("app.hero.lead")}</p>
        </header>

        <UniversityLogoMarquee />

        <section className="card welcome-card">
          <h2 className="welcome-title">{t("app.welcome.title")}</h2>
          <ol className="welcome-steps">
            <li>
              <strong>{t("app.welcome.s1t")}</strong>
              <span>{t("app.welcome.s1d")}</span>
            </li>
            <li>
              <strong>{t("app.welcome.s2t")}</strong>
              <span>{t("app.welcome.s2d")}</span>
            </li>
            <li>
              <strong>{t("app.welcome.s3t")}</strong>
              <span>{t("app.welcome.s3d")}</span>
            </li>
          </ol>
          <p className="welcome-meta">{t("app.welcome.meta")}</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              setFlowStarted(true);
              queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
            }}
          >
            {t("app.welcome.start")}
          </button>
        </section>

        <p className="disclaimer">{t("app.disclaimer")}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="hero">
        <BrandLogo />
        <h1>{t("app.hero.title")}</h1>
        <p>{t("app.hero.lead")}</p>
      </header>

      <UniversityLogoMarquee />

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
        <div className="card">
          <h2>{t("steps.1.title")}</h2>
          <p className="step-lead">{t("steps.1.lead")}</p>

          <div className="field">
            <label htmlFor="intakeTerm">{t("form.intake")}</label>
            <select id="intakeTerm" value={form.intakeTerm} onChange={(e) => update("intakeTerm", e.target.value)}>
              <option value="2026 Fall">2026 Fall</option>
              <option value="2027 Fall">2027 Fall</option>
              <option value="其他">{t("form.opt.intakeOther")}</option>
            </select>
          </div>

          <div className="field">
            <label>{t("form.identity")}</label>
            <select
              value={form.applicantIdentity}
              onChange={(e) => update("applicantIdentity", e.target.value as FormState["applicantIdentity"])}
            >
              <option value="">{t("form.opt.choose")}</option>
              <option value="intl">{t("form.opt.idIntl")}</option>
              <option value="us_citizen">{t("form.opt.idUs")}</option>
              <option value="other">{t("form.opt.idOther")}</option>
            </select>
          </div>

          <div className="field">
            <label>{t("form.budget")}</label>
            <select value={form.budget} onChange={(e) => update("budget", e.target.value as FormState["budget"])}>
              <option value="">{t("form.opt.choose")}</option>
              <option value="full_pay">{t("form.opt.budgetFull")}</option>
              <option value="need_aid">{t("form.opt.budgetAid")}</option>
              <option value="unsure">{t("form.opt.budgetUnsure")}</option>
            </select>
          </div>

          <div className="field">
            <label>{t("form.testing")}</label>
            <select value={form.testing} onChange={(e) => update("testing", e.target.value as FormState["testing"])}>
              <option value="">{t("form.opt.choose")}</option>
              <option value="test_optional">{t("form.opt.testOpt")}</option>
              <option value="will_submit">{t("form.opt.testSubmit")}</option>
            </select>
          </div>

          {form.testing === "will_submit" && (
            <>
              <div className="field">
                <label htmlFor="sat">{t("form.sat")}</label>
                <input
                  id="sat"
                  type="text"
                  placeholder={t("form.placeholder.sat")}
                  value={form.satScore}
                  onChange={(e) => update("satScore", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="act">{t("form.act")}</label>
                <input
                  id="act"
                  type="text"
                  placeholder={t("form.placeholder.act")}
                  value={form.actScore}
                  onChange={(e) => update("actScore", e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>{t("steps.2.title")}</h2>
          <p className="step-lead">{t("steps.2.lead")}</p>

          <div className="field">
            <label>{t("form.hs")}</label>
            <select value={form.highSchoolSystem} onChange={(e) => update("highSchoolSystem", e.target.value)}>
              <option value="">{t("form.opt.choose")}</option>
              <option value="国内普高">{t("form.opt.hsCn")}</option>
              <option value="美高">{t("form.opt.hsUs")}</option>
              <option value="IB">{t("form.opt.hsIb")}</option>
              <option value="A-Level">{t("form.opt.hsAl")}</option>
              <option value="AP体系">{t("form.opt.hsAp")}</option>
              <option value="其他">{t("form.opt.hsOther")}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="gpa">{t("form.gpa")}</label>
            <textarea
              id="gpa"
              placeholder={t("form.placeholder.gpa")}
              value={form.gpa}
              onChange={(e) => update("gpa", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="major">{t("form.major")}</label>
            <input
              id="major"
              type="text"
              placeholder={t("form.placeholder.major")}
              value={form.majorPrimary}
              onChange={(e) => update("majorPrimary", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="major2">{t("form.major2")}</label>
            <input id="major2" type="text" value={form.majorSecondary} onChange={(e) => update("majorSecondary", e.target.value)} />
          </div>

          <div className="field">
            <label>{t("form.schoolSize")}</label>
            <select value={form.schoolSize} onChange={(e) => update("schoolSize", e.target.value as FormState["schoolSize"])}>
              <option value="">{t("form.opt.choose")}</option>
              <option value="small">{t("form.opt.sizeS")}</option>
              <option value="medium">{t("form.opt.sizeM")}</option>
              <option value="large">{t("form.opt.sizeL")}</option>
              <option value="any">{t("form.opt.sizeAny")}</option>
            </select>
          </div>

          <div className="field">
            <label>{t("form.geo")}</label>
            <div className="row-check">
              {(["west", "east", "south", "midwest", "great_lakes", "any"] as const).map((g) => (
                <label key={g}>
                  <input
                    type="checkbox"
                    checked={form.geoPrefs.includes(g)}
                    onChange={() => update("geoPrefs", toggleGeo(form.geoPrefs, g))}
                  />
                  {t(`geo.${g}`)}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>{t("steps.3.title")}</h2>
          <p className="step-lead">{t("steps.3.lead")}</p>

          <div className="field">
            <label htmlFor="actv">{t("form.activities")}</label>
            <textarea
              id="actv"
              maxLength={600}
              placeholder={t("form.placeholder.activities")}
              value={form.activities}
              onChange={(e) => update("activities", e.target.value)}
            />
            <small>{form.activities.length}/600</small>
          </div>

          <div className="field">
            <label>{t("form.risk")}</label>
            <select value={form.riskStyle} onChange={(e) => update("riskStyle", e.target.value as FormState["riskStyle"])}>
              <option value="">{t("form.opt.choose")}</option>
              <option value="conservative">{t("form.opt.riskCon")}</option>
              <option value="balanced">{t("form.opt.riskBal")}</option>
              <option value="aggressive">{t("form.opt.riskAgg")}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="deal">{t("form.deal")}</label>
            <input
              id="deal"
              type="text"
              placeholder={t("form.placeholder.deal")}
              value={form.dealbreakers}
              onChange={(e) => update("dealbreakers", e.target.value)}
            />
          </div>
        </div>
      )}

      {err && <div className="error">{err}</div>}

      <div className="actions">
        {step === 1 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
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

      <p className="disclaimer">{t("app.disclaimer")}</p>
    </div>
  );
}
