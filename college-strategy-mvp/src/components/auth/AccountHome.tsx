import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  deleteApplication,
  getApplicationReports,
  listApplications,
  updateApplicationForm,
  type ApplicationListItem,
  type SavedReportRow,
} from "../../lib/supabase/accounts";
import { formatSupabaseError } from "../../lib/supabase/errors";
import { buildBiggestGapBlock, buildOverallVerdict } from "../../lib/decisionReport";
import { buildApplicationInfoRows } from "../../lib/applicationInfoRows";
import { buildFiveDimensionProfile, type ProfileDimensionKey } from "../../lib/fiveDimensionProfile";
import type { ActivityItem, FormState, GeoPref, ReportPayload, SupplementaryNote } from "../../types";
import { BrandLogo } from "../BrandLogo";
import { ExportActivitiesCsvButton } from "../ExportActivitiesCsvButton";
import { AccountReportSnapshot } from "./AccountReportSnapshot";
import { AccountReportBrief } from "./AccountReportBrief";
import { AccountExpertPanel } from "./AccountExpertPanel";
import { AccountServicePanel } from "../crm/AccountServicePanel";
import {
  addMessage,
  createDemoEngagement,
  getCounselor,
  getEngagementForApplication,
  initCrmForUser,
  isCrmDemoUiEnabled,
  isSignedServiceEnabled,
  listMessages,
  listTasks,
  markMessagesReadByStudent,
  notifyCrmStoreChange,
  setTaskDone,
  subscribeCrmStore,
} from "../../lib/crm/store";
import type { CrmTaskLinkType } from "../../lib/crm/types";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { SchoolFitComparisonCard } from "./SchoolFitComparisonCard";
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
  onEditForm: (payload: { form: FormState; applicationId: string; supplementaryNotes?: SupplementaryNote[]; targetStep?: number }) => void;
  onNewApplication: () => void;
  onOpenAppLinks: (e: MouseEvent<HTMLButtonElement>) => void;
  onOpenCounselorConsole?: () => void;
  onOpenSignedService?: (payload: { form: FormState; applicationId: string }) => void;
};

function dimensionLabel(key: ProfileDimensionKey, locale: "zh" | "en") {
  const zh: Record<ProfileDimensionKey, string> = {
    academic: "学术定位",
    testing: "标化策略",
    activities: "活动主线",
    rigor: "课程 rigor",
    strategy: "选校策略",
  };
  const en: Record<ProfileDimensionKey, string> = {
    academic: "Academic positioning",
    testing: "Testing strategy",
    activities: "Activity spine",
    rigor: "Course rigor",
    strategy: "List strategy",
  };
  return (locale === "en" ? en : zh)[key];
}

function toggleGeo(prefs: GeoPref[], g: GeoPref): GeoPref[] {
  if (g === "any") return prefs.includes("any") ? [] : ["any"];
  const without = prefs.filter((x) => x !== "any");
  return without.includes(g) ? without.filter((x) => x !== g) : [...without, g];
}

function createActivityItem(): ActivityItem {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    name: "",
    kind: "",
    grades: "",
    hours: "",
    role: "",
    description: "",
    outcome: "",
    award: "",
    scope: "",
    majorRelated: "",
    proof: "",
  };
}

function activityKindLabel(kind: ActivityItem["kind"], locale: "zh" | "en"): string {
  const zh: Record<string, string> = {
    activity: "活动",
    competition: "竞赛",
    research: "科研",
    internship: "实习",
    club: "社团",
    service: "公益",
    arts: "艺术",
    sports: "体育",
    other: "其他",
  };
  const en: Record<string, string> = {
    activity: "Activity",
    competition: "Competition",
    research: "Research",
    internship: "Internship",
    club: "Club",
    service: "Service",
    arts: "Arts",
    sports: "Sports",
    other: "Other",
  };
  if (!kind) return "";
  return (locale === "en" ? en : zh)[kind] ?? kind;
}

export function AccountHome({
  unlockedApplicationIds,
  onBack,
  onOpenReport,
  onEditForm,
  onNewApplication,
  onOpenAppLinks,
  onOpenCounselorConsole,
  onOpenSignedService,
}: Props) {
  const { t, locale } = useLanguage();
  const { user, signOut, configured } = useAuth();
  const [crmTick, setCrmTick] = useState(0);
  const profileSectionRef = useRef<HTMLDetailsElement | null>(null);
  const activitySectionRef = useRef<HTMLElement | null>(null);
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportsByApp, setReportsByApp] = useState<Record<string, SavedReportRow[]>>({});
  const [loadingReports, setLoadingReports] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [activityEditorOpen, setActivityEditorOpen] = useState(false);
  const [activityDraft, setActivityDraft] = useState<ActivityItem[]>([]);
  const [activitySaveBusy, setActivitySaveBusy] = useState(false);
  const [activitySaveNotice, setActivitySaveNotice] = useState<string | null>(null);
  const lastSavedActivitySnapshotRef = useRef("");
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<FormState | null>(null);
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [profileSaveNotice, setProfileSaveNotice] = useState<string | null>(null);

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
  const fiveProfile = useMemo(
    () => (currentApp ? buildFiveDimensionProfile(currentApp.form_state, locale) : []),
    [currentApp, locale],
  );
  const applicationInfoItems = useMemo(
    () => (currentApp ? buildApplicationInfoRows(currentApp.form_state, locale, t) : []),
    [currentApp, locale, t],
  );
  const visibleApps = historyExpanded ? apps : apps.slice(0, 2);

  const engagement = useMemo(() => {
    if (!user || !currentApp) return null;
    return getEngagementForApplication(user.id, currentApp.id);
  }, [user, currentApp, crmTick]);

  const counselor = useMemo(() => (engagement ? getCounselor(engagement.counselorId) : null), [engagement, crmTick]);
  const crmMessages = useMemo(() => (engagement ? listMessages(engagement.id) : []), [engagement, crmTick]);
  const crmTasks = useMemo(() => (engagement ? listTasks(engagement.id) : []), [engagement, crmTick]);
  const signedServiceEnabled = isSignedServiceEnabled();
  const crmDemoUiEnabled = isCrmDemoUiEnabled();

  useEffect(() => subscribeCrmStore(() => setCrmTick((n) => n + 1)), []);

  useEffect(() => {
    if (!user || !signedServiceEnabled) return;
    void initCrmForUser(user.id, "student").then(() => setCrmTick((n) => n + 1));
  }, [user?.id, signedServiceEnabled]);

  function enableCrmDemo() {
    if (!user || !currentApp) return;
    void (async () => {
      try {
        await initCrmForUser(user.id, "student");
        await createDemoEngagement({
          studentUserId: user.id,
          studentEmail: user.email ?? "",
          studentName: user.email?.split("@")[0],
          applicationId: currentApp.id,
          applicationTitle: currentApp.title,
        });
        notifyCrmStoreChange();
        setCrmTick((n) => n + 1);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "no_counselor") {
          window.alert(t("crm.counselorAuth.noCounselorSeed"));
        } else {
          window.alert(t("crm.counselorAuth.demoFailed"));
        }
      }
    })();
  }

  function openSignedServiceHub() {
    if (!currentApp || !onOpenSignedService) return;
    onOpenSignedService({
      form: profileDraft ?? currentApp.form_state,
      applicationId: currentApp.id,
    });
  }

  function handleCrmSendMessage(body: string) {
    if (!engagement || !user) return;
    addMessage({
      engagementId: engagement.id,
      authorRole: "student",
      authorLabel: user.email?.split("@")[0] || t("crm.myCounselor"),
      body,
    });
    notifyCrmStoreChange();
    setCrmTick((n) => n + 1);
  }

  function handleCrmToggleTask(taskId: string, done: boolean) {
    setTaskDone(taskId, done);
    notifyCrmStoreChange();
    setCrmTick((n) => n + 1);
  }

  function handleCrmTaskNavigate(linkType: CrmTaskLinkType) {
    if (linkType === "report" && currentApp && latestReport) {
      openReport(currentApp, latestReport);
      return;
    }
    if (linkType === "profile") {
      setProfileEditorOpen(true);
      profileSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (linkType === "activities" || linkType === "essay") {
      setActivityEditorOpen(true);
      activitySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function focusCrmMessages() {
    if (engagement) {
      markMessagesReadByStudent(engagement.id);
      notifyCrmStoreChange();
      setCrmTick((n) => n + 1);
    }
    document.getElementById("account-service-updates")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const nextActivities = currentApp?.form_state.structuredActivities ?? [];
    setActivityDraft(nextActivities);
    lastSavedActivitySnapshotRef.current = JSON.stringify(nextActivities);
    setActivitySaveNotice(null);
    setProfileDraft(currentApp?.form_state ?? null);
    setProfileSaveNotice(null);
  }, [currentApp?.id]);

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

  function latestSupplementaryNotesFor(appId: string): SupplementaryNote[] {
    return reportsByApp[appId]?.[0]?.supplementary_notes ?? [];
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
      onEditForm({
        form: currentApp.form_state,
        applicationId: currentApp.id,
        supplementaryNotes: latestSupplementaryNotesFor(currentApp.id),
      });
      return;
    }
    onNewApplication();
  }

  function openProfileEditor() {
    setProfileEditorOpen(true);
  }

  function handleProfileGridKeyDown(e: KeyboardEvent<HTMLDListElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openProfileEditor();
    }
  }

  function updateProfileDraft<K extends keyof FormState>(key: K, value: FormState[K]) {
    setProfileDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setProfileSaveNotice(null);
  }

  async function saveProfileDraft(): Promise<FormState | null> {
    if (!currentApp || !profileDraft) return null;
    const nextForm = {
      ...profileDraft,
      structuredActivities: activityDraft,
    };
    setProfileSaveBusy(true);
    setProfileSaveNotice(null);
    try {
      await updateApplicationForm(currentApp.id, nextForm, locale);
      setApps((prev) =>
        prev.map((app) =>
          app.id === currentApp.id ? { ...app, form_state: nextForm, locale, updated_at: new Date().toISOString() } : app,
        ),
      );
      setProfileDraft(nextForm);
      setActivityDraft(nextForm.structuredActivities ?? []);
      setProfileSaveNotice(t("auth.accountProfileSaved"));
      return nextForm;
    } catch (e) {
      setProfileSaveNotice(formatSupabaseError(e, t));
      return null;
    } finally {
      setProfileSaveBusy(false);
    }
  }

  async function handleSaveProfileDraft() {
    await saveProfileDraft();
  }

  async function handleUpdateReportFromProfile() {
    if (!currentApp) return;
    const nextForm = await saveProfileDraft();
    if (!nextForm) return;
    onEditForm({
      form: nextForm,
      applicationId: currentApp.id,
      supplementaryNotes: latestSupplementaryNotesFor(currentApp.id),
      targetStep: 1,
    });
  }

  function updateActivityDraft(id: string, patch: Partial<ActivityItem>) {
    setActivityDraft((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setActivitySaveNotice(null);
  }

  function addActivityDraft() {
    setActivityDraft((prev) => [...prev, createActivityItem()]);
    setActivityEditorOpen(true);
    setActivitySaveNotice(null);
  }

  function removeActivityDraft(id: string) {
    setActivityDraft((prev) => prev.filter((item) => item.id !== id));
    setActivitySaveNotice(null);
  }

  function buildActivityUpdatedForm(): FormState | null {
    if (!currentApp) return null;
    return {
      ...(profileDraft ?? currentApp.form_state),
      structuredActivities: activityDraft,
    };
  }

  async function saveActivityProfile(options: { silent?: boolean } = {}): Promise<FormState | null> {
    if (!currentApp) return null;
    const nextForm = buildActivityUpdatedForm();
    if (!nextForm) return null;
    const snapshot = JSON.stringify(nextForm.structuredActivities ?? []);
    setActivitySaveBusy(true);
    setActivitySaveNotice(options.silent ? t("auth.accountActivitySaving") : null);
    try {
      await updateApplicationForm(currentApp.id, nextForm, locale);
      setApps((prev) =>
        prev.map((app) =>
          app.id === currentApp.id ? { ...app, form_state: nextForm, locale, updated_at: new Date().toISOString() } : app,
        ),
      );
      lastSavedActivitySnapshotRef.current = snapshot;
      setProfileDraft(nextForm);
      setActivitySaveNotice(t("auth.accountActivitySaved"));
      return nextForm;
    } catch (e) {
      setActivitySaveNotice(formatSupabaseError(e, t));
      return null;
    } finally {
      setActivitySaveBusy(false);
    }
  }

  async function handleUpdateReportFromActivities() {
    if (!currentApp) return;
    const nextForm = await saveActivityProfile();
    if (!nextForm) return;
    onEditForm({
      form: nextForm,
      applicationId: currentApp.id,
      supplementaryNotes: latestSupplementaryNotesFor(currentApp.id),
      targetStep: 3,
    });
  }

  useEffect(() => {
    if (!currentApp) return;
    const snapshot = JSON.stringify(activityDraft);
    if (snapshot === lastSavedActivitySnapshotRef.current) return;

    const id = window.setTimeout(() => {
      void saveActivityProfile({ silent: true });
    }, 900);

    return () => window.clearTimeout(id);
  }, [activityDraft, currentApp?.id]);

  return (
    <div className="app app--account account-home">
      <div className="account-home__shell">
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

        <section className="account-dashboard">
        <div className="account-home__intro">
          <div>
            <p className="account-home__eyebrow">{t("auth.accountControlCenter")}</p>
            <h1 className="account-home__title">{t("auth.accountTitle")}</h1>
            <p className="account-home__lead">{t("auth.accountLead")}</p>
          </div>
          {user?.email && <p className="account-home__email">{user.email}</p>}
        </div>

        {crmDemoUiEnabled && (
          <div className="account-crm-demo">
            <p>{t("auth.accountCrmDemoBar")}</p>
            <div className="account-crm-demo__actions">
              {!engagement && currentApp ? (
                <button type="button" className="btn btn-primary" onClick={enableCrmDemo}>
                  {t("auth.accountCrmEnableDemo")}
                </button>
              ) : null}
              {onOpenCounselorConsole ? (
                <button type="button" className="btn btn-secondary" onClick={onOpenCounselorConsole}>
                  {t("auth.accountCrmOpenConsole")}
                </button>
              ) : null}
            </div>
          </div>
        )}

        {engagement && counselor ? (
          <AccountServicePanel
            engagement={engagement}
            counselor={counselor}
            messages={crmMessages}
            tasks={crmTasks}
            userEmail={user?.email ?? null}
            onSendMessage={handleCrmSendMessage}
            onToggleTask={handleCrmToggleTask}
            onTaskNavigate={handleCrmTaskNavigate}
            onFocusMessages={focusCrmMessages}
            onOpenSignedServiceHub={onOpenSignedService ? openSignedServiceHub : undefined}
          />
        ) : null}

        <section className="account-hero" aria-labelledby="account-status-title">
          <div className="account-hero__head">
            <div>
              <p className="account-hero__kicker">{t("auth.accountStatusKicker")}</p>
              <h2 id="account-status-title">
                {currentApp ? localizeCrmText(currentApp.title, locale, t) : t("auth.accountNoCurrentTitle")}
              </h2>
              {currentApp && latestReport && (
                <p className="account-hero__meta">
                  {t("auth.accountHeroUpdated", {
                    date: formatDate(latestReport.created_at),
                    n: currentApp.report_count ?? 0,
                  })}
                </p>
              )}
              {currentApp && !latestReport && <p className="account-hero__meta">{t("auth.accountStatusBasis")}</p>}
            </div>
            <span className="account-hero__badge">
              {latestReport ? t("auth.accountStatusActive") : t("auth.accountStatusNeedsReport")}
            </span>
          </div>

          {status ? (
            <>
              <p className="account-hero__position">{status.position}</p>
              <div className="account-hero__main">
                <div className={`account-hero__panel${latestReport ? " account-hero__panel--with-brief" : ""}`}>
                  <div className="account-hero__insight">
                    <p className="account-hero__weakness-label">{t("auth.accountWeakness")}</p>
                    <p className="account-hero__weakness">{status.weakness}</p>
                    {status.weaknessDetail && <p className="account-hero__weakness-detail">{status.weaknessDetail}</p>}
                  </div>
                  {status.nextStep && <p className="account-hero__next">{status.nextStep}</p>}
                  <div className="account-hero__actions">
                    {currentApp && latestReport ? (
                      <button type="button" className="btn btn-primary" onClick={() => openReport(currentApp, latestReport)}>
                        {t("auth.accountOpenLatestReport")}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary account-home__new" onClick={handlePrimaryContinue}>
                        {t("auth.accountContinueOptimize")}
                      </button>
                    )}
                    {currentApp && latestReport && (
                      <button type="button" className="btn btn-secondary" onClick={handlePrimaryContinue}>
                        {t("auth.accountContinueOptimize")}
                      </button>
                    )}
                  </div>
                  <p className="account-hero__hint">{t("auth.accountAccuracyHint")}</p>
                  {latestReport ? (
                    <AccountReportBrief report={latestReport.report_payload} locale={locale} t={t} />
                  ) : null}
                  {!engagement ? (
                    <AccountExpertPanel
                      embedded
                      gapCount={latestReport?.report_payload?.information_gaps?.length ?? 0}
                      applicationId={currentApp?.id ?? null}
                      reportId={latestReport?.id ?? null}
                      userEmail={user?.email ?? null}
                    />
                  ) : null}
                </div>

                {latestReport && fiveProfile.length > 0 ? (
                  <AccountReportSnapshot report={latestReport.report_payload} dimensions={fiveProfile} t={t} />
                ) : (
                  <aside className="account-hero__snapshot-placeholder" aria-hidden>
                    <p>{t("auth.accountStatusNeedsReport")}</p>
                  </aside>
                )}
              </div>

              <details className="account-info-evidence" ref={profileSectionRef}>
                <summary>{t("auth.accountInfoToggle")}</summary>
                <p className="account-info-evidence__lead">{t("auth.accountInfoLead")}</p>
                {applicationInfoItems.length > 0 ? (
                  <dl
                    className="account-info-grid account-info-grid--editable"
                    role="button"
                    tabIndex={0}
                    aria-label={t("auth.accountProfileEdit")}
                    onClick={openProfileEditor}
                    onKeyDown={handleProfileGridKeyDown}
                  >
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
                <button type="button" className="account-info-edit" onClick={() => setProfileEditorOpen((v) => !v)}>
                  {profileEditorOpen ? t("auth.accountProfileCollapse") : t("auth.accountProfileEdit")}
                </button>
                {profileEditorOpen && profileDraft && (
                  <div className="account-profile-editor">
                    <div className="account-profile-editor__grid">
                      <label>
                        <span>{t("form.gpa")}</span>
                        <input
                          value={profileDraft.gpa}
                          onChange={(e) => updateProfileDraft("gpa", e.target.value)}
                          placeholder={t("form.placeholder.gpa")}
                        />
                      </label>
                      <label>
                        <span>{t("form.currentHighSchool")}</span>
                        <input
                          value={profileDraft.currentHighSchool}
                          onChange={(e) => updateProfileDraft("currentHighSchool", e.target.value)}
                          placeholder={t("form.placeholder.currentHighSchool")}
                        />
                      </label>
                      <label>
                        <span>{t("form.hs")}</span>
                        <input
                          value={profileDraft.highSchoolSystem}
                          onChange={(e) => updateProfileDraft("highSchoolSystem", e.target.value)}
                          placeholder={t("form.hs")}
                        />
                      </label>
                      <label>
                        <span>{t("form.sat")}</span>
                        <input
                          value={profileDraft.satScore}
                          onChange={(e) => updateProfileDraft("satScore", e.target.value)}
                          placeholder={t("form.placeholder.sat")}
                        />
                      </label>
                      <label>
                        <span>{t("form.act")}</span>
                        <input
                          value={profileDraft.actScore}
                          onChange={(e) => updateProfileDraft("actScore", e.target.value)}
                          placeholder={t("form.placeholder.act")}
                        />
                      </label>
                      <label>
                        <span>{t("form.major")}</span>
                        <input
                          value={profileDraft.majorPrimary}
                          onChange={(e) => updateProfileDraft("majorPrimary", e.target.value)}
                          placeholder={t("form.placeholder.major")}
                        />
                      </label>
                      <label>
                        <span>{t("form.major2")}</span>
                        <input
                          value={profileDraft.majorSecondary}
                          onChange={(e) => updateProfileDraft("majorSecondary", e.target.value)}
                          placeholder={t("form.placeholder.major2")}
                        />
                      </label>
                      <label>
                        <span>{t("form.citizenship")}</span>
                        <input
                          value={profileDraft.citizenship}
                          onChange={(e) => updateProfileDraft("citizenship", e.target.value)}
                          placeholder={t("form.placeholder.citizenship")}
                        />
                      </label>
                      <label>
                        <span>{t("form.residenceRegion")}</span>
                        <input
                          value={profileDraft.residenceRegion}
                          onChange={(e) => updateProfileDraft("residenceRegion", e.target.value)}
                          placeholder={t("form.placeholder.residenceRegion")}
                        />
                      </label>
                      <label>
                        <span>{t("form.identity")}</span>
                        <select
                          value={profileDraft.applicantIdentity}
                          onChange={(e) => updateProfileDraft("applicantIdentity", e.target.value as FormState["applicantIdentity"])}
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          <option value="intl">{t("form.opt.idIntl")}</option>
                          <option value="us_citizen">{t("form.opt.idUs")}</option>
                          <option value="other">{t("form.opt.idOther")}</option>
                        </select>
                      </label>
                      <label>
                        <span>{t("form.budget")}</span>
                        <select
                          value={profileDraft.budget}
                          onChange={(e) => updateProfileDraft("budget", e.target.value as FormState["budget"])}
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          <option value="full_pay">{t("form.opt.budgetFull")}</option>
                          <option value="high_budget">{t("form.opt.budgetHigh")}</option>
                          <option value="budget_cap">{t("form.opt.budgetCap")}</option>
                          <option value="need_aid">{t("form.opt.budgetAid")}</option>
                          <option value="unsure">{t("form.opt.budgetUnsure")}</option>
                        </select>
                      </label>
                      <label>
                        <span>{t("form.testing")}</span>
                        <select
                          value={profileDraft.testing}
                          onChange={(e) => updateProfileDraft("testing", e.target.value as FormState["testing"])}
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          <option value="test_optional">{t("form.opt.testOpt")}</option>
                          <option value="will_submit">{t("form.opt.testSubmit")}</option>
                        </select>
                      </label>
                      <label>
                        <span>{t("form.risk")}</span>
                        <select
                          value={profileDraft.riskStyle}
                          onChange={(e) => updateProfileDraft("riskStyle", e.target.value as FormState["riskStyle"])}
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          <option value="conservative">{t("form.opt.riskCon")}</option>
                          <option value="balanced">{t("form.opt.riskBal")}</option>
                          <option value="aggressive">{t("form.opt.riskAgg")}</option>
                        </select>
                      </label>
                      <label>
                        <span>{t("wizard.s2.size.q")}</span>
                        <select
                          value={profileDraft.schoolSize}
                          onChange={(e) => updateProfileDraft("schoolSize", e.target.value as FormState["schoolSize"])}
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          <option value="small">{t("form.opt.sizeS")}</option>
                          <option value="medium">{t("form.opt.sizeM")}</option>
                          <option value="large">{t("form.opt.sizeL")}</option>
                          <option value="any">{t("form.opt.sizeAny")}</option>
                        </select>
                      </label>
                      <label>
                        <span>{t("wizard.s2.culture.q")}</span>
                        <select
                          value={profileDraft.campusCulturePref}
                          onChange={(e) =>
                            updateProfileDraft("campusCulturePref", e.target.value as FormState["campusCulturePref"])
                          }
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          <option value="academic">{t("form.opt.campusAcademic")}</option>
                          <option value="balanced">{t("form.opt.campusBalanced")}</option>
                          <option value="social">{t("form.opt.campusSocial")}</option>
                          <option value="any">{t("form.opt.campusAny")}</option>
                        </select>
                      </label>
                    </div>
                    <div className="account-profile-editor__full account-profile-editor__geo">
                      <span>{t("wizard.s2.geo.q")}</span>
                      <div className="account-profile-editor__geo-grid">
                        {(["west", "east", "south", "midwest", "great_lakes", "any"] as const).map((g) => (
                          <label key={g} className="account-profile-editor__geo-item">
                            <input
                              type="checkbox"
                              checked={profileDraft.geoPrefs.includes(g)}
                              onChange={() => updateProfileDraft("geoPrefs", toggleGeo(profileDraft.geoPrefs, g))}
                            />
                            {t(`geo.${g}`)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="account-profile-editor__full">
                      <span>{t("form.deal")}</span>
                      <textarea
                        value={profileDraft.dealbreakers}
                        onChange={(e) => updateProfileDraft("dealbreakers", e.target.value)}
                        placeholder={t("form.placeholder.deal")}
                      />
                    </label>
                    {profileSaveNotice && <p className="account-profile-editor__notice">{profileSaveNotice}</p>}
                    <div className="account-profile-editor__actions">
                      <button type="button" className="btn btn-secondary" onClick={() => void handleSaveProfileDraft()} disabled={profileSaveBusy}>
                        {profileSaveBusy ? t("auth.accountProfileSaving") : t("auth.accountProfileSave")}
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => void handleUpdateReportFromProfile()} disabled={profileSaveBusy}>
                        {t("auth.accountProfileUpdateReport")}
                      </button>
                    </div>
                  </div>
                )}
              </details>
            </>
          ) : (
            <>
              <p className="account-home__empty">{loading ? t("auth.accountLoading") : t("auth.accountEmpty")}</p>
              <AccountExpertPanel
                gapCount={0}
                applicationId={null}
                reportId={null}
                userEmail={user?.email ?? null}
              />
            </>
          )}
        </section>

        {latestReport && fiveProfile.length > 0 && (
          <SchoolFitComparisonCard
            report={latestReport.report_payload}
            userDimensions={fiveProfile}
            t={t}
          />
        )}

        {currentApp && (
          <div className="account-dashboard__workspace">
          <section className="account-activity-card" aria-labelledby="account-activity-title" ref={activitySectionRef}>
            <div className="account-activity-card__head">
              <div>
                <p className="account-activity-card__kicker">{t("auth.accountActivityKicker")}</p>
                <h2 id="account-activity-title">{t("auth.accountActivityTitle")}</h2>
                <p>{t("auth.accountActivityLead")}</p>
              </div>
              <span>{t("auth.accountActivityCount", { n: activityDraft.length })}</span>
            </div>

            {!activityEditorOpen && activityDraft.length > 0 && (
              <div className="account-activity-preview">
                {activityDraft.slice(0, 3).map((item) => (
                  <div key={item.id}>
                    <strong>{item.name || t("auth.accountActivityUntitled")}</strong>
                    <span>
                      {[activityKindLabel(item.kind, locale), item.role, item.award || item.outcome].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activityEditorOpen && (
              <div className="account-activity-editor">
                {activityDraft.length === 0 ? (
                  <p className="account-home__muted">{t("auth.accountActivityEmpty")}</p>
                ) : (
                  activityDraft.map((item, index) => (
                    <article className="account-activity-item" key={item.id}>
                      <div className="account-activity-item__head">
                        <strong>{t("wizard.s3.activities.cardTitle", { n: index + 1 })}</strong>
                        <button type="button" onClick={() => removeActivityDraft(item.id)}>
                          {t("wizard.s3.activities.remove")}
                        </button>
                      </div>
                      <div className="account-activity-item__grid">
                        <label>
                          <span>{t("wizard.s3.activities.name")}</span>
                          <input
                            value={item.name}
                            onChange={(e) => updateActivityDraft(item.id, { name: e.target.value })}
                            placeholder={t("wizard.s3.activities.namePh")}
                          />
                        </label>
                        <label>
                          <span>{t("wizard.s3.activities.kind")}</span>
                          <select
                            value={item.kind}
                            onChange={(e) => updateActivityDraft(item.id, { kind: e.target.value as ActivityItem["kind"] })}
                          >
                            <option value="">{t("form.opt.choose")}</option>
                            {(["activity", "competition", "research", "internship", "club", "service", "arts", "sports", "other"] as const).map(
                              (kind) => (
                                <option key={kind} value={kind}>
                                  {t(`wizard.s3.activities.kindOpt.${kind}`)}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label>
                          <span>{t("wizard.s3.activities.grades")}</span>
                          <input
                            value={item.grades}
                            onChange={(e) => updateActivityDraft(item.id, { grades: e.target.value })}
                            placeholder={t("wizard.s3.activities.gradesPh")}
                          />
                        </label>
                        <label>
                          <span>{t("wizard.s3.activities.hours")}</span>
                          <input
                            value={item.hours}
                            onChange={(e) => updateActivityDraft(item.id, { hours: e.target.value })}
                            placeholder={t("wizard.s3.activities.hoursPh")}
                          />
                        </label>
                        <label>
                          <span>{t("wizard.s3.activities.role")}</span>
                          <input
                            value={item.role}
                            onChange={(e) => updateActivityDraft(item.id, { role: e.target.value })}
                            placeholder={t("wizard.s3.activities.rolePh")}
                          />
                        </label>
                        <label>
                          <span>{t("wizard.s3.activities.scope")}</span>
                          <select
                            value={item.scope}
                            onChange={(e) => updateActivityDraft(item.id, { scope: e.target.value as ActivityItem["scope"] })}
                          >
                            <option value="">{t("form.opt.choose")}</option>
                            {(["school", "local", "regional", "state", "national", "international"] as const).map((scope) => (
                              <option key={scope} value={scope}>
                                {t(`wizard.s3.activities.scopeOpt.${scope}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="account-activity-item__full">
                        <span>{t("wizard.s3.activities.description")}</span>
                        <textarea
                          value={item.description}
                          onChange={(e) => updateActivityDraft(item.id, { description: e.target.value })}
                          placeholder={t("wizard.s3.activities.descriptionPh")}
                        />
                      </label>
                      <div className="account-activity-item__grid">
                        <label>
                          <span>{t("wizard.s3.activities.outcome")}</span>
                          <input
                            value={item.outcome}
                            onChange={(e) => updateActivityDraft(item.id, { outcome: e.target.value })}
                            placeholder={t("wizard.s3.activities.outcomePh")}
                          />
                        </label>
                        <label>
                          <span>{t("wizard.s3.activities.award")}</span>
                          <input
                            value={item.award}
                            onChange={(e) => updateActivityDraft(item.id, { award: e.target.value })}
                            placeholder={t("wizard.s3.activities.awardPh")}
                          />
                        </label>
                        <label>
                          <span>{t("wizard.s3.activities.majorRelated")}</span>
                          <select
                            value={item.majorRelated}
                            onChange={(e) => updateActivityDraft(item.id, { majorRelated: e.target.value as ActivityItem["majorRelated"] })}
                          >
                            <option value="">{t("form.opt.choose")}</option>
                            <option value="yes">{t("wizard.s3.activities.majorYes")}</option>
                            <option value="no">{t("wizard.s3.activities.majorNo")}</option>
                            <option value="unsure">{t("wizard.s3.activities.majorUnsure")}</option>
                          </select>
                        </label>
                        <label>
                          <span>{t("wizard.s3.activities.proof")}</span>
                          <input
                            value={item.proof}
                            onChange={(e) => updateActivityDraft(item.id, { proof: e.target.value })}
                            placeholder={t("wizard.s3.activities.proofPh")}
                          />
                        </label>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}

            {activitySaveNotice && <p className="account-activity-card__notice">{activitySaveNotice}</p>}
            <div className="account-activity-card__actions">
              <button type="button" className="btn btn-secondary" onClick={addActivityDraft}>
                {t("wizard.s3.activities.add")}
              </button>
              <ExportActivitiesCsvButton
                activities={activityDraft}
                form={currentApp?.form_state}
                showHint={false}
              />
              <button type="button" className="btn btn-secondary" onClick={() => setActivityEditorOpen((v) => !v)}>
                {activityEditorOpen ? t("auth.accountActivityCollapse") : t("auth.accountActivityEdit")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void handleUpdateReportFromActivities()} disabled={activitySaveBusy}>
                {t("auth.accountActivityUpdateReport")}
              </button>
            </div>
          </section>
          </div>
        )}

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
                  <strong>{localizeCrmText(app.title, locale, t)}</strong>
                  <span className="account-list__meta">
                    {t("auth.accountReportCount", { n: app.report_count })} · {t("auth.accountUpdated", { date: formatDate(app.updated_at) })}
                  </span>
                </button>
                <div className="account-list__btns">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      onEditForm({
                        form: app.form_state,
                        applicationId: app.id,
                        supplementaryNotes: latestSupplementaryNotesFor(app.id),
                      })
                    }
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
    </div>
  );
}
