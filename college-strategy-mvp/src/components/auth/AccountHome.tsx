import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  deleteApplication,
  getApplicationReports,
  listApplications,
  type ApplicationListItem,
  type SavedReportRow,
} from "../../lib/supabase/accounts";
import { formatSupabaseError } from "../../lib/supabase/errors";
import { buildBiggestGapBlock, buildOverallVerdict } from "../../lib/decisionReport";
import { buildFiveDimensionProfile, type ProfileDimensionKey } from "../../lib/fiveDimensionProfile";
import type { FormState, ReportPayload, SupplementaryNote } from "../../types";
import { BrandLogo } from "../BrandLogo";
import "./AccountHome.css";

type Props = {
  unlockedApplicationIds: readonly string[];
  onBack: () => void;
  onOpenReport: (payload: {
    form: FormState;
    report: ReportPayload;
    applicationId: string;
    reportId: string;
    supplementaryNotes?: SupplementaryNote[];
    reportUnlocked: boolean;
  }) => void;
  onEditForm: (payload: { form: FormState; applicationId: string }) => void;
  onNewApplication: () => void;
  onOpenAppLinks: (e: MouseEvent<HTMLButtonElement>) => void;
};

function dimensionLabel(key: ProfileDimensionKey, locale: "zh" | "en") {
  const zh: Record<ProfileDimensionKey, string> = {
    academic: "学术定位",
    testing: "标化策略",
    activities: "活动主线",
    essays: "文书叙事",
    strategy: "选校策略",
  };
  const en: Record<ProfileDimensionKey, string> = {
    academic: "Academic positioning",
    testing: "Testing strategy",
    activities: "Activity spine",
    essays: "Essay narrative",
    strategy: "List strategy",
  };
  return (locale === "en" ? en : zh)[key];
}

function compactText(value: string, max = 96) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function optionLabel(kind: "identity" | "budget" | "testing" | "size" | "risk" | "geo", value: string, locale: "zh" | "en") {
  const zh = {
    identity: { intl: "国际生", us_citizen: "美国身份", other: "其他身份" },
    budget: { full_pay: "可全自费", need_aid: "需要奖助", unsure: "暂不确定" },
    testing: { test_optional: "Test-Optional / 暂不提交", will_submit: "计划提交 SAT / ACT" },
    size: { small: "小型校园", medium: "中等规模", large: "大型校园", any: "都可以" },
    risk: { conservative: "偏保守", balanced: "平衡", aggressive: "偏进取" },
    geo: { west: "西海岸", east: "东海岸", south: "南部", midwest: "中西部", great_lakes: "五大湖", any: "不限地区" },
  };
  const en = {
    identity: { intl: "International", us_citizen: "U.S. citizen / resident", other: "Other identity" },
    budget: { full_pay: "Full-pay possible", need_aid: "Needs aid", unsure: "Not sure yet" },
    testing: { test_optional: "Test-optional / not submitting", will_submit: "Planning to submit SAT / ACT" },
    size: { small: "Small campus", medium: "Medium campus", large: "Large campus", any: "Any size" },
    risk: { conservative: "Conservative", balanced: "Balanced", aggressive: "Aggressive" },
    geo: { west: "West", east: "East", south: "South", midwest: "Midwest", great_lakes: "Great Lakes", any: "Any region" },
  };
  const table = locale === "en" ? en : zh;
  return (table[kind] as Record<string, string>)[value] ?? value;
}

function buildApplicationInfoItems(form: FormState, locale: "zh" | "en", t: ReturnType<typeof useLanguage>["t"]) {
  const intake = form.intakeTerm === "other" ? form.intakeOtherDetail : form.intakeTerm;
  const testScores = [form.satScore ? `SAT ${form.satScore}` : "", form.actScore ? `ACT ${form.actScore}` : ""]
    .filter(Boolean)
    .join(" / ");
  const testing = [
    form.testing ? optionLabel("testing", form.testing, locale) : "",
    testScores,
  ]
    .filter(Boolean)
    .join(" · ");
  const geo = form.geoPrefs.map((x) => optionLabel("geo", x, locale)).join(locale === "en" ? ", " : "、");

  return [
    { label: t("auth.accountInfoIntake"), value: compactText(intake) },
    { label: t("auth.accountInfoGpa"), value: compactText(form.gpa) },
    { label: t("auth.accountInfoTesting"), value: compactText(testing) },
    { label: t("auth.accountInfoSchoolSystem"), value: compactText(form.highSchoolSystem) },
    { label: t("auth.accountInfoMajor"), value: compactText([form.majorPrimary, form.majorSecondary].filter(Boolean).join(" / ")) },
    { label: t("auth.accountInfoIdentity"), value: form.applicantIdentity ? optionLabel("identity", form.applicantIdentity, locale) : "" },
    { label: t("auth.accountInfoEnvironment"), value: compactText([form.citizenship ?? "", form.residenceRegion ?? ""].filter(Boolean).join(" / ")) },
    { label: t("auth.accountInfoBudget"), value: form.budget ? optionLabel("budget", form.budget, locale) : "" },
    { label: t("auth.accountInfoActivities"), value: compactText(form.activities) },
    { label: t("auth.accountInfoPreferences"), value: compactText([form.schoolSize ? optionLabel("size", form.schoolSize, locale) : "", geo].filter(Boolean).join(" · ")) },
    { label: t("auth.accountInfoRisk"), value: form.riskStyle ? optionLabel("risk", form.riskStyle, locale) : "" },
    { label: t("auth.accountInfoDealbreakers"), value: compactText(form.dealbreakers) },
  ].filter((item) => item.value);
}

export function AccountHome({
  unlockedApplicationIds,
  onBack,
  onOpenReport,
  onEditForm,
  onNewApplication,
  onOpenAppLinks,
}: Props) {
  const { t, locale } = useLanguage();
  const { user, signOut, configured } = useAuth();
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportsByApp, setReportsByApp] = useState<Record<string, SavedReportRow[]>>({});
  const [loadingReports, setLoadingReports] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const currentApp = apps[0] ?? null;
  const currentReports = currentApp ? reportsByApp[currentApp.id] ?? [] : [];
  const latestReport = currentReports[0] ?? null;
  const status = useMemo(() => {
    if (!currentApp) return null;
    const profile = buildFiveDimensionProfile(currentApp.form_state, locale);
    const verdict = buildOverallVerdict(currentApp.form_state, profile, locale);
    const gap = buildBiggestGapBlock(profile, locale);
    return {
      position: verdict.headline,
      weakness: dimensionLabel(gap.dimension.key, locale),
      weaknessDetail: gap.dimension.judgment,
      nextStep: gap.dimension.suggest,
    };
  }, [currentApp, locale]);
  const applicationInfoItems = useMemo(
    () => (currentApp ? buildApplicationInfoItems(currentApp.form_state, locale, t) : []),
    [currentApp, locale, t],
  );
  const visibleApps = historyExpanded ? apps : apps.slice(0, 2);

  const loadApps = useCallback(async () => {
    if (!configured || !user) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await listApplications();
      setApps(list);
    } catch (e) {
      setErr(formatSupabaseError(e, t));
    } finally {
      setLoading(false);
    }
  }, [configured, user, t]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  useEffect(() => {
    if (!currentApp || reportsByApp[currentApp.id]) return;
    setLoadingReports(currentApp.id);
    void getApplicationReports(currentApp.id)
      .then(({ reports }) => {
        setReportsByApp((prev) => ({ ...prev, [currentApp.id]: reports }));
      })
      .catch((e) => setErr(formatSupabaseError(e, t)))
      .finally(() => setLoadingReports(null));
  }, [currentApp, reportsByApp, t]);

  async function toggleExpand(appId: string) {
    if (expandedId === appId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(appId);
    if (reportsByApp[appId]) return;
    setLoadingReports(appId);
    try {
      const { reports } = await getApplicationReports(appId);
      setReportsByApp((prev) => ({ ...prev, [appId]: reports }));
    } catch (e) {
      setErr(formatSupabaseError(e, t));
    } finally {
      setLoadingReports(null);
    }
  }

  async function handleDelete(appId: string) {
    if (!window.confirm(t("auth.accountDeleteConfirm"))) return;
    try {
      await deleteApplication(appId);
      setApps((prev) => prev.filter((a) => a.id !== appId));
      if (expandedId === appId) setExpandedId(null);
    } catch (e) {
      setErr(formatSupabaseError(e, t));
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function openReport(app: ApplicationListItem, report: SavedReportRow) {
    onOpenReport({
      form: app.form_state,
      report: report.report_payload,
      applicationId: app.id,
      reportId: report.id,
      supplementaryNotes: report.supplementary_notes ?? [],
      reportUnlocked: unlockedApplicationIds.includes(app.id) || report.report_unlocked,
    });
  }

  async function openLatestReport(app: ApplicationListItem) {
    let reports = reportsByApp[app.id];
    if (!reports) {
      setLoadingReports(app.id);
      try {
        const res = await getApplicationReports(app.id);
        reports = res.reports;
        setReportsByApp((prev) => ({ ...prev, [app.id]: reports ?? [] }));
      } catch (e) {
        setErr(formatSupabaseError(e, t));
        return;
      } finally {
        setLoadingReports(null);
      }
    }
    const latest = reports?.[0];
    if (latest) openReport(app, latest);
  }

  function handlePrimaryContinue() {
    if (currentApp) {
      onEditForm({ form: currentApp.form_state, applicationId: currentApp.id });
      return;
    }
    onNewApplication();
  }

  return (
    <div className="app account-home">
      <header className="account-home__head">
        <BrandLogo />
        <div className="account-home__head-actions">
          <button type="button" className="btn btn-secondary account-home__hub" onClick={onOpenAppLinks}>
            {t("appLinks.entry")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            {t("auth.accountBack")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
            {t("auth.signOut")}
          </button>
        </div>
      </header>

      <section className="card report-block account-dashboard">
        <div className="account-home__intro">
          <div>
            <p className="account-home__eyebrow">{t("auth.accountControlCenter")}</p>
            <h1 className="account-home__title">{t("auth.accountTitle")}</h1>
            <p className="account-home__lead">{t("auth.accountLead")}</p>
          </div>
          {user?.email && <p className="account-home__email">{user.email}</p>}
        </div>

        <section className="account-status-card" aria-labelledby="account-status-title">
          <div className="account-status-card__head">
            <div>
              <p className="account-status-card__kicker">{t("auth.accountStatusKicker")}</p>
              <h2 id="account-status-title">{currentApp?.title ?? t("auth.accountNoCurrentTitle")}</h2>
              {currentApp && <p className="account-status-card__basis">{t("auth.accountStatusBasis")}</p>}
            </div>
            <span className="account-status-card__badge">
              {latestReport ? t("auth.accountStatusActive") : t("auth.accountStatusNeedsReport")}
            </span>
          </div>

          {status ? (
            <>
              <div className="account-status-grid">
                <div className="account-status-metric account-status-metric--wide">
                  <span>{t("auth.accountPosition")}</span>
                  <strong>{status.position}</strong>
                  <small>{t("auth.accountConservativeNote")}</small>
                </div>
                <div className="account-status-metric">
                  <span>{t("auth.accountWeakness")}</span>
                  <strong>{status.weakness}</strong>
                  <small>{status.weaknessDetail}</small>
                </div>
                <div className="account-status-metric">
                  <span>{t("auth.accountUpdatedLabel")}</span>
                  <strong>{formatDate(latestReport?.created_at ?? currentApp?.updated_at ?? null)}</strong>
                  <small>{t("auth.accountReportCount", { n: currentApp?.report_count ?? 0 })}</small>
                </div>
              </div>
              <p className="account-status-card__next">{status.nextStep}</p>
              <details className="account-info-evidence">
                <summary>{t("auth.accountInfoToggle")}</summary>
                <p className="account-info-evidence__lead">{t("auth.accountInfoLead")}</p>
                {applicationInfoItems.length > 0 ? (
                  <dl className="account-info-grid">
                    {applicationInfoItems.map((item) => (
                      <div key={item.label} className="account-info-grid__item">
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="account-home__muted">{t("auth.accountInfoEmpty")}</p>
                )}
              </details>
            </>
          ) : (
            <p className="account-home__empty">{loading ? t("auth.accountLoading") : t("auth.accountEmpty")}</p>
          )}

          <div className="account-status-card__actions">
            <p className="account-status-card__action-hint">{t("auth.accountAccuracyHint")}</p>
            <button type="button" className="btn btn-primary account-home__new" onClick={handlePrimaryContinue}>
              {t("auth.accountContinueOptimize")}
            </button>
            {currentApp && latestReport && (
              <button type="button" className="btn btn-secondary" onClick={() => openReport(currentApp, latestReport)}>
                {t("auth.accountOpenLatestReport")}
              </button>
            )}
          </div>
        </section>

        {err && <p className="account-home__err">{err}</p>}
        {loading && <p className="account-home__muted">{t("auth.accountLoading")}</p>}

        <div className="account-history-head">
          <div>
            <h2>{t("auth.accountRecentTitle")}</h2>
            <p>{t("auth.accountRecentLead")}</p>
          </div>
          {apps.length > 2 && (
            <button
              type="button"
              className="account-history-toggle"
              onClick={() => setHistoryExpanded((v) => !v)}
            >
              {historyExpanded ? t("auth.accountHideHistory") : t("auth.accountViewHistory")}
            </button>
          )}
        </div>

        <ul className="account-list">
          {visibleApps.map((app) => {
            const appReports = reportsByApp[app.id] ?? [];
            const shownReports = historyExpanded ? appReports : appReports.slice(0, 2);
            return (
            <li key={app.id} className="account-list__item">
              <div className="account-list__row">
                <button type="button" className="account-list__main" onClick={() => void toggleExpand(app.id)}>
                  <strong>{app.title}</strong>
                  <span className="account-list__meta">
                    {t("auth.accountReportCount", { n: app.report_count })} · {t("auth.accountUpdated", { date: formatDate(app.updated_at) })}
                  </span>
                </button>
                <div className="account-list__btns">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onEditForm({ form: app.form_state, applicationId: app.id })}
                  >
                    {t("auth.accountContinueShort")}
                  </button>
                  {app.report_count > 0 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void openLatestReport(app)}>
                      {t("auth.accountOpenReport")}
                    </button>
                  )}
                  <details className="account-list__more">
                    <summary>{t("auth.accountMore")}</summary>
                    <button type="button" className="account-list__delete" onClick={() => void handleDelete(app.id)}>
                      {t("auth.accountDelete")}
                    </button>
                  </details>
                </div>
              </div>

              {expandedId === app.id && (
                <div className="account-list__reports">
                  {loadingReports === app.id && <p className="account-home__muted">{t("auth.accountLoading")}</p>}
                  {shownReports.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="account-report-row"
                      onClick={() => openReport(app, r)}
                    >
                      <span>{formatDate(r.created_at)}</span>
                      <span className="account-report-row__cta">{t("auth.accountOpenReport")}</span>
                    </button>
                  ))}
                  {(reportsByApp[app.id] ?? []).length === 0 && loadingReports !== app.id && (
                    <p className="account-home__muted">{t("auth.accountNoReports")}</p>
                  )}
                </div>
              )}
            </li>
          );
          })}
        </ul>
      </section>
    </div>
  );
}
