import type { FormState, ReportPayload, SchoolRow, SchoolTier, UcAnalysis } from "../types";
import type { Locale } from "../i18n/strings";
import { getCampusDef, pickUcCampusPortfolio, type UcCampusKey } from "./ucCampusPortfolio";
import { structuredActivityBlob } from "./activityEvidence";
import { isWeakUcProfile } from "./ucProfileStrength";
import { sanitizeUcAnalysis, ucAnalysisNeedsFallback } from "./ucAnalysisSanitize";

const UC_KEYWORD_RE =
  /\buc\b|university of california|加州大学|ucla|berkeley|uc berkeley|ucsd|uc davis|uc irvine|uci|ucsb|uc santa barbara|uc santa cruz|ucsc|uc riverside|ucr|uc merced|ucm/i;

export function wantsUcAnalysis(form: FormState): boolean {
  if (form.geoPrefs.includes("west")) return true;
  const blob = [
    form.majorPrimary,
    form.majorSecondary,
    form.dealbreakers,
    structuredActivityBlob(form),
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

function campusDisplayName(key: UcCampusKey, locale: Locale): string {
  const def = getCampusDef(key);
  if (!def) return key;
  return locale === "en" ? def.en : def.zh;
}

function buildCampusWhy(
  key: UcCampusKey,
  tier: SchoolTier,
  form: FormState,
  locale: Locale,
  fitScore: number,
): { why: string; risks: string[]; verify: string[]; signals: string[] } {
  const isEn = locale === "en";
  const major = form.majorPrimary.trim() || (isEn ? "your intended direction" : "你的主申方向");
  const name = campusDisplayName(key, locale);
  const fitNote =
    fitScore >= 0.55
      ? isEn
        ? "strong major-direction overlap"
        : "与主申方向重合度较高"
      : fitScore >= 0.35
        ? isEn
          ? "partial fit—needs clearer evidence"
          : "部分匹配—需用课程/活动补足证据"
        : isEn
          ? "weaker direct fit—treat as portfolio coverage or exploratory"
          : "直接匹配度一般—更像组合覆盖或探索型选项";

  const weak = isWeakUcProfile(form);
  const flagshipReach =
    (key === "berkeley" || key === "ucla") && tier === "reach" && weak;

  const tierWhy =
    flagshipReach
      ? isEn
        ? `For ${major}, ${name} is at most a very low-probability reference—not a responsible Reach tier given your current GPA/activities.`
        : `就${major}与当前 GPA/活动而言，${name} 最多作极低概率参考，不宜作为负责任的 UC 冲刺档。`
      : tier === "reach"
      ? isEn
        ? `As a reach campus for ${major}, ${name} is highly selective; ${fitNote}.`
        : `作为${major}方向的冲刺校，${name} 选择性很高；${fitNote}。`
      : tier === "match"
        ? isEn
          ? `As a match campus for ${major}, ${name} is a more realistic main target; ${fitNote}.`
          : `作为${major}方向的稳妥主战场之一，${name} 相对更现实；${fitNote}。`
        : isEn
          ? `As a safety floor for your UC portfolio, ${name} helps reduce all-UC-reject risk; ${fitNote}.`
          : `作为 UC 组合的保底档，${name} 有助于降低全军覆没风险；${fitNote}。`;

  const risksByKey: Partial<Record<UcCampusKey, string[]>> = isEn
    ? {
        berkeley: ["Capacity-constrained majors may be screened", "International/OOS competition is intense"],
        ucla: ["Very high selectivity; narrative must be specific", "Popular majors may add screening"],
        ucsd: ["College-within-campus choice matters for STEM", "Still selective despite being Match tier"],
        ucsb: ["Strong in sciences—less ideal if you need urban internship density"],
        uci: ["CS/business paths can be competitive", "Verify major school within UCI"],
        ucdavis: ["Campus town environment—check dealbreakers", "Some majors are more capacity-limited"],
        ucsc: ["Smaller brand than top UCs—still needs strong PIQs", "Check major availability"],
        ucr: ["Not a free admit—still needs coherent PIQs", "Aid/net cost varies by profile"],
        ucmerced: ["Newer campus—verify major depth vs your goals", "Geography may not fit everyone"],
      }
    : {
        berkeley: ["热门专业可能名额紧张/筛选", "国际生/州外竞争密度高"],
        ucla: ["选择性很高；叙事必须具体", "热门方向可能有额外筛选"],
        ucsd: ["STEM 需选对学院", "作为稳档仍有不小选择性"],
        ucsb: ["理工强—若依赖大城市实习需核对", "部分专业竞争不低"],
        uci: ["CS/商科等路径竞争不低", "需核对专业所属学院"],
        ucdavis: ["校园环境偏小镇—核对底线", "部分专业名额仍有限"],
        ucsc: ["品牌弱于头部 UC—PIQ 仍要扎实", "核对专业开放情况"],
        ucr: ["并非随便进—仍需完整 PIQ", "费用/奖助因家庭而异"],
        ucmerced: ["建校较新—核对专业深度", "地理位置不一定适合所有人"],
      };

  const verifyCommon = isEn
    ? ["Confirm major/college policy on the official site", "Do not treat SAT/ACT as a UC admit lever"]
    : ["核对官网当年专业/学院政策", "勿将 SAT/ACT 当作 UC 录取策略"];

  const verifyExtra: Partial<Record<UcCampusKey, string[]>> = isEn
    ? {
        berkeley: ["Map A-G or equivalent rigor to your major"],
        ucla: ["Align PIQs with one activity spine"],
        ucsd: ["Map UCSD college to your major"],
        uci: ["Check if major is in a screened school"],
      }
    : {
        berkeley: ["核对 A-G/课程 rigor 与专业是否一致"],
        ucla: ["PIQ 与活动主线对齐"],
        ucsd: ["核对 UCSD 学院与专业对应关系"],
        uci: ["核对是否属于需筛选的学院/专业"],
      };

  return {
    why: tierWhy,
    risks: risksByKey[key] ?? (isEn ? ["Selectivity still meaningful at this tier"] : ["该档位仍有选择性"]),
    verify: [...verifyCommon, ...(verifyExtra[key] ?? [])],
    signals: isEn
      ? [`Major: ${major}`, `Fit signal: ${fitNote}`]
      : [`主申：${major}`, `匹配度：${fitNote}`],
  };
}

/** 本地兜底：LLM 未返回 uc_analysis 时，按问卷规则选校区（非固定 Berkeley+UCLA） */
export function buildUcAnalysisFallback(form: FormState, locale: Locale): UcAnalysis {
  const isEn = locale === "en";
  const major = form.majorPrimary.trim() || (isEn ? "your intended direction" : "你的主申方向");
  const gpaThin = form.gpa.trim().length < 40;
  const picks = pickUcCampusPortfolio(form);

  const reachNames = picks.filter((p) => p.tier === "reach").map((p) => campusDisplayName(p.campus.key, locale));
  let overview = isEn
    ? `You showed interest in the UC system. Campus tiers below are chosen from your major (${major}), list posture, and activity/GPA snapshot—not a default "Berkeley + UCLA reach for everyone" template. UC admission is holistic and test-blind.`
    : `你已表现出 UC 申请意向。下方校区分档依据你的主申专业（${major}）、选校风格与成绩/活动快照生成，不是默认人人冲刺 Berkeley + UCLA；录取为 holistic review 且 test-blind。`;

  if (reachNames.length > 0 && !reachNames.some((n) => /berkeley|ucla|伯克利/i.test(n))) {
    overview += isEn
      ? ` Reach tier emphasizes ${reachNames.join(" and ")} based on fit—not automatically the two highest brand names.`
      : ` 冲刺档为 ${reachNames.join("、")} 等与你方向更贴近的校区，而非机械套用品牌最高的两所。`;
  }

  const testBlindNote = isEn
    ? "University of California undergraduate admission is test-blind: SAT/ACT scores are not considered in admission decisions. Scores you entered may still matter for non-UC schools or your own planning only."
    : "加州大学（UC）本科录取为 test-blind：招生在录取决定中不会查看 SAT/ACT。你在问卷里填写的标化仅可用于非 UC 学校或你自己的备考规划，不应作为提高 UC 录取概率的依据。";

  const applicationNote = isEn
    ? "All UC campuses share one UC Application and four PIQs (Personal Insight Questions). Tier labels below are campus-selection strategy, not separate applications."
    : "所有 UC 校区共用一套 UC Application 与 4 篇 PIQ（Personal Insight Questions）。下面的冲/稳/保是选哪些校区，不是 6 份独立申请。";

  const reach: SchoolRow[] = [];
  const match: SchoolRow[] = [];
  const safety: SchoolRow[] = [];

  for (const pick of picks) {
    const copy = buildCampusWhy(pick.campus.key, pick.tier, form, locale, pick.fitScore);
    const row = campusRow(
      campusDisplayName(pick.campus.key, locale),
      pick.tier,
      copy.why,
      copy.risks,
      copy.verify,
      copy.signals,
    );
    if (pick.tier === "reach") reach.push(row);
    else if (pick.tier === "match") match.push(row);
    else safety.push(row);
  }

  const checklist = isEn
    ? [
        "UC admission is test-blind—do not treat SAT/ACT as a UC admit lever",
        "Verify A-G (or equivalent) course coverage on your transcript",
        "Plan four distinct PIQs (not four versions of the same story)",
        "No recommendation letters for standard UC undergraduate application",
        "Check each campus major/college policy on the official site",
        reach.length
          ? `Your reach campuses (${reach.map((r) => r.school).join(", ")}) need major-specific evidence—not generic prestige chasing`
          : "Pick reach campuses where your major evidence is strongest",
      ]
    : [
        "UC 录取不看 SAT/ACT，勿把提分当作冲 UC 的策略",
        "核对成绩单是否满足 A-G（或等效课程体系）",
        "规划 4 篇互不重复的 PIQ，不要写成四遍同一活动",
        "标准 UC 本科申请一般不需要推荐信",
        "逐校核对专业/学院政策（以官网当年为准）",
        reach.length
          ? `冲刺校（${reach.map((r) => r.school).join("、")}）需有专业证据支撑，而非只看名气`
          : "冲刺校应选与你专业证据最匹配者",
      ];

  const piqDirections = isEn
    ? [
        `PIQ 1: One concrete scene showing why ${major} became specific to you`,
        "PIQ 2: A leadership or initiative moment with measurable impact",
        "PIQ 3: A challenge/setback and what you changed",
        "PIQ 4: Community contribution or identity thread (avoid repeating PIQ 1)",
      ]
    : [
        `PIQ 1：用一个具体场景说明${major}为何对你变得具体`,
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
  if (report.uc_analysis && hasUcCampuses(report.uc_analysis)) {
    const sanitized = sanitizeUcAnalysis(report.uc_analysis, form, locale);
    if (ucAnalysisNeedsFallback(sanitized, form)) return buildUcAnalysisFallback(form, locale);
    return sanitized;
  }
  return buildUcAnalysisFallback(form, locale);
}

function hasUcCampuses(uc: UcAnalysis): boolean {
  return (uc.reach?.length ?? 0) + (uc.match?.length ?? 0) + (uc.safety?.length ?? 0) > 0;
}
