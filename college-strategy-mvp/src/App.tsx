import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { FormState, ReportDiff, ReportPayload, SupplementaryNote } from "./types";
import { getEffectiveIntake } from "./lib/intakeTerm";
import { buildReportApiBody } from "./lib/reportApiBody";
import { collectHighlightKeys, compareReports, reportDiffIsEmpty } from "./lib/reportDiff";
import { apiUrl } from "./lib/apiBase";
import { readApiJson } from "./lib/parseApiResponse";
import { clearUnlockStorage, readUnlockFromStorage, ReportView, writeUnlockToStorage } from "./ReportView";
import { BrandLogo } from "./components/BrandLogo";
import { FormLiveSummary, GuidedStep1, GuidedStep2, GuidedStep3, type GuideTouch } from "./components/GuidedQuestionnaire";
import { FullscreenLogoMarquee } from "./components/FullscreenLogoMarquee";
import { UniversityLogoMarquee } from "./components/UniversityLogoMarquee";
import { BrandStoryOverlay } from "./components/BrandStoryOverlay";
import { ProductIntroPage } from "./components/ProductIntroPage";
import { ProductIntroContent } from "./components/ProductIntroContent";
import { ExpertConsultContactModal } from "./components/ExpertConsultContactModal";
import { useLanguage } from "./i18n/LanguageContext";
import { useAuth } from "./auth/AuthContext";
import { AuthModal } from "./components/auth/AuthModal";
import { AccountHome } from "./components/auth/AccountHome";
import { AuthChromeProvider } from "./auth/AuthChromeContext";
import { AppTopChrome } from "./components/AppTopChrome";
import { LegalLinks } from "./components/LegalLinks";
import { saveUserSession, fetchUnlockedApplicationIds, redeemInviteCode } from "./lib/supabase/accounts";
import { getSupabase } from "./lib/supabase/client";
import { formatSupabaseError } from "./lib/supabase/errors";
import { clearPendingSave, readPendingSave, writePendingSave } from "./lib/pendingSave";
import { isEssayAnalysisCheckoutEnabled, isStripeCheckoutEnabled } from "./lib/stripeCheckout";
import { isInviteCodesEnabled } from "./lib/inviteCodes";
import "./App.css";

const initialForm: FormState = {
  intakeTerm: "",
  intakeOtherDetail: "",
  applicantIdentity: "",
  citizenship: "",
  residenceRegion: "",
  budget: "",
  testing: "",
  satScore: "",
  actScore: "",
  highSchoolSystem: "",
  gpa: "",
  majorPrimary: "",
  majorSecondary: "",
  schoolSize: "",
  campusCulturePref: "",
  geoPrefs: [],
  activities: "",
  structuredActivities: [],
  riskStyle: "",
  dealbreakers: "",
};

const LOADING_TIP_KEYS = ["app.loading.tip0", "app.loading.tip1", "app.loading.tip2", "app.loading.tip3"] as const;

function isAuthReturnUrl(): boolean {
  const { hash, search } = window.location;
  return (
    hash.includes("access_token") ||
    hash.includes("refresh_token") ||
    hash.includes("error=") ||
    search.includes("code=") ||
    search.includes("error=")
  );
}

function translateInviteError(code: string, tf: (k: string) => string): string {
  const path = `report.inviteErr.${code}`;
  const msg = tf(path);
  if (msg !== path) return msg;
  return tf("report.inviteErr.generic");
}

function translateReportApiError(code: string | undefined, tf: (k: string) => string): string {
  const normalized = (code ?? "").toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return tf("app.errGenerateTimeout");
  }
  if (
    normalized.includes("report_generation_failed") ||
    normalized.includes("report_service_unavailable")
  ) {
    return tf("app.errGenerate");
  }
  if (
    normalized.includes("llm") ||
    normalized.includes("openai") ||
    normalized.includes("api_key") ||
    normalized.includes("未配置")
  ) {
    return tf("app.errGenerateConfig");
  }
  return tf("app.errGenerate");
}

function translateReportFetchFailure(
  kind: "gateway" | "invalid_json" | "empty" | undefined,
  tf: (k: string) => string,
): string {
  if (kind === "gateway") return tf("app.errGenerateTimeout");
  return tf("app.errNetwork");
}

function translateCheckoutApiError(code: string | undefined, tf: (k: string) => string): string {
  switch (code) {
    case "stripe_checkout_unavailable":
      return tf("report.stripeNotConfigured");
    case "stripe_price_invalid":
    case "stripe_price_inactive":
    case "stripe_price_not_one_time":
    case "stripe_price_lookup_failed":
      return tf("report.stripePriceMisconfigured");
    case "stripe_site_url_invalid":
      return tf("report.stripeSiteUrlMisconfigured");
    case "stripe_key_expired":
      return tf("report.stripeKeyExpired");
    case "auth_required":
    case "invalid_session":
      return tf("report.stripeSignInFirst");
    case "already_unlocked":
      return tf("report.stripeAlreadyOwned");
    case "report_not_found":
      return tf("report.stripeSaveFirst");
    default:
      return tf("report.stripeErr");
  }
}

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
    if (!f.campusCulturePref) return tr("validation.campusCulture");
    if (f.geoPrefs.length === 0) return tr("validation.geo");
  }
  if (step === 3) {
    if (!f.riskStyle) return tr("validation.risk");
    if (f.activities.length > 600) return tr("validation.activitiesLen");
  }
  return null;
}

function mergeSupplementaryNotes(...groups: SupplementaryNote[][]): SupplementaryNote[] {
  const seen = new Set<string>();
  const merged: SupplementaryNote[] = [];
  for (const group of groups) {
    for (const note of group) {
      const topic = note.topic.trim();
      const text = note.text.trim();
      if (!text) continue;
      const key = `${topic.toLowerCase()}::${text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ topic, text });
    }
  }
  return merged.slice(-24);
}

function readStoredSupabaseAccessToken(): string | null {
  try {
    const stores = [localStorage, sessionStorage];
    for (const store of stores) {
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { access_token?: string; currentSession?: { access_token?: string } };
        const token = parsed.access_token ?? parsed.currentSession?.access_token ?? "";
        if (token.trim()) return token.trim();
      }
    }
  } catch {
    /* ignore malformed browser storage */
  }
  return null;
}

export default function App() {
  const { t, locale } = useLanguage();
  const stripeCheckoutEnabled = isStripeCheckoutEnabled();
  const essayAnalysisCheckoutEnabled = isEssayAnalysisCheckoutEnabled();
  const inviteCodesEnabled = isInviteCodesEnabled();
  const cloudEntitlementsEnabled = stripeCheckoutEnabled || inviteCodesEnabled;
  const demoUnlockEnabled = !cloudEntitlementsEnabled && import.meta.env.DEV;
  const [flowStarted, setFlowStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [guideTouch, setGuideTouch] = useState<GuideTouch>({});
  const [view, setView] = useState<"form" | "report" | "account" | "intro">("form");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentApplicationId, setCurrentApplicationId] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const currentApplicationIdRef = useRef<string | null>(null);
  const [saveBannerDismissed, setSaveBannerDismissed] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const { user, loading: authLoading, configured: authConfigured, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [unlockedApplicationIds, setUnlockedApplicationIds] = useState<string[]>([]);
  const submitLockRef = useRef(false);
  const authReturnRef = useRef(isAuthReturnUrl());
  const applicationHubTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [applicationHubOpen, setApplicationHubOpen] = useState(false);
  const [brandStoryOpen, setBrandStoryOpen] = useState(false);
  const [expertConsultModalOpen, setExpertConsultModalOpen] = useState(false);
  const [landingMarqueeVisible, setLandingMarqueeVisible] = useState(true);

  const openApplicationHub = useCallback((e: MouseEvent<HTMLElement>) => {
    applicationHubTriggerRef.current = e.currentTarget as HTMLButtonElement;
    setApplicationHubOpen(true);
  }, []);
  const [reportRefreshing, setReportRefreshing] = useState(false);
  const [reportDiff, setReportDiff] = useState<ReportDiff | null>(null);
  const [highlightSchoolKeys, setHighlightSchoolKeys] = useState<Set<string>>(new Set());
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [subtleRefreshNotice, setSubtleRefreshNotice] = useState<string | null>(null);
  const refreshLockRef = useRef(false);
  const autoSaveAfterAuthKeyRef = useRef<string | null>(null);
  /** 五维「下一步」下提交的补充；与信息缺口触发的刷新合并后一并 POST */
  const profileFiveSupplementaryRef = useRef<SupplementaryNote[]>([]);
  /** 信息缺口的历史回答需要跨多轮刷新持续传给模型，避免同一问题被反复追问 */
  const answeredGapSupplementaryRef = useRef<SupplementaryNote[]>([]);
  const highlightTimerRef = useRef<number | null>(null);

  const stepError = useMemo(() => validateStep(step, form, t), [step, form, t]);

  const authChromeHandlers = useMemo(
    () => ({
      onSignIn: () => setAuthModalOpen(true),
      onOpenAccount: () => setView("account"),
    }),
    [],
  );

  const withChrome = useCallback(
    (content: ReactNode, options?: { showExpertConsult?: boolean }) => (
      <AuthChromeProvider value={authChromeHandlers}>
        <AppTopChrome
          expertConsultLabel={options?.showExpertConsult ? t("app.expertConsult.cta") : undefined}
          onExpertConsult={options?.showExpertConsult ? () => setExpertConsultModalOpen(true) : undefined}
        />
        {content}
      </AuthChromeProvider>
    ),
    [authChromeHandlers, t],
  );

  const refreshEntitlements = useCallback(async (): Promise<string[]> => {
    if (!cloudEntitlementsEnabled || !user || !authConfigured) {
      setUnlockedApplicationIds([]);
      return [];
    }
    try {
      const ids = await fetchUnlockedApplicationIds();
      setUnlockedApplicationIds(ids);
      return ids;
    } catch {
      setUnlockedApplicationIds([]);
      return [];
    }
  }, [cloudEntitlementsEnabled, user, authConfigured]);

  const handleInviteRedeem = useCallback(
    async (code: string) => {
      if (!inviteCodesEnabled || !currentApplicationId) {
        setSaveNotice(t("report.inviteNeedSave"));
        return;
      }
      setInviteBusy(true);
      try {
        const res = await redeemInviteCode(code.trim(), currentApplicationId);
        if (!res.ok) {
          setSaveNotice(translateInviteError(res.error, t));
          return;
        }
        const ids = await refreshEntitlements();
        if (res.already) {
          setReportUnlocked(ids.includes(currentApplicationId));
          setSaveNotice(t("report.stripeAlreadyOwned"));
          return;
        }
        setReportUnlocked(ids.includes(currentApplicationId));
        setSaveNotice(t("report.inviteRedeemSuccess"));
      } catch (e) {
        setSaveNotice(formatSupabaseError(e, t));
      } finally {
        setInviteBusy(false);
      }
    },
    [inviteCodesEnabled, currentApplicationId, t, refreshEntitlements],
  );

  const persistToCloud = useCallback(
    async (payload: {
      formState: FormState;
      reportPayload: ReportPayload;
      applicationId?: string | null;
      accessToken?: string | null;
    }): Promise<{
      ok: boolean;
      applicationId: string | null;
      reportId: string | null;
    }> => {
      if (!user || !authConfigured)
        return { ok: false, applicationId: currentApplicationId, reportId: currentReportId };
      try {
        const { applicationId, reportId } = await saveUserSession({
          applicationId: payload.applicationId ?? currentApplicationId,
          form: payload.formState,
          locale,
          report: payload.reportPayload,
          supplementaryNotes: mergeSupplementaryNotes(answeredGapSupplementaryRef.current, profileFiveSupplementaryRef.current),
        }, payload.accessToken ?? undefined);
        setCurrentApplicationId(applicationId);
        setCurrentReportId(reportId);
        clearPendingSave();
        setSessionSaved(true);
        setSaveNotice(t("auth.saveSuccess"));
        return { ok: true, applicationId, reportId };
      } catch (e) {
        setSaveNotice(formatSupabaseError(e, t));
        return { ok: false, applicationId: currentApplicationId, reportId: currentReportId };
      }
    },
    [user, authConfigured, currentApplicationId, currentReportId, locale, t],
  );

  const handleReportUnlockFlow = useCallback(async () => {
    const getActiveAccessToken = async () => {
      if (session?.access_token) return session.access_token;
      const sb = getSupabase();
      if (!sb) return readStoredSupabaseAccessToken();
      const { data } = await sb.auth.getSession();
      if (data.session?.access_token) return data.session.access_token;
      const refreshed = await sb.auth.refreshSession();
      if (refreshed.data.session?.access_token) return refreshed.data.session.access_token;
      return readStoredSupabaseAccessToken();
    };

    if (!stripeCheckoutEnabled) {
      if (inviteCodesEnabled) {
        const accessToken = await getActiveAccessToken();
        if (!accessToken) {
          if (report) {
            writePendingSave({ form, locale, report, reportUnlocked: false });
          }
          setSaveNotice(t("report.inviteSignInFirst"));
          setAuthModalOpen(true);
          return;
        }
        if (!report) return;
        setCheckoutBusy(true);
        try {
          let appId = currentApplicationId;
          if (!appId) {
            const saved = await persistToCloud({ formState: form, reportPayload: report, accessToken });
            if (!saved.ok || !saved.applicationId) return;
            appId = saved.applicationId;
          }
          const refreshed = await refreshEntitlements();
          if (appId && refreshed.includes(appId)) {
            setReportUnlocked(true);
            setSaveNotice(t("report.stripeAlreadyOwned"));
            return;
          }
          setSaveNotice(t("report.inviteUseCodeBelow"));
          queueMicrotask(() =>
            document
              .getElementById("report-invite-redeem")
              ?.scrollIntoView({ behavior: "smooth", block: "center" }),
          );
        } catch (e) {
          setSaveNotice(formatSupabaseError(e, t));
        } finally {
          setCheckoutBusy(false);
        }
        return;
      }
      if (!demoUnlockEnabled) {
        setSaveNotice(t("report.unlockUnavailable"));
        return;
      }
      writeUnlockToStorage();
      setReportUnlocked(true);
      if (report) {
        writePendingSave({ form, locale, report, reportUnlocked: true });
      }
      if (user && report) {
        await persistToCloud({ formState: form, reportPayload: report });
      }
      return;
    }

    const accessToken = await getActiveAccessToken();
    if (!accessToken) {
      if (report) {
        writePendingSave({ form, locale, report, reportUnlocked: false });
      }
      setSaveNotice(t("report.stripeSignInFirst"));
      setAuthModalOpen(true);
      return;
    }

    if (!report) return;

    setCheckoutBusy(true);
    try {
      let appId = currentApplicationId;
      const repId = currentReportId;

      const refreshed = await refreshEntitlements();
      if (appId && refreshed.includes(appId)) {
        setReportUnlocked(true);
        setSaveNotice(t("report.stripeAlreadyOwned"));
        return;
      }

      const res = await fetch(apiUrl("/api/stripe/create-checkout-session"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          repId
            ? { reportId: repId }
            : {
                applicationId: appId,
                form,
                locale,
                report,
                supplementaryNotes: mergeSupplementaryNotes(answeredGapSupplementaryRef.current, profileFiveSupplementaryRef.current),
              },
        ),
      });

      let data: { applicationId?: string; error?: string; reportId?: string; url?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (res.status === 409) {
        setSaveNotice(t("report.stripeAlreadyOwned"));
        const ids = await refreshEntitlements();
        if (appId) setReportUnlocked(ids.includes(appId));
        return;
      }

      if (!res.ok || typeof data.url !== "string") {
        setSaveNotice(translateCheckoutApiError(data.error, t));
        return;
      }

      if (data.applicationId) {
        appId = data.applicationId;
        setCurrentApplicationId(data.applicationId);
      }
      if (data.reportId) {
        setCurrentReportId(data.reportId);
        setSessionSaved(true);
        clearPendingSave();
      }

      window.location.assign(data.url);
    } catch (e) {
      setSaveNotice(formatSupabaseError(e, t));
    } finally {
      setCheckoutBusy(false);
    }
  }, [
    stripeCheckoutEnabled,
    inviteCodesEnabled,
    user,
    session,
    report,
    form,
    locale,
    currentApplicationId,
    currentReportId,
    t,
    demoUnlockEnabled,
    persistToCloud,
    refreshEntitlements,
  ]);

  /** 刷新页面或邮件 Magic Link 回到本站后，恢复未登录前生成的报告 */
  useEffect(() => {
    const pending = readPendingSave();
    if (!pending) return;
    setForm(pending.form);
    setReport(pending.report);
    answeredGapSupplementaryRef.current = pending.supplementaryNotes ?? [];
    profileFiveSupplementaryRef.current = [];
    setReportUnlocked(
      cloudEntitlementsEnabled ? false : demoUnlockEnabled && (Boolean(pending.reportUnlocked) || readUnlockFromStorage()),
    );
    setView("report");
    setFlowStarted(true);
    if (authReturnRef.current) {
      setAuthModalOpen(false);
      setSaveBannerDismissed(true);
      queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  }, [cloudEntitlementsEnabled, demoUnlockEnabled]);

  useEffect(() => {
    if (authLoading || !user) return;
    setSaveNotice((notice) =>
      notice === t("report.stripeSignInFirst") || notice === t("report.inviteSignInFirst") ? null : notice,
    );
    setAuthModalOpen(false);
    const pending = readPendingSave();
    if (!pending) return;
    setForm(pending.form);
    setReport(pending.report);
    answeredGapSupplementaryRef.current = pending.supplementaryNotes ?? [];
    profileFiveSupplementaryRef.current = [];
    setReportUnlocked(
      cloudEntitlementsEnabled ? false : demoUnlockEnabled && (Boolean(pending.reportUnlocked) || readUnlockFromStorage()),
    );
    setView("report");
    setFlowStarted(true);
    setSaveBannerDismissed(true);
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    void (async () => {
      const { ok, applicationId } = await persistToCloud({
        formState: pending.form,
        reportPayload: pending.report,
      });
      if (cloudEntitlementsEnabled && ok && applicationId) {
        const ids = await refreshEntitlements();
        setReportUnlocked(ids.includes(applicationId));
      }
    })();
  }, [authLoading, user, persistToCloud, refreshEntitlements, cloudEntitlementsEnabled, demoUnlockEnabled]);

  useEffect(() => {
    if (authLoading || !user || view !== "report" || !report || sessionSaved) return;
    if (readPendingSave()) return;
    const key = `${user.id}:${currentApplicationId ?? "new"}:${JSON.stringify(report).length}`;
    if (autoSaveAfterAuthKeyRef.current === key) return;
    autoSaveAfterAuthKeyRef.current = key;
    setSaveNotice((notice) =>
      notice === t("report.stripeSignInFirst") || notice === t("report.inviteSignInFirst") ? null : notice,
    );
    void (async () => {
      const { ok, applicationId } = await persistToCloud({ formState: form, reportPayload: report });
      if (cloudEntitlementsEnabled && ok && applicationId) {
        const ids = await refreshEntitlements();
        setReportUnlocked(ids.includes(applicationId));
      }
    })();
  }, [
    authLoading,
    user,
    view,
    report,
    sessionSaved,
    currentApplicationId,
    form,
    persistToCloud,
    cloudEntitlementsEnabled,
    refreshEntitlements,
    t,
  ]);

  useEffect(() => {
    currentApplicationIdRef.current = currentApplicationId;
  }, [currentApplicationId]);

  useEffect(() => {
    void refreshEntitlements();
  }, [refreshEntitlements]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const st = p.get("stripe_checkout");
    if (!st || !stripeCheckoutEnabled) return;
    const path = `${window.location.pathname}${window.location.hash}`;
    void (async () => {
      if (st === "success") {
        const ids = await refreshEntitlements();
        setSaveNotice(t("report.stripeSuccessBanner"));
        const aid = currentApplicationIdRef.current;
        if (aid) setReportUnlocked(ids.includes(aid));
      } else if (st === "cancel") {
        setSaveNotice(t("report.stripeCanceled"));
      }
      window.history.replaceState({}, "", path);
    })();
  }, [stripeCheckoutEnabled, refreshEntitlements, t]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const st = p.get("essay_checkout");
    if (!st || !essayAnalysisCheckoutEnabled || authLoading) return;
    const path = `${window.location.pathname}${window.location.hash}`;
    if (user) {
      setView("account");
    }
    window.history.replaceState({}, "", path);
  }, [essayAnalysisCheckoutEnabled, authLoading, user]);

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

  useEffect(() => {
    const root = document.documentElement;
    if (flowStarted) {
      setLandingMarqueeVisible(false);
      root.removeAttribute("data-landing");
      root.setAttribute("data-hide-brand-wall", "");
      return () => root.removeAttribute("data-hide-brand-wall");
    }
    root.setAttribute("data-landing", "");
    root.removeAttribute("data-hide-brand-wall");
    const onScroll = () => setLandingMarqueeVisible(window.scrollY < 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute("data-landing");
    };
  }, [flowStarted]);

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
      const existingNotes = mergeSupplementaryNotes(answeredGapSupplementaryRef.current, profileFiveSupplementaryRef.current);
      const res = await fetch(apiUrl("/api/report"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReportApiBody(form, existingNotes.length > 0 ? existingNotes : undefined, locale)),
      });
      const llmMs = res.headers.get("X-LLM-Duration-Ms");
      const parsed = await readApiJson(res);
      if (!parsed.ok) {
        if (import.meta.env.DEV) console.warn("[report] response_parse_failed", parsed.kind, res.status);
        setErr(translateReportFetchFailure(parsed.kind, t));
        return;
      }
      const data = parsed.data;
      if (import.meta.env.DEV) {
        const total = Math.round(performance.now() - t0);
        console.debug(
          `[report] client_total_ms=${total}` + (llmMs != null ? ` server_llm_ms=${llmMs}` : ""),
        );
      }
      if (!res.ok) {
        setErr(translateReportApiError(typeof data.error === "string" ? data.error : undefined, t));
        return;
      }
      setReportDiff(null);
      setHighlightSchoolKeys(new Set());
      setRefreshError(null);
      setSubtleRefreshNotice(null);
      answeredGapSupplementaryRef.current = existingNotes;
      profileFiveSupplementaryRef.current = [];
      const nextReport = data as unknown as ReportPayload;
      setReport(nextReport);
      setView("report");
      setSessionSaved(false);
      setSaveNotice(null);
      writePendingSave({
        form,
        locale,
        report: nextReport,
        supplementaryNotes: existingNotes.length > 0 ? existingNotes : undefined,
        reportUnlocked: false,
      });
      if (user) {
        const saved = await persistToCloud({ formState: form, reportPayload: nextReport });
        if (cloudEntitlementsEnabled && saved.ok && saved.applicationId) {
          const ids = await refreshEntitlements();
          clearUnlockStorage();
          setReportUnlocked(ids.includes(saved.applicationId));
        } else {
          clearUnlockStorage();
          setReportUnlocked(false);
        }
      } else {
        clearUnlockStorage();
        setReportUnlocked(false);
      }
      queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[report] fetch_failed", e);
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
    answeredGapSupplementaryRef.current = mergeSupplementaryNotes(answeredGapSupplementaryRef.current, gapNotes);
    const merged = mergeSupplementaryNotes(answeredGapSupplementaryRef.current, profileFiveSupplementaryRef.current);
    try {
      const res = await fetch(apiUrl("/api/report"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReportApiBody(form, merged.length > 0 ? merged : undefined, locale)),
      });
      const parsed = await readApiJson(res);
      if (!parsed.ok) {
        setRefreshError(translateReportFetchFailure(parsed.kind, t));
        return;
      }
      const data = parsed.data;
      if (!res.ok) {
        setRefreshError(translateReportApiError(typeof data.error === "string" ? data.error : undefined, t));
        return;
      }
      const next = data as unknown as ReportPayload;
      setReport(next);
      if (user) {
        const saved = await persistToCloud({ formState: form, reportPayload: next });
        if (cloudEntitlementsEnabled && saved.ok && saved.applicationId) {
          const ids = await refreshEntitlements();
          setReportUnlocked(ids.includes(saved.applicationId));
        }
      } else {
        writePendingSave({ form, locale, report: next, supplementaryNotes: merged, reportUnlocked });
      }
      const diff = compareReports(prev, next, { prevForm: form, nextForm: form, locale });
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
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[report] refresh_fetch_failed", e);
      setRefreshError(t("app.errNetwork"));
    } finally {
      refreshLockRef.current = false;
      setReportRefreshing(false);
    }
  }

  async function commitProfileFiveNotesAndRefresh(notes: SupplementaryNote[]) {
    profileFiveSupplementaryRef.current = mergeSupplementaryNotes(profileFiveSupplementaryRef.current, notes);
    await refreshReportWithGapNotes([]);
  }

  if (view === "intro") {
    return withChrome(
      <ProductIntroPage
        onBack={() => {
          setView("form");
          setFlowStarted(false);
        }}
        onStart={() => {
          setApplicationHubOpen(false);
          setFlowStarted(true);
          setView("form");
          queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        }}
      />,
    );
  }

  if (view === "account" && user) {
    return withChrome(
      <>
        <AccountHome
          unlockedApplicationIds={unlockedApplicationIds}
          onOpenAppLinks={openApplicationHub}
          onBack={() => {
            if (report) setView("report");
            else if (flowStarted) setView("form");
            else setView("form");
          }}
          onNewApplication={() => {
            setForm(initialForm);
            setReport(null);
            setCurrentApplicationId(null);
            setCurrentReportId(null);
            setStep(1);
            setFlowStarted(true);
            setView("form");
            setSessionSaved(false);
            setSaveBannerDismissed(false);
            clearPendingSave();
          }}
          onEditForm={({ form: f, applicationId, supplementaryNotes, targetStep }) => {
            setForm(f);
            setCurrentApplicationId(applicationId);
            setReport(null);
            answeredGapSupplementaryRef.current = supplementaryNotes ?? [];
            profileFiveSupplementaryRef.current = [];
            setStep(targetStep ?? 1);
            setFlowStarted(true);
            setView("form");
          }}
          onOpenReport={async ({
            form: f,
            report: r,
            applicationId,
            reportId,
            supplementaryNotes,
            reportUnlocked: legacyUnlocked,
          }) => {
            const ids =
              cloudEntitlementsEnabled && user ? await refreshEntitlements() : unlockedApplicationIds;
            const entitled = cloudEntitlementsEnabled && ids.includes(applicationId);
            setForm(f);
            setReport(r);
            setCurrentApplicationId(applicationId);
            setCurrentReportId(reportId);
            answeredGapSupplementaryRef.current = supplementaryNotes ?? [];
            profileFiveSupplementaryRef.current = [];
            setSessionSaved(true);
            if (cloudEntitlementsEnabled) {
              clearUnlockStorage();
              setReportUnlocked(entitled);
            } else if (demoUnlockEnabled && legacyUnlocked) {
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
        <FullscreenLogoMarquee
          open={applicationHubOpen}
          onClose={() => {
            setApplicationHubOpen(false);
            queueMicrotask(() => applicationHubTriggerRef.current?.focus());
          }}
        />
        <AuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          successHint={saveNotice}
          onOpenAppLinks={openApplicationHub}
        />
      </>,
    );
  }

  if (view === "report" && report) {
    return withChrome(
      <>
      <ReportView
        report={report}
        form={form}
        applicationId={currentApplicationId}
        reportId={currentReportId}
        unlocked={reportUnlocked}
        authConfigured={authConfigured}
        isAuthenticated={Boolean(user)}
        showSaveBanner={authConfigured && !user && !saveBannerDismissed && !authLoading}
        sessionSaved={sessionSaved}
        pdfRecipientName={user?.email ?? null}
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
        stripeCheckoutEnabled={stripeCheckoutEnabled}
        inviteCodesEnabled={inviteCodesEnabled}
        inviteRedeemBusy={inviteBusy}
        onRedeemInviteCode={(c) => void handleInviteRedeem(c)}
        purchaseBusy={checkoutBusy}
        purchaseNotice={saveNotice}
        onUnlock={() => void handleReportUnlockFlow()}
        onReset={() => {
          clearUnlockStorage();
          setReportUnlocked(false);
          profileFiveSupplementaryRef.current = [];
          answeredGapSupplementaryRef.current = [];
          setCurrentApplicationId(null);
          setCurrentReportId(null);
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
      <FullscreenLogoMarquee
        open={applicationHubOpen}
        onClose={() => {
          setApplicationHubOpen(false);
          queueMicrotask(() => applicationHubTriggerRef.current?.focus());
        }}
      />
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        successHint={saveNotice}
        onOpenAppLinks={openApplicationHub}
      />
      </>,
    );
  }

  if (!flowStarted) {
    return withChrome(
      <div className="app app--landing">
        <div className="landing-hero-fold">
        <div className="landing-sheet">
          <header className="landing-hero">
            <button
              type="button"
              className="landing-logo-button"
              onClick={() => setBrandStoryOpen(true)}
              aria-label="了解 OnlyApply"
            >
              <BrandLogo className="landing-logo" />
            </button>
            <div className="landing-copy">
              <h1 className="landing-title">
                <span className="landing-title__l1">{t("app.hero.titleLine1")}</span>
                <span className="landing-title__l2">{t("app.hero.titleLine2")}</span>
              </h1>
              <p className="landing-lead">{t("app.hero.lead")}</p>
            </div>
          </header>

          <div
            className={
              landingMarqueeVisible ? "landing-hero-marquee-wrap" : "landing-hero-marquee-wrap landing-hero-marquee-wrap--hidden"
            }
            aria-hidden={!landingMarqueeVisible}
          >
            <UniversityLogoMarquee colored className="landing-hero-marquee" durationSec={100} />
          </div>

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
            <button
              type="button"
              className="btn btn-secondary btn-block landing-intro-btn"
              onClick={() => {
                setApplicationHubOpen(false);
                document.getElementById("landing-product-intro")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {t("app.productIntroLink")}
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
              onClick={(e) => openApplicationHub(e)}
            >
              {t("appLinks.entry")}
            </button>
          </div>
        </div>
        </div>

        <ProductIntroContent
          id="landing-product-intro"
          variant="embedded"
          onStart={() => {
            setApplicationHubOpen(false);
            setFlowStarted(true);
            queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          }}
        />

        <FullscreenLogoMarquee
          open={applicationHubOpen}
          onClose={() => {
            setApplicationHubOpen(false);
            queueMicrotask(() => applicationHubTriggerRef.current?.focus());
          }}
        />

        <BrandStoryOverlay
          open={brandStoryOpen}
          onClose={() => setBrandStoryOpen(false)}
          onStart={() => {
            setBrandStoryOpen(false);
            setApplicationHubOpen(false);
            setFlowStarted(true);
            queueMicrotask(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          }}
        />

        <ExpertConsultContactModal open={expertConsultModalOpen} onClose={() => setExpertConsultModalOpen(false)} />

        <footer className="app-disclaimer-fixed" role="contentinfo">
          <p>{t("app.disclaimer")}</p>
          <LegalLinks className="app-disclaimer-fixed__legal" />
        </footer>
        <AuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          successHint={saveNotice}
          onOpenAppLinks={openApplicationHub}
        />
      </div>,
      { showExpertConsult: true },
    );
  }

  return withChrome(
    <>
    <div className="app app--flow">
      <header className="hero--compact">
        <BrandLogo />
        <div className="hero--compact-copy">
          <h1>{t("app.flow.headline")}</h1>
          <p className="hero-flow-tagline">{t("app.flow.tagline")}</p>
        </div>
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
        <LegalLinks className="app-disclaimer-fixed__legal" />
      </footer>
    </div>
      <FullscreenLogoMarquee
        open={applicationHubOpen}
        onClose={() => {
          setApplicationHubOpen(false);
          queueMicrotask(() => applicationHubTriggerRef.current?.focus());
        }}
      />
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        successHint={saveNotice}
        onOpenAppLinks={openApplicationHub}
      />
    </>,
  );
}
