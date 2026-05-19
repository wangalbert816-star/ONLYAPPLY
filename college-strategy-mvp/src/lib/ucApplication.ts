import type { FormState, ReportPayload, SchoolRow, SchoolTier, UcAnalysis } from "../types";
import type { Locale } from "../i18n/strings";

const UC_KEYWORD_RE =
  /\buc\b|university of california|加州大学|ucla|berkeley|uc berkeley|ucsd|uc davis|uc irvine|uci|ucsb|uc santa barbara|uc santa cruz|ucsc|uc riverside|ucr|uc merced|ucm/i;

export function wantsUcAnalysis(form: FormState): boolean {
  if (form.geoPrefs.includes("west")) return true;
  const blob = [
    form.majorPrimary,
    form.majorSecondary,
    form.dealbreakers,
    form.activities,
    form.residenceRegion,
    form.citizenship,
  ]
    .join(" ")
    .toLowerCase();
  return UC_KEYWORD_RE.test(blob);
}

function whyFieldForTier(tier: SchoolTier): keyof SchoolRow {
  if (tier === "reach") return "why_reach_for_you";
  if (tier === "match") return "why_match_for_you";
  return "why_safety_for_you";
}

function campusRow(
  school: string,
  tier: SchoolTier,
  why: string,
  risks: string[],
  verify: string[],
  signals: string[],
): SchoolRow {
  return {
    school,
    [whyFieldForTier(tier)]: why,
    key_fit_signals: signals,
    key_risks: risks,
    verification_focus: verify,
  };
}

/** 本地兜底：LLM 未返回 uc_analysis 时，仍可按用户背景展示 UC 专区结构 */
export function buildUcAnalysisFallback(form: FormState, locale: Locale): UcAnalysis {
  const isEn = locale === "en";
  const major = form.majorPrimary.trim() || (isEn ? "your intended direction" : "你的主申方向");
  const risk = form.riskStyle || "balanced";
  const gpaThin = form.gpa.trim().length < 40;

  const overview = isEn
    ? `You indicated interest in the UC system. Below is a campus portfolio based on your questionnaire—not a fixed "top 2 + middle 4 + bottom 3" template. UC admission is holistic and test-blind: SAT/ACT are not used in admission decisions.`
    : `你已表现出对加州大学（UC）系统的申请意向。以下是结合你问卷信息整理的「校区组合」建议，不是固定的「前二 + 中间四 + 后三」模板；各校录取为 holistic review，且录取决定不看 SAT/ACT。`;

  const testBlindNote = isEn
    ? "University of California undergraduate admission is test-blind: SAT/ACT scores are not considered in admission decisions. Scores you entered may still matter for non-UC schools or your own planning only."
    : "加州大学（UC）本科录取为 test-blind：招生在录取决定中不会查看 SAT/ACT。你在问卷里填写的标化仅可用于非 UC 学校或你自己的备考规划，不应作为提高 UC 录取概率的依据。";

  const applicationNote = isEn
    ? "All UC campuses share one UC Application and four PIQs (Personal Insight Questions). Tier labels below are campus-selection strategy, not separate applications."
    : "所有 UC 校区共用一套 UC Application 与 4 篇 PIQ（Personal Insight Questions）。下面的冲/稳/保是「选哪些校区」，不是 6 份独立申请。";

  const reachWhy = isEn
    ? `As a reach campus for ${major}, competition is very high; fit must be argued with coursework and activities, not test scores.`
    : `作为「${major}」方向的冲刺校区，竞争极强；需要用课程与活动证据支撑匹配，而不是标化分数。`;

  const matchWhy = isEn
    ? `More realistic main battlefield for ${major} given your current profile snapshot.`
    : `结合你目前画像，作为「${major}」方向更现实的主战场之一。`;

  const safetyWhy = isEn
    ? `Helps reduce all-UC-reject risk while still aligning with ${major} or exploratory paths.`
    : `有助于降低「UC 全军覆没」风险，同时仍与「${major}」或探索型路径有一定关联。`;

  const reach: SchoolRow[] = [
    campusRow(
      isEn ? "UC Berkeley" : "UC Berkeley（伯克利）",
      "reach",
      reachWhy,
      isEn
        ? ["Extremely selective; many majors are capacity-constrained", "International/OOS competition density is high"]
        : ["整体选择性极高；不少热门专业名额紧张", "国际生/州外竞争密度高"],
      isEn
        ? ["Confirm major/college policy on the official site", "Map A-G or equivalent rigor", "Do not plan on SAT for UC admission"]
        : ["核对官网当年专业/学院政策", "核对 A-G 或等效课程 rigor", "勿将 SAT 当作 UC 录取策略"],
      isEn ? [`Major direction: ${major}`] : [`主申方向：${major}`],
    ),
    campusRow(
      isEn ? "UCLA" : "UCLA",
      "reach",
      reachWhy,
      isEn
        ? ["Very high selectivity; narrative must be specific", "Popular majors may be screened"]
        : ["选择性很高；叙事必须具体", "热门专业可能有筛选"],
      isEn
        ? ["Check PIQ themes vs your activity spine", "Verify major selection rules"]
        : ["核对 PIQ 与活动主线是否一致", "核对专业选择规则"],
      isEn ? [`List risk posture: ${risk}`] : [`名单风格：${risk}`],
    ),
  ];

  const match: SchoolRow[] = [
    campusRow(
      isEn ? "UC San Diego" : "UC San Diego（UCSD）",
      "match",
      matchWhy,
      isEn ? ["Strong STEM/humanities mix—pick colleges carefully"] : ["理工与人文资源都强—需选对学院"],
      isEn ? ["Confirm college within UCSD for your major"] : ["核对 UCSD 内与专业对应的学院"],
      isEn ? ["Activities should support one clear thread"] : ["活动宜有一条清晰主线"],
    ),
    campusRow(
      isEn ? "UC Davis" : "UC Davis（戴维斯）",
      "match",
      matchWhy,
      isEn ? ["Good fit for many applied/life-science directions"] : ["对不少应用/生命科学方向较友好"],
      isEn ? ["Check campus environment vs your dealbreakers"] : ["核对校园环境是否符合你的底线"],
      gpaThin
        ? isEn
          ? ["GPA narrative needs more detail in PIQs"]
          : ["GPA 说明偏薄时，PIQ 需补足学术证据"]
        : isEn
          ? ["Leverage rigor in transcript notes"]
          : ["在成绩说明中体现课程强度"],
    ),
  ];

  const safety: SchoolRow[] = [
    campusRow(
      isEn ? "UC Riverside" : "UC Riverside（河滨）",
      "safety",
      safetyWhy,
      isEn ? ["Still selective, but more achievable as a floor"] : ["仍有选择性，但更适合作为保底档"],
      isEn ? ["Confirm major availability"] : ["核对专业是否开放"],
      isEn ? ["Keep one PIQ on long-term commitment"] : ["建议 1 篇 PIQ 写长期投入"],
    ),
    campusRow(
      isEn ? "UC Merced" : "UC Merced（默塞德）",
      "safety",
      safetyWhy,
      isEn ? ["Often used to broaden UC portfolio coverage"] : ["常用于扩大 UC 组合覆盖面"],
      isEn ? ["Verify housing/campus fit"] : ["核对住宿与校园适配"],
      isEn ? ["Same 4 PIQs for all campuses"] : ["与其他校区共用 4 篇 PIQ"],
    ),
  ];

  const checklist = isEn
    ? [
        "UC admission is test-blind—do not treat SAT/ACT as a UC admit lever",
        "Verify A-G (or equivalent) course coverage on your transcript",
        "Plan four distinct PIQs (not four versions of the same story)",
        "No recommendation letters for standard UC undergraduate application",
        "Check each campus major/college policy on the official site",
      ]
    : [
        "UC 录取不看 SAT/ACT，勿把提分当作冲 UC 的策略",
        "核对成绩单是否满足 A-G（或等效课程体系）",
        "规划 4 篇互不重复的 PIQ，不要写成四遍同一活动",
        "标准 UC 本科申请一般不需要推荐信",
        "逐校核对专业/学院政策（以官网当年为准）",
      ];

  const piqDirections = isEn
    ? [
        `PIQ 1: One concrete scene showing why ${major} became specific to you`,
        "PIQ 2: A leadership or initiative moment with measurable impact",
        "PIQ 3: A challenge/setback and what you changed",
        "PIQ 4: Community contribution or identity thread (avoid repeating PIQ 1)",
      ]
    : [
        `PIQ 1：用一个具体场景说明「${major}」为何对你变得具体`,
        "PIQ 2：一次带头或发起行动的经历，尽量有可核对的结果",
        "PIQ 3：一次挫折/转折，以及你之后改变了什么",
        "PIQ 4：社区/身份视角（避免与 PIQ 1 重复同一活动）",
      ];

  const informationGaps = isEn
    ? gpaThin
      ? ["Add GPA scale, trend, and core course rigor for UC academic review", "List which UC campuses you are seriously considering"]
      : ["List which UC campuses you are seriously considering", "Note if any target major is screened (e.g. engineering, CS)"]
    : gpaThin
      ? ["补全 GPA 口径、趋势与核心课强度，便于 UC 学术审核", "写明你认真考虑的 UC 校区清单"]
      : ["写明你认真考虑的 UC 校区清单", "说明是否有需按专业筛选的方向（如工程、CS）"];

  return {
    overview,
    test_blind_note: testBlindNote,
    application_note: applicationNote,
    reach,
    match,
    safety,
    checklist,
    piq_directions: piqDirections,
    information_gaps: informationGaps,
  };
}

export function resolveUcAnalysis(report: ReportPayload, form: FormState, locale: Locale): UcAnalysis | null {
  if (!wantsUcAnalysis(form)) return null;
  if (report.uc_analysis && hasUcCampuses(report.uc_analysis)) return report.uc_analysis;
  return buildUcAnalysisFallback(form, locale);
}

function hasUcCampuses(uc: UcAnalysis): boolean {
  return (uc.reach?.length ?? 0) + (uc.match?.length ?? 0) + (uc.safety?.length ?? 0) > 0;
}
