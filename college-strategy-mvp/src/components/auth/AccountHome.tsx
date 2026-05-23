import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  deleteApplication,
  fetchEssayAnalysisReportIds,
  getEssayWorkspace,
  getApplicationReports,
  listApplications,
  redeemEssayAnalysisInviteCode,
  updateApplicationForm,
  upsertEssayDraft,
  type ApplicationListItem,
  type EssayAnalysisPayload,
  type EssayAnalysisRow,
  type SavedReportRow,
} from "../../lib/supabase/accounts";
import { apiUrl } from "../../lib/apiBase";
import { isEssayAnalysisCheckoutEnabled } from "../../lib/stripeCheckout";
import { isInviteCodesEnabled } from "../../lib/inviteCodes";
import { formatSupabaseError } from "../../lib/supabase/errors";
import { buildBiggestGapBlock, buildOverallVerdict } from "../../lib/decisionReport";
import { buildFiveDimensionProfile, type ProfileDimensionKey } from "../../lib/fiveDimensionProfile";
import type { ActivityItem, FormState, GeoPref, ReportPayload, SupplementaryNote } from "../../types";
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
  onEditForm: (payload: { form: FormState; applicationId: string; supplementaryNotes?: SupplementaryNote[]; targetStep?: number }) => void;
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

function optionLabel(kind: "identity" | "budget" | "testing" | "size" | "culture" | "risk" | "geo", value: string, locale: "zh" | "en") {
  const zh = {
    identity: { intl: "国际生", us_citizen: "美国身份", other: "其他身份" },
    budget: {
      full_pay: "可全自费",
      high_budget: "较高预算，仍控成本",
      budget_cap: "有明确预算上限",
      need_aid: "需要奖助",
      unsure: "暂不确定",
    },
    testing: { test_optional: "Test-Optional / 暂不提交", will_submit: "计划提交 SAT / ACT" },
    size: { small: "小型校园", medium: "中等规模", large: "大型校园", any: "都可以" },
    culture: {
      academic: "学术 / 研究导向",
      balanced: "学业与社交平衡",
      social: "社交 / 派对氛围活跃",
      any: "没有强烈偏好",
    },
    risk: { conservative: "偏保守", balanced: "平衡", aggressive: "偏进取" },
    geo: { west: "西海岸", east: "东海岸", south: "南部", midwest: "中西部", great_lakes: "五大湖", any: "不限地区" },
  };
  const en = {
    identity: { intl: "International", us_citizen: "U.S. citizen / resident", other: "Other identity" },
    budget: {
      full_pay: "Full-pay possible",
      high_budget: "High budget, cost matters",
      budget_cap: "Clear budget cap",
      need_aid: "Needs aid",
      unsure: "Not sure yet",
    },
    testing: { test_optional: "Test-optional / not submitting", will_submit: "Planning to submit SAT / ACT" },
    size: { small: "Small campus", medium: "Medium campus", large: "Large campus", any: "Any size" },
    culture: {
      academic: "Academic / research-oriented",
      balanced: "Balanced academic & social",
      social: "Active social / party-friendly",
      any: "No strong preference",
    },
    risk: { conservative: "Conservative", balanced: "Balanced", aggressive: "Aggressive" },
    geo: { west: "West", east: "East", south: "South", midwest: "Midwest", great_lakes: "Great Lakes", any: "Any region" },
  };
  const table = locale === "en" ? en : zh;
  return (table[kind] as Record<string, string>)[value] ?? value;
}

function toggleGeo(prefs: GeoPref[], g: GeoPref): GeoPref[] {
  if (g === "any") return prefs.includes("any") ? [] : ["any"];
  const without = prefs.filter((x) => x !== "any");
  return without.includes(g) ? without.filter((x) => x !== g) : [...without, g];
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
    { label: t("auth.accountInfoPreferences"), value: compactText([form.schoolSize ? optionLabel("size", form.schoolSize, locale) : "", form.campusCulturePref ? optionLabel("culture", form.campusCulturePref, locale) : "", geo].filter(Boolean).join(" · ")) },
    { label: t("auth.accountInfoRisk"), value: form.riskStyle ? optionLabel("risk", form.riskStyle, locale) : "" },
    { label: t("auth.accountInfoDealbreakers"), value: compactText(form.dealbreakers) },
  ].filter((item) => item.value);
}

function firstUsefulLine(items: string[] | undefined): string {
  return (items ?? []).map((x) => x.trim()).find(Boolean) ?? "";
}

function essayDraftStorageKey(reportId: string): string {
  return `college_strategy_essay_draft_v1_${reportId}`;
}

function loadEssayDraft(reportId: string): string {
  try {
    return localStorage.getItem(essayDraftStorageKey(reportId)) ?? "";
  } catch {
    return "";
  }
}

function saveEssayDraft(reportId: string, value: string) {
  try {
    localStorage.setItem(essayDraftStorageKey(reportId), value);
  } catch {
    /* ignore */
  }
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

type EssayDraftAnalysis = EssayAnalysisPayload;

function translateEssayInviteError(code: string, t: ReturnType<typeof useLanguage>["t"]): string {
  const known = new Set([
    "generic",
    "not_authenticated",
    "application_missing",
    "application_not_found",
    "report_missing",
    "report_not_found",
    "empty_code",
    "invalid_code",
    "inactive_code",
    "not_started",
    "expired",
    "code_exhausted",
    "user_limit",
    "already_redeemed_here",
    "bad_response",
    "unknown",
  ]);
  return t(`report.inviteErr.${known.has(code) ? code : "unknown"}`);
}

function buildEssayStrategy(form: FormState, report: ReportPayload | null, locale: "zh" | "en") {
  const isEn = locale === "en";
  const profile = buildFiveDimensionProfile(form, locale);
  const verdict = buildOverallVerdict(form, profile, locale);
  const gap = buildBiggestGapBlock(profile, locale);
  const essays = profile.find((x) => x.key === "essays");
  const activities = compactText(form.activities, 150);
  const major = compactText([form.majorPrimary, form.majorSecondary].filter(Boolean).join(" / "), 90);
  const weakness = dimensionLabel(gap.dimension.key, locale);
  const reportSignal =
    firstUsefulLine(report?.strategy_notes) ||
    firstUsefulLine(report?.executive_summary) ||
    report?.portfolio_risks?.[0]?.what_it_means_for_you ||
    "";
  const biggestRisk = report?.portfolio_risks?.[0]?.risk_title || "";
  const hasGaps = Boolean(report?.information_gaps?.length);

  const anchor = isEn
    ? major
      ? `Current positioning: ${verdict.headline}. The essay should show why ${major} has become personally specific, while also answering the current weak spot: ${weakness}.`
      : `Current positioning: ${verdict.headline}. The essay should make the student feel specific first, while also answering the current weak spot: ${weakness}.`
    : major
      ? `你当前定位是：${verdict.headline}。文书主轴要写清「为什么 ${major} 对你变得具体」，同时回应当前短板：${weakness}。`
      : `你当前定位是：${verdict.headline}。文书先要把“你是谁”写具体，同时回应当前短板：${weakness}。`;

  const lead = isEn
    ? `Your current problem is not “no topic”; it is that ${weakness} still needs evidence. ${essays?.judgment ?? ""}`.trim()
    : `你当前的问题不是“没有题材”，而是「${weakness}」还需要证据。${essays?.judgment ?? ""}`.trim();

  const storyAngles = [
    activities
      ? isEn
        ? `Because your current positioning is "${verdict.headline}", start from one lived scene in your activities that proves this read rather than repeating your resume.`
        : `因为你当前定位是「${verdict.headline}」，先从活动经历里选一个能证明这个判断的真实场景，而不是复述简历。`
      : isEn
        ? `Because the current weak spot is ${weakness}, add one concrete episode with time, action, and outcome before drafting. The essay needs a scene, not a slogan.`
        : `因为当前短板是「${weakness}」，动笔前先补一段具体片段：时间、行动、结果。文书需要场景，不需要口号。`,
    major
      ? isEn
        ? `Connect the scene back to ${major}: show the question, problem, or habit of mind that makes your current positioning believable.`
        : `把场景和 ${major} 连起来：写清楚是哪一个问题、习惯或思考方式让当前定位变得可信。`
      : isEn
        ? `If the major is still undecided, write toward a pattern of curiosity that compensates for ${weakness}; do not pretend the academic path is fixed.`
        : `如果专业方向还没完全定，就写能补足「${weakness}」的好奇心模式，不要假装路径已经固定。`,
    reportSignal
      ? isEn
        ? `Use the latest report as the filter for what to include: ${compactText(reportSignal, 135)}`
        : `用最新报告里的判断决定素材取舍：${compactText(reportSignal, 135)}`
      : isEn
        ? `Use the latest school strategy as a filter: the essay should support "${verdict.headline}" instead of creating a separate persona.`
        : `用最新选校策略做筛选器：文书要支撑「${verdict.headline}」，不要另起一个人设。`,
  ];

  const avoid = [
    isEn
      ? "Do not write a polished version of the resume. Admissions already sees activities; the essay should show judgment, tension, and change."
      : "不要写成精装修版简历。招生官已经能看到活动，文书要补的是判断、冲突和变化。",
    biggestRisk
      ? isEn
        ? `Do not ignore the current risk area: ${compactText(biggestRisk, 90)}. If it appears in the essay, handle it with maturity rather than defense.`
        : `不要回避当前风险点：${compactText(biggestRisk, 90)}。如果文书触及它，要写成熟处理，而不是辩解。`
      : isEn
        ? "Do not over-explain prestige, rankings, or outcomes. The strongest draft usually makes the reader care before it asks them to be impressed."
        : "不要过度解释名校、排名或结果。好的文书通常先让读者在乎你，再让读者认可你。",
    hasGaps
      ? isEn
        ? "Do not fill missing facts with invention. If the report still has gaps, answer those before committing to the final essay angle."
        : "不要用想象补齐事实。如果报告仍有信息缺口，先补事实，再确定最终选题。"
      : isEn
        ? "Do not make the essay carry every strength. Pick one human thread and let the rest stay in the application."
        : "不要让一篇文书承担所有优点。选一条有人味的主线，其余优势留给申请材料整体呈现。",
  ];

  const nextStep = isEn
    ? `Please write one paragraph: where you were -> what happened -> what you did -> what changed. Make it answer the weak spot "${weakness}" and support the positioning "${verdict.headline}".`
    : `请写一段：你在哪里 → 发生什么 → 你做了什么 → 结果。它要回应短板「${weakness}」，并支撑当前定位「${verdict.headline}」。`;
  const ordinaryExample = isEn
    ? `I have always been interested in ${major || "my field"} and joined activities to improve myself. These experiences taught me persistence and leadership.`
    : `我一直对${major || "自己的方向"}很感兴趣，也参加了很多活动来提升自己。这些经历让我学会了坚持和领导力。`;
  const betterExample = isEn
    ? `In one specific moment, show the problem you faced, the choice you made, and the evidence that proves ${weakness} is becoming stronger. Then connect that change back to ${major || "your academic direction"}.`
    : `选一个具体时刻：写你遇到的问题、当时做的选择，以及什么证据能说明「${weakness}」正在被补上。最后再把这个变化连回${major || "你的学术方向"}。`;
  const exampleDraft = isEn
    ? `When I was [place], [something specific happened]. At first, I [honest reaction]. Instead of [easy choice], I chose to [your action]. The result was [visible outcome], but the more important change was [what this proves about you]. This matters for my application because it supports ${verdict.headline} and gives evidence for ${weakness}.`
    : `当时我在【地点/场景】，发生了【具体事件】。一开始我【真实反应】，但我没有选择【容易的做法】，而是【你的行动】。结果是【可见结果】，更重要的变化是【这件事证明了你什么】。这段经历之所以适合写，是因为它能支撑「${verdict.headline}」，也能补上「${weakness}」这块证据。`;

  return {
    anchor,
    lead,
    storyAngles,
    avoid,
    nextStep,
    position: verdict.headline,
    weakness,
    comparison: { ordinary: ordinaryExample, better: betterExample },
    exampleDraft,
  };
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
  const { user, session, signOut, configured } = useAuth();
  const essayAnalysisCheckoutEnabled = isEssayAnalysisCheckoutEnabled();
  const essayInviteCodesEnabled = isInviteCodesEnabled();
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportsByApp, setReportsByApp] = useState<Record<string, SavedReportRow[]>>({});
  const [loadingReports, setLoadingReports] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [essayDraftOpen, setEssayDraftOpen] = useState(false);
  const [essayExampleOpen, setEssayExampleOpen] = useState(false);
  const [essayDraft, setEssayDraft] = useState("");
  const [essayAnalysis, setEssayAnalysis] = useState<EssayDraftAnalysis | null>(null);
  const [essayPaywallOpen, setEssayPaywallOpen] = useState(false);
  const [essayCheckoutBusy, setEssayCheckoutBusy] = useState(false);
  const [essayCheckoutErr, setEssayCheckoutErr] = useState<string | null>(null);
  const [essayUnlockedReportIds, setEssayUnlockedReportIds] = useState<string[]>([]);
  const [essayAnalysisBusy, setEssayAnalysisBusy] = useState(false);
  const [essayAnalysisErr, setEssayAnalysisErr] = useState<string | null>(null);
  const [essayInviteInput, setEssayInviteInput] = useState("");
  const [essayInviteBusy, setEssayInviteBusy] = useState(false);
  const [essayAnalyses, setEssayAnalyses] = useState<EssayAnalysisRow[]>([]);
  const [essayWorkspaceLoading, setEssayWorkspaceLoading] = useState(false);
  const [essayDraftSaveState, setEssayDraftSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
  const applicationInfoItems = useMemo(
    () => (currentApp ? buildApplicationInfoItems(currentApp.form_state, locale, t) : []),
    [currentApp, locale, t],
  );
  const essayStrategy = useMemo(
    () => (currentApp && latestReport ? buildEssayStrategy(currentApp.form_state, latestReport.report_payload, locale) : null),
    [currentApp, latestReport, locale],
  );
  const essayAnalysisUnlocked = Boolean(latestReport && essayUnlockedReportIds.includes(latestReport.id));
  const visibleApps = historyExpanded ? apps : apps.slice(0, 2);

  useEffect(() => {
    const nextActivities = currentApp?.form_state.structuredActivities ?? [];
    setActivityDraft(nextActivities);
    lastSavedActivitySnapshotRef.current = JSON.stringify(nextActivities);
    setActivitySaveNotice(null);
    setProfileDraft(currentApp?.form_state ?? null);
    setProfileSaveNotice(null);
  }, [currentApp?.id]);

  useEffect(() => {
    setEssayDraftOpen(false);
    setEssayExampleOpen(false);
    setEssayAnalysis(null);
    setEssayPaywallOpen(false);
    setEssayCheckoutErr(null);
    setEssayAnalysisErr(null);
    setEssayInviteInput("");
    setEssayAnalyses([]);
    setEssayDraftSaveState("idle");
    setEssayDraft(latestReport?.id ? loadEssayDraft(latestReport.id) : "");
  }, [latestReport?.id]);

  useEffect(() => {
    if (!configured || !user || !latestReport?.id) return;
    let cancelled = false;
    setEssayWorkspaceLoading(true);
    void getEssayWorkspace(latestReport.id)
      .then(({ draft, analyses }) => {
        if (cancelled) return;
        setEssayAnalyses(analyses);
        if (draft?.draft_text || analyses.length > 0) {
          setEssayDraftOpen(true);
        }
        if (draft?.draft_text) {
          setEssayDraft(draft.draft_text);
          saveEssayDraft(latestReport.id, draft.draft_text);
        }
      })
      .catch((e) => setErr(formatSupabaseError(e, t)))
      .finally(() => {
        if (!cancelled) setEssayWorkspaceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, user, latestReport?.id, t]);

  useEffect(() => {
    if (!currentApp?.id || !latestReport?.id || !user) return;
    const draft = essayDraft.trim();
    const id = window.setTimeout(() => {
      setEssayDraftSaveState(draft ? "saving" : "idle");
      void upsertEssayDraft({
        applicationId: currentApp.id,
        reportId: latestReport.id,
        draftText: essayDraft,
      })
        .then(() => setEssayDraftSaveState(draft ? "saved" : "idle"))
        .catch(() => setEssayDraftSaveState("error"));
    }, 900);
    return () => window.clearTimeout(id);
  }, [currentApp?.id, latestReport?.id, user, essayDraft]);

  const refreshEssayEntitlements = useCallback(async () => {
    if (!configured || !user || !essayAnalysisCheckoutEnabled) {
      setEssayUnlockedReportIds([]);
      return [];
    }
    const ids = await fetchEssayAnalysisReportIds();
    setEssayUnlockedReportIds(ids);
    return ids;
  }, [configured, user, essayAnalysisCheckoutEnabled]);

  useEffect(() => {
    void refreshEssayEntitlements().catch((e) => setErr(formatSupabaseError(e, t)));
  }, [refreshEssayEntitlements, t]);

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

  function handleEssayDraftChange(value: string) {
    setEssayDraft(value);
    setEssayAnalysis(null);
    setEssayPaywallOpen(false);
    setEssayAnalysisErr(null);
    if (latestReport?.id) saveEssayDraft(latestReport.id, value);
  }

  async function runUnlockedEssayAnalysis() {
    if (!latestReport || !essayStrategy) return;
    if (!session?.access_token) {
      setEssayAnalysisErr(t("auth.accountEssaySignInRequired"));
      return;
    }
    setEssayAnalysisBusy(true);
    setEssayAnalysisErr(null);
    try {
      const res = await fetch(apiUrl("/api/essay/analyze"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId: latestReport.id,
          draft: essayDraft,
          locale,
          strategy: {
            position: essayStrategy.position,
            weakness: essayStrategy.weakness,
            anchor: essayStrategy.anchor,
            lead: essayStrategy.lead,
          },
        }),
      });
      let data: EssayDraftAnalysis | { error?: string } | null = null;
      try {
        data = (await res.json()) as EssayDraftAnalysis | { error?: string };
      } catch {
        data = null;
      }
      if (!res.ok || !data || !("verdict" in data)) {
        setEssayAnalysisErr(t("auth.accountEssayAnalysisErr"));
        return;
      }
      setEssayAnalysis(data);
      if (currentApp && data.id && data.created_at) {
        const savedRow: EssayAnalysisRow = {
          id: data.id,
          user_id: user?.id ?? "",
          application_id: currentApp.id,
          report_id: latestReport.id,
          draft_text: essayDraft,
          analysis_payload: data,
          created_at: data.created_at,
        };
        setEssayAnalyses((prev) => [savedRow, ...prev.filter((row) => row.id !== savedRow.id)].slice(0, 6));
      }
      setEssayPaywallOpen(false);
    } catch (e) {
      setEssayAnalysisErr(formatSupabaseError(e, t));
    } finally {
      setEssayAnalysisBusy(false);
    }
  }

  function handleEssayAnalyzeClick() {
    if (!essayStrategy) return;
    setEssayCheckoutErr(null);
    setEssayAnalysisErr(null);
    if (essayAnalysisUnlocked) {
      void runUnlockedEssayAnalysis();
      setEssayPaywallOpen(false);
      return;
    }
    setEssayAnalysis(null);
    setEssayPaywallOpen(true);
  }

  async function handleEssayUnlockClick() {
    if (!latestReport || !essayStrategy) return;
    setEssayCheckoutErr(null);
    if (!session?.access_token) {
      setEssayCheckoutErr(t("auth.accountEssaySignInRequired"));
      return;
    }
    setEssayCheckoutBusy(true);
    try {
      const ids = await refreshEssayEntitlements();
      if (ids.includes(latestReport.id)) {
        setEssayPaywallOpen(false);
        await runUnlockedEssayAnalysis();
        return;
      }

      const res = await fetch(apiUrl("/api/stripe/create-essay-analysis-checkout-session"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportId: latestReport.id }),
      });

      let data: { error?: string; url?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (res.status === 409) {
        await refreshEssayEntitlements();
        setEssayPaywallOpen(false);
        await runUnlockedEssayAnalysis();
        return;
      }

      if (!res.ok || typeof data.url !== "string") {
        setEssayCheckoutErr(t("auth.accountEssayCheckoutErr"));
        return;
      }

      window.location.assign(data.url);
    } catch (e) {
      setEssayCheckoutErr(formatSupabaseError(e, t));
    } finally {
      setEssayCheckoutBusy(false);
    }
  }

  async function handleEssayInviteRedeem() {
    if (!currentApp || !latestReport || !essayStrategy) return;
    setEssayCheckoutErr(null);
    if (!session?.access_token) {
      setEssayCheckoutErr(t("auth.accountEssaySignInRequired"));
      return;
    }
    setEssayInviteBusy(true);
    try {
      const res = await redeemEssayAnalysisInviteCode(
        essayInviteInput.trim(),
        currentApp.id,
        latestReport.id,
      );
      if (!res.ok) {
        setEssayCheckoutErr(translateEssayInviteError(res.error, t));
        return;
      }
      setEssayUnlockedReportIds((prev) => [...new Set([...prev, latestReport.id])]);
      setEssayPaywallOpen(false);
      setEssayInviteInput("");
      void refreshEssayEntitlements().catch(() => {
        /* Local unlock is enough for the immediate analysis; sync can recover on next load. */
      });
      await runUnlockedEssayAnalysis();
    } catch (e) {
      const raw =
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string"
            ? String((e as { message: string }).message)
            : "";
      setEssayCheckoutErr(raw ? `${formatSupabaseError(e, t)}（${raw}）` : formatSupabaseError(e, t));
    } finally {
      setEssayInviteBusy(false);
    }
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

        {currentApp && (
          <section className="account-activity-card" aria-labelledby="account-activity-title">
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
              <button type="button" className="btn btn-secondary" onClick={() => setActivityEditorOpen((v) => !v)}>
                {activityEditorOpen ? t("auth.accountActivityCollapse") : t("auth.accountActivityEdit")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void handleUpdateReportFromActivities()} disabled={activitySaveBusy}>
                {t("auth.accountActivityUpdateReport")}
              </button>
            </div>
          </section>
        )}

        <section className="account-essay-card" aria-labelledby="account-essay-title">
          <div className="account-essay-card__head">
            <div>
              <p className="account-essay-card__kicker">{t("auth.accountEssayKicker")}</p>
              <h2 id="account-essay-title">{t("auth.accountEssayTitle")}</h2>
            </div>
            <span>{t("auth.accountEssayBadge")}</span>
          </div>

          {essayStrategy ? (
            <>
              <div className="account-essay-anchor">
                <span>{t("auth.accountEssayAnchor")}</span>
                <strong>{essayStrategy.anchor}</strong>
                <p>{essayStrategy.lead}</p>
              </div>

              <div className="account-essay-grid">
                <div>
                  <h3>{t("auth.accountEssayAngles")}</h3>
                  <ol>
                    {essayStrategy.storyAngles.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3>{t("auth.accountEssayAvoid")}</h3>
                  <ul>
                    {essayStrategy.avoid.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="account-essay-compare">
                <h3>{t("auth.accountEssayCompare")}</h3>
                <div className="account-essay-compare__grid">
                  <div>
                    <span>{t("auth.accountEssayOrdinary")}</span>
                    <p>{essayStrategy.comparison.ordinary}</p>
                  </div>
                  <div>
                    <span>{t("auth.accountEssayBetter")}</span>
                    <p>{essayStrategy.comparison.better}</p>
                  </div>
                </div>
              </div>

              <p className="account-essay-next">
                <strong>{t("auth.accountEssayNext")}</strong>
                {essayStrategy.nextStep}
              </p>

              <div className="account-essay-actions">
                <button type="button" className="btn btn-primary" onClick={() => setEssayDraftOpen(true)}>
                  {t("auth.accountEssayStartWriting")}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEssayExampleOpen((v) => !v)}>
                  {essayExampleOpen ? t("auth.accountEssayHideExample") : t("auth.accountEssayGenerateExample")}
                </button>
              </div>

              {essayExampleOpen && (
                <div className="account-essay-example">
                  <span>{t("auth.accountEssayExampleLabel")}</span>
                  <p>{essayStrategy.exampleDraft}</p>
                </div>
              )}

              {essayDraftOpen && (
                <div className="account-essay-draft">
                  <label htmlFor="account-essay-draft">{t("auth.accountEssayDraftLabel")}</label>
                  <textarea
                    id="account-essay-draft"
                    rows={7}
                    value={essayDraft}
                    onChange={(e) => handleEssayDraftChange(e.target.value)}
                    placeholder={t("auth.accountEssayDraftPlaceholder")}
                  />
                  <p>{t("auth.accountEssayDraftHint")}</p>
                  <p className={`account-essay-draft__save account-essay-draft__save--${essayDraftSaveState}`}>
                    {essayWorkspaceLoading
                      ? t("auth.accountEssayWorkspaceLoading")
                      : essayDraftSaveState === "saving"
                      ? t("auth.accountEssayDraftSaving")
                      : essayDraftSaveState === "saved"
                      ? t("auth.accountEssayDraftSaved")
                      : essayDraftSaveState === "error"
                      ? t("auth.accountEssayDraftSaveErr")
                      : t("auth.accountEssayDraftNotSaved")}
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary account-essay-analyze"
                    disabled={essayDraft.trim().length < 6 || essayAnalysisBusy}
                    onClick={handleEssayAnalyzeClick}
                  >
                    {essayAnalysisBusy
                      ? t("auth.accountEssayAnalyzing")
                      : essayAnalysisUnlocked
                      ? t("auth.accountEssayAnalyze")
                      : t("auth.accountEssayAnalyzeLocked")}
                  </button>
                  {essayAnalysisErr && <p className="account-essay-draft__err">{essayAnalysisErr}</p>}
                  {essayPaywallOpen && (
                    <div className="account-essay-paywall">
                      <p className="account-essay-paywall__kicker">{t("auth.accountEssayPaywallKicker")}</p>
                      <h3>{t("auth.accountEssayPaywallTitle")}</h3>
                      <p>
                        {t("auth.accountEssayPaywallLead", {
                          position: essayStrategy.position,
                          weakness: essayStrategy.weakness,
                        })}
                      </p>
                      <ul>
                        <li>{t("auth.accountEssayPaywallBulletGeneric")}</li>
                        <li>{t("auth.accountEssayPaywallBulletScene")}</li>
                        <li>{t("auth.accountEssayPaywallBulletMajor")}</li>
                        <li>{t("auth.accountEssayPaywallBulletRevision")}</li>
                      </ul>
                      {essayCheckoutErr && <p className="account-essay-paywall__err">{essayCheckoutErr}</p>}
                      {essayAnalysisCheckoutEnabled && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => void handleEssayUnlockClick()}
                          disabled={essayCheckoutBusy}
                        >
                          {essayCheckoutBusy ? t("auth.accountEssayUnlockBusy") : t("auth.accountEssayUnlockCta")}
                        </button>
                      )}
                      {essayInviteCodesEnabled && (
                        <div className="account-essay-invite">
                          <label htmlFor="account-essay-invite">{t("auth.accountEssayInviteLabel")}</label>
                          <div className="account-essay-invite__row">
                            <input
                              id="account-essay-invite"
                              type="text"
                              value={essayInviteInput}
                              onChange={(e) => setEssayInviteInput(e.target.value)}
                              placeholder={t("report.inviteRedeemPlaceholder")}
                              autoComplete="off"
                              spellCheck={false}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={essayInviteBusy}
                              onClick={() => void handleEssayInviteRedeem()}
                            >
                              {essayInviteBusy ? t("report.inviteRedeemBusy") : t("report.inviteRedeemSubmit")}
                            </button>
                          </div>
                        </div>
                      )}
                      {!essayAnalysisCheckoutEnabled && !essayInviteCodesEnabled && (
                        <p className="account-essay-paywall__hint">{t("auth.accountEssayNoUnlockPath")}</p>
                      )}
                    </div>
                  )}
                  {essayAnalysis && (
                    <div className="account-essay-analysis">
                      <h3>{t("auth.accountEssayAnalysisTitle")}</h3>
                      <p className="account-essay-analysis__verdict">{essayAnalysis.verdict}</p>
                      <div className="account-essay-analysis__notes">
                        {(essayAnalysis.issues?.length
                          ? essayAnalysis.issues
                          : essayAnalysis.checks.map((check) => check.detail)
                        ).map((issue) => (
                          <p key={issue}>{issue}</p>
                        ))}
                      </div>
                      <p className="account-essay-analysis__next">
                        <strong>{t("auth.accountEssayAnalysisNext")}</strong>
                        {essayAnalysis.nextRevision}
                      </p>
                      {essayAnalysis.rewriteExample && (
                        <div className="account-essay-rewrite">
                          <strong>{t("auth.accountEssayRewriteTitle")}</strong>
                          <div>
                            <span>{t("auth.accountEssayRewriteBefore")}</span>
                            <p>{essayAnalysis.rewriteExample.before}</p>
                          </div>
                          <div>
                            <span>{t("auth.accountEssayRewriteAfter")}</span>
                            <p>{essayAnalysis.rewriteExample.after}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {essayAnalyses.length > 0 && (
                    <div className="account-essay-history">
                      <div className="account-essay-history__head">
                        <h3>{t("auth.accountEssayHistoryTitle")}</h3>
                        <span>{t("auth.accountEssayHistoryCount", { n: essayAnalyses.length })}</span>
                      </div>
                      <div className="account-essay-history__list">
                        {essayAnalyses.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            className="account-essay-history__item"
                            onClick={() => setEssayAnalysis({ ...row.analysis_payload, id: row.id, created_at: row.created_at })}
                          >
                            <span>{formatDate(row.created_at)}</span>
                            <strong>{row.analysis_payload.verdict}</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="account-home__muted">{t("auth.accountEssayEmpty")}</p>
          )}
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
  );
}
