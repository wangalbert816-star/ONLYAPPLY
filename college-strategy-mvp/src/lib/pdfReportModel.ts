import type { FormState, ReportPayload, SchoolRow, SchoolTier, UcAnalysis } from "../types";
import type { Locale } from "../i18n/strings";
import { campusCultureAlignmentNote, campusCulturePrefLabel } from "./campusCulturePref";
import { buildBiggestGapBlock, buildOverallVerdict, pickWeakestDimension } from "./decisionReport";
import { enrichSchoolRow } from "./enrichSchoolRow";
import { buildFiveDimensionProfile, type ProfileDimension, type ProfileDimensionKey } from "./fiveDimensionProfile";
import { getEffectiveIntake } from "./intakeTerm";
import { getImprovementPlanLabels, getIntakeHorizon } from "./intakeHorizon";
import { sanitizeReportProse } from "./reportProseSanitize";
import { resolveMainListRows, resolveTopReferenceSchools } from "./topReferenceSchools";
import { resolveUcAnalysis } from "./ucApplication";
import { getOfficialLinksForSchool, officialLinkLabel } from "./universityOfficialLinks";

export type PdfKeyValue = { label: string; value: string };

export type PdfTopAction = { title: string; detail: string | null };

export type PdfVerdict = {
  headline: string;
  subline: string | null;
  advantage: string;
  weakness: string;
  strategy: string;
};

export type PdfBiggestGap = {
  key: ProfileDimensionKey;
  label: string;
  score: number;
  judgment: string;
  stakeLine: string;
  reason: string;
  suggest: string;
};

export type PdfDimensionCard = {
  key: ProfileDimensionKey;
  label: string;
  score: number;
  isWeakest: boolean;
  judgment: string;
  reason: string;
  suggest: string;
};

export type PdfSchoolRow = {
  school: string;
  why: string;
  campusVibe: string;
  differentiation: string;
  contextNote: string;
  cultureFit: string;
  signals: string[];
  risks: string[];
  verify: string[];
  officialLinks: string[];
};

export type PdfUcSection = {
  overview: string;
  testBlindNote: string;
  applicationNote: string;
  tiers: PdfSchoolTier[];
  checklist: string[];
  piqDirections: string[];
  informationGaps: string[];
};

export type PdfSchoolTier = {
  tier: SchoolTier;
  title: string;
  rows: PdfSchoolRow[];
};

export type PdfPortfolioRisk = {
  title: string;
  meaning: string;
  mitigation: string;
};

export type PdfActionSection = {
  title: string;
  items: string[];
};

export type PdfReportModel = {
  locale: Locale;
  intakeLabel: string;
  generatedAt: string;
  recipientName: string | null;
  isPreview: boolean;
  coverTitle: string;
  coverSubtitle: string;
  profile: PdfKeyValue[];
  verdict: PdfVerdict;
  topActions: PdfTopAction[];
  biggestGap: PdfBiggestGap;
  radarDimensions: ProfileDimension[];
  dimensions: PdfDimensionCard[];
  schoolTiers: PdfSchoolTier[];
  topReferenceSchools: PdfSchoolRow[];
  ucSection: PdfUcSection | null;
  executiveSummary: string[];
  informationGaps: string[];
  portfolioRisks: PdfPortfolioRisk[];
  actions: PdfActionSection[];
  activityBuild: string[];
  priorityFrame: string;
  strategyNotes: string[];
  footerNote: string;
};

function clamp(s: string, max: number): string {
  const v = (s || "").replace(/\s+/g, " ").trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

export function deAiText(s: string): string {
  return s
    .replace(/^(模型|AI|系统)?(分析|推测|可能)[：:，,]?\s*/gi, "")
    .replace(/^可能/, "")
    .replace(/据(模型|问卷)?(显示|判断)[，,]?/g, "")
    .replace(/总体而言[，,]?/g, "")
    .replace(/综上所述[，,]?/g, "")
    .replace(/值得注意的是[，,]?/g, "")
    .replace(/不难发现[，,]?/g, "")
    .replace(/在一定程度上/g, "")
    .replace(/从.{0,8}来看[，,]?/g, "")
    .trim();
}

function clean(s: string, max: number): string {
  return clamp(deAiText(s), max);
}

function axisLabel(key: ProfileDimensionKey, locale: Locale): string {
  const zh: Record<ProfileDimensionKey, string> = {
    academic: "学术（GPA）",
    testing: "标化",
    activities: "活动",
    essays: "文书",
    strategy: "策略",
  };
  const en: Record<ProfileDimensionKey, string> = {
    academic: "Academics",
    testing: "Testing",
    activities: "Activities",
    essays: "Essays",
    strategy: "Strategy",
  };
  return locale === "en" ? en[key] : zh[key];
}

function buildTopActions(form: FormState, dimensions: ProfileDimension[], locale: Locale): PdfTopAction[] {
  const weakest = pickWeakestDimension(dimensions);
  const avg = dimensions.reduce((s, d) => s + d.score, 0) / (dimensions.length || 1);

  if (locale === "en") {
    const fix: Record<ProfileDimensionKey, PdfTopAction> = {
      activities: { title: "Deepen activities first", detail: "One thread: span, role, verifiable outcome." },
      essays: { title: "Build essay material first", detail: "Activities + direction before drafting." },
      academic: { title: "Lock academic facts", detail: "GPA scale, rigor, trend—then align schools." },
      testing: { title: "Lock testing plan", detail: "Submit vs optional + test months on paper." },
      strategy: { title: "Lock list rules", detail: "Budget, aid gates, decision owner." },
    };
    const tier =
      avg < 52
        ? { title: "Set anchor band (Top ~50)", detail: "Align family once on the target band." }
        : avg < 62
          ? { title: "Set band (Top ~30–50)", detail: "Write the band down to stop list drift." }
          : { title: "Hold Top ~30 with a real Safety floor", detail: "Every Safety must survive a bad day." };
    const risk =
      form.riskStyle === "aggressive"
        ? { title: "Control Reach risk", detail: "Don't let Reach outrun your file." }
        : { title: "Keep Safety defensible", detail: "Each Safety should be checkable." };
    return [fix[weakest.key] ?? { title: "Fix the shortest board", detail: null }, tier, risk];
  }

  const fixMap: Record<ProfileDimensionKey, PdfTopAction> = {
    activities: { title: "优先补活动", detail: "写清 3 条：跨度、角色、可验证结果。" },
    essays: { title: "先补文书素材", detail: "活动与主申方向写具体后再动笔。" },
    academic: { title: "先补学术口径", detail: "GPA 算法、核心课、趋势写清楚。" },
    testing: { title: "定标化策略", detail: "交不交分、考试月份、目标区间写死。" },
    strategy: { title: "定选校规则", detail: "预算、奖助底线、谁拍板写清楚。" },
  };
  const tierAction: PdfTopAction =
    avg < 52
      ? { title: "明确目标区间（Top 50 为主）", detail: "主战场写纸上，再讨论冲校。" }
      : avg < 62
        ? { title: "明确目标区间（Top 30–50）", detail: "家庭对齐一次档位。" }
        : { title: "稳住 Top 30 档位", detail: "保底校要能真兜住。" };
  const riskAction: PdfTopAction =
    form.riskStyle === "aggressive"
      ? { title: "控制冲校风险", detail: "别让冲刺名单跑在材料前面。" }
      : { title: "守住保底可信度", detail: "每一所保底经得起核对。" };
  return [fixMap[weakest.key] ?? { title: "先补最短板块", detail: null }, tierAction, riskAction];
}

function buildDimensionCards(dimensions: ProfileDimension[], locale: Locale): PdfDimensionCard[] {
  const weakest = pickWeakestDimension(dimensions);
  return dimensions.map((dim) => ({
    key: dim.key,
    label: axisLabel(dim.key, locale),
    score: dim.score,
    isWeakest: dim.key === weakest.key,
    judgment: clean(dim.judgment, 96),
    reason: clean(dim.explain, 140),
    suggest: clean(dim.suggest, 140),
  }));
}

function whyForRow(row: SchoolRow, tier: SchoolTier): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function mapLines(items: string[] | undefined, maxEach: number, maxItems: number) {
  return (items ?? []).slice(0, maxItems).map((x) => clean(x, maxEach)).filter(Boolean);
}

function rowToPdf(row: SchoolRow, tier: SchoolTier, form: FormState, locale: Locale, unlocked: boolean): PdfSchoolRow {
  const enriched = enrichSchoolRow(row, form, locale, tier);
  const links = unlocked
    ? getOfficialLinksForSchool(enriched.school, locale).map((l) => `${officialLinkLabel(l, locale)}: ${l.href}`)
    : [];
  const cultureFit = unlocked ? campusCultureAlignmentNote(form, enriched, locale) || "" : "";
  return {
    school: enriched.school,
    why: clean(whyForRow(enriched, tier), 110),
    campusVibe: clean(enriched.campus_vibe || "", 96),
    differentiation: unlocked ? clean(enriched.differentiation || "", 96) : "",
    contextNote: unlocked ? clean(enriched.context_note || "", 96) : "",
    cultureFit: cultureFit ? clean(cultureFit, 88) : "",
    signals: mapLines(enriched.key_fit_signals, 88, 3),
    risks: mapLines(enriched.key_risks, 88, 3),
    verify: mapLines(enriched.verification_focus, 88, 3),
    officialLinks: links.slice(0, 4),
  };
}

function buildSchoolTiers(report: ReportPayload, form: FormState, locale: Locale, unlocked: boolean): PdfSchoolTier[] {
  const main = resolveMainListRows(report);
  const tierMeta: { tier: SchoolTier; title: string }[] =
    locale === "en"
      ? [
          { tier: "reach", title: "Reach (realistic stretch)" },
          { tier: "match", title: "Match" },
          { tier: "safety", title: "Safety" },
        ]
      : [
          { tier: "reach", title: "冲刺（现实可冲）" },
          { tier: "match", title: "匹配" },
          { tier: "safety", title: "保底" },
        ];

  return tierMeta
    .map(({ tier, title }) => {
      const rows = main[tier] ?? [];
      const visible = unlocked ? rows : rows.slice(0, 1);
      return {
        tier,
        title,
        rows: visible.map((row) => rowToPdf(row, tier, form, locale, unlocked)),
      };
    })
    .filter((t) => t.rows.length > 0);
}

function buildTopReferenceSchools(
  report: ReportPayload,
  form: FormState,
  locale: Locale,
  unlocked: boolean,
): PdfSchoolRow[] {
  return resolveTopReferenceSchools(report).map((row) =>
    rowToPdf(
      {
        school: row.school,
        why_reach_for_you: row.why_reference_for_you || "",
        campus_vibe: row.campus_vibe,
        context_note: row.context_note,
        key_fit_signals: row.key_fit_signals ?? [],
        key_risks: row.key_risks ?? [],
        verification_focus: row.verification_focus ?? [],
      },
      "reach",
      form,
      locale,
      unlocked,
    ),
  );
}

function buildUcPdfSection(
  uc: UcAnalysis | null,
  form: FormState,
  locale: Locale,
  unlocked: boolean,
): PdfUcSection | null {
  if (!uc) return null;
  const tierMeta: { tier: SchoolTier; title: string }[] =
    locale === "en"
      ? [
          { tier: "reach", title: "UC Reach" },
          { tier: "match", title: "UC Match" },
          { tier: "safety", title: "UC Safety" },
        ]
      : [
          { tier: "reach", title: "UC 冲刺" },
          { tier: "match", title: "UC 匹配" },
          { tier: "safety", title: "UC 保底" },
        ];
  const tiers = tierMeta
    .map(({ tier, title }) => {
      const rows = uc[tier] ?? [];
      const visible = unlocked ? rows : rows.slice(0, 1);
      return {
        tier,
        title,
        rows: visible.map((row) => rowToPdf(row, tier, form, locale, unlocked)),
      };
    })
    .filter((t) => t.rows.length > 0);

  return {
    overview: clean(uc.overview, 200),
    testBlindNote: clean(uc.test_blind_note, 160),
    applicationNote: clean(uc.application_note, 160),
    tiers,
    checklist: unlocked ? (uc.checklist ?? []).map((x) => clean(x, 96)).slice(0, 6) : [],
    piqDirections: unlocked ? (uc.piq_directions ?? []).map((x) => clean(x, 96)).slice(0, 4) : [],
    informationGaps: unlocked ? (uc.information_gaps ?? []).map((x) => clean(x, 96)).slice(0, 4) : [],
  };
}

function buildProfileRows(form: FormState, locale: Locale): PdfKeyValue[] {
  const zh = locale === "zh";
  const rows: PdfKeyValue[] = [{ label: zh ? "入学季" : "Intake", value: getEffectiveIntake(form) || "—" }];
  if (form.gpa.trim()) rows.push({ label: "GPA", value: clamp(form.gpa, 56) });
  if (form.majorPrimary.trim()) {
    rows.push({
      label: zh ? "专业" : "Major",
      value: clamp([form.majorPrimary, form.majorSecondary].filter(Boolean).join(" / "), 48),
    });
  }
  if (form.riskStyle) {
    const m: Record<string, [string, string]> = {
      conservative: ["稳健", "Conservative"],
      balanced: ["均衡", "Balanced"],
      aggressive: ["激进", "Aggressive"],
    };
    const [z, e] = m[form.riskStyle] ?? ["—", "—"];
    rows.push({ label: zh ? "选校风格" : "Posture", value: zh ? z : e });
  }
  if (form.campusCulturePref) {
    rows.push({
      label: zh ? "社区气质偏好" : "Campus culture",
      value: campusCulturePrefLabel(form.campusCulturePref, locale),
    });
  }
  return rows;
}

function normalizePlanItems(items: string[], max: number): string[] {
  return items.map((x) => clean(x, 96)).filter(Boolean).slice(0, max);
}

export function buildPdfReportModel(
  form: FormState,
  report: ReportPayload,
  locale: Locale,
  unlocked: boolean,
  recipientName?: string | null,
): PdfReportModel {
  const safeReport = sanitizeReportProse(report, locale);
  const dimensions = buildFiveDimensionProfile(form, locale);
  const gap = buildBiggestGapBlock(dimensions, locale);
  const rawVerdict = buildOverallVerdict(form, dimensions, locale);
  const intakeLabel = getEffectiveIntake(form) || (locale === "en" ? "Application cycle" : "入学季");
  const ucAnalysis = resolveUcAnalysis(safeReport, form, locale);

  const generatedAt = new Date().toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const plan = safeReport.improvement_plan;
  const planLabels = getImprovementPlanLabels(getIntakeHorizon(intakeLabel), locale);
  const actions: PdfActionSection[] = [
    {
      title: planLabels.week,
      items: normalizePlanItems(plan?.this_week ?? [], unlocked ? 6 : 2),
    },
    {
      title: planLabels.month,
      items: unlocked ? normalizePlanItems(plan?.this_month ?? [], 6) : [],
    },
    {
      title: planLabels.before,
      items: unlocked ? normalizePlanItems(plan?.before_submitting ?? [], 6) : [],
    },
  ].filter((s) => s.items.length > 0);
  const activityBuild = unlocked ? normalizePlanItems(plan?.activity_build ?? [], 6) : [];
  const priorityFrame = unlocked && plan?.priority_frame ? clean(plan.priority_frame, 140) : "";

  const gapDim = gap.dimension;

  return {
    locale,
    intakeLabel,
    generatedAt,
    recipientName: recipientName?.trim() || null,
    isPreview: !unlocked,
    coverTitle: locale === "en" ? "Your Application Strategy Report" : "你的申请策略报告",
    coverSubtitle: locale === "en" ? `${intakeLabel} · Personalized analysis` : `${intakeLabel} · 个性化分析`,
    profile: buildProfileRows(form, locale),
    verdict: {
      headline: clean(rawVerdict.headline, 120),
      subline: rawVerdict.subline ? clean(rawVerdict.subline, 100) : null,
      advantage: clean(rawVerdict.advantage, 140),
      weakness: clean(rawVerdict.weakness, 140),
      strategy: clean(rawVerdict.strategy, 140),
    },
    topActions: buildTopActions(form, dimensions, locale),
    biggestGap: {
      key: gapDim.key,
      label: axisLabel(gapDim.key, locale),
      score: gapDim.score,
      judgment: clean(gapDim.judgment, 96),
      stakeLine: clean(gap.stakeLine, 100),
      reason: clean(gapDim.explain, 140),
      suggest: clean(gapDim.suggest, 140),
    },
    radarDimensions: dimensions,
    dimensions: buildDimensionCards(dimensions, locale),
    schoolTiers: buildSchoolTiers(safeReport, form, locale, unlocked),
    topReferenceSchools: buildTopReferenceSchools(safeReport, form, locale, unlocked),
    ucSection: buildUcPdfSection(ucAnalysis, form, locale, unlocked),
    executiveSummary: (safeReport.executive_summary ?? []).map((x) => clean(x, 120)).slice(0, unlocked ? 6 : 2),
    informationGaps: (safeReport.information_gaps ?? []).map((x) => clean(x, 100)).slice(0, unlocked ? 8 : 3),
    portfolioRisks: (safeReport.portfolio_risks ?? [])
      .slice(0, unlocked ? 5 : 2)
      .map((r) => ({
        title: clean(r.risk_title, 48),
        meaning: clean(r.what_it_means_for_you, 100),
        mitigation: clean(r.mitigation, 100),
      })),
    actions,
    activityBuild,
    priorityFrame,
    strategyNotes: (safeReport.strategy_notes ?? []).map((x) => clean(x, 100)).slice(0, unlocked ? 5 : 2),
    footerNote:
      locale === "en"
        ? "For planning only. Verify deadlines, costs, and policies on each school's official site."
        : "仅供规划参考；轮次、费用与政策请以各校官网为准。",
  };
}
