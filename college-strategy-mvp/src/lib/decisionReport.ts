import type { FormState } from "../types";
import type { Locale } from "../i18n/strings";
import type { ProfileDimension, ProfileDimensionKey } from "./fiveDimensionProfile";

/** 并列最低分时，优先把「对档位感知更强」的维当作主短板 */
const WEAK_TIE_ORDER: ProfileDimensionKey[] = ["activities", "essays", "academic", "testing", "strategy"];

export type OverallVerdict = {
  headline: string;
  subline: string | null;
  advantage: string;
  weakness: string;
  strategy: string;
};

export type BiggestGapBlock = {
  dimension: ProfileDimension;
  /** 一句点破后果 */
  stakeLine: string;
};

function avgScore(dimensions: ProfileDimension[]): number {
  if (dimensions.length === 0) return 50;
  return dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;
}

export function pickWeakestDimension(dimensions: ProfileDimension[]): ProfileDimension {
  const min = Math.min(...dimensions.map((d) => d.score));
  const cands = dimensions.filter((d) => d.score === min);
  if (cands.length === 1) return cands[0];
  for (const k of WEAK_TIE_ORDER) {
    const hit = cands.find((d) => d.key === k);
    if (hit) return hit;
  }
  return cands[0];
}

export function pickStrongestDimension(dimensions: ProfileDimension[]): ProfileDimension {
  const max = Math.max(...dimensions.map((d) => d.score));
  const cands = dimensions.filter((d) => d.score === max);
  return cands[0];
}

function strategyLineForWeakest(weakest: ProfileDimensionKey, locale: Locale): string {
  if (locale === "en") {
    switch (weakest) {
      case "activities":
        return "I’d tighten one deep activity thread first, then trim Reach names that depend on “vibes.”";
      case "essays":
        return "I’d lock activities + direction, then draft—don’t let the essay carry the whole story alone.";
      case "academic":
        return "I’d pin down GPA scale and core rigor, then rewrite fit notes so Reach isn’t guessing.";
      case "testing":
        return "I’d decide submit vs optional + test months, then rebuild verification around real dates.";
      case "strategy":
        return "I’d write budget/dealbreakers/decision owners—so Safety is a real floor, not comfort language.";
      default:
        return "I’d fix the weakest band above before adding more Reach.";
    }
  }
  switch (weakest) {
    case "activities":
      return "建议你先把 1 条活动主线写深，再收紧依赖「感觉」的冲刺校。";
    case "essays":
      return "建议你先把活动与方向补实，再动笔主文书，别让文书单独扛叙事。";
    case "academic":
      return "建议你先把 GPA 口径与核心课难度写清楚，再调整冲校理由的可信度。";
    case "testing":
      return "建议你先把交不交分与考试时间定死，再把核对清单落到具体日期。";
    case "strategy":
      return "建议你先把预算、底线与谁拍板写进补充说明，让保底校成为真保底。";
    default:
      return "建议你先把最短的那一项抬到及格线，再扩张冲刺名单。";
  }
}

function hasStructuredActivities(form: FormState): boolean {
  return (form.structuredActivities ?? []).some((item) =>
    [item.name, item.role, item.description, item.outcome, item.award].some((value) => value.trim().length > 0),
  );
}

function informationCompleteness(form: FormState): number {
  let score = 0;
  if (form.gpa.trim().length > 0) score += 1;
  if (form.highSchoolSystem.trim().length > 0) score += 1;
  if (form.testing === "test_optional" || form.satScore.trim() || form.actScore.trim()) score += 1;
  if (form.majorPrimary.trim().length > 0) score += 1;
  if (form.activities.trim().length > 20 || hasStructuredActivities(form)) score += 1;
  if (form.riskStyle) score += 1;
  if (form.budget) score += 1;
  if (form.geoPrefs.length > 0 || form.dealbreakers.trim().length > 0) score += 1;
  return score / 8;
}

function dimension(dimensions: ProfileDimension[], key: ProfileDimensionKey): ProfileDimension {
  return dimensions.find((d) => d.key === key) ?? dimensions[0];
}

function headlineFromProfile(form: FormState, dimensions: ProfileDimension[], locale: Locale): string {
  const avg = avgScore(dimensions);
  const completeness = informationCompleteness(form);
  const weakest = pickWeakestDimension(dimensions);
  const strongest = pickStrongestDimension(dimensions);
  const academic = dimension(dimensions, "academic");
  const testing = dimension(dimensions, "testing");
  const activities = dimension(dimensions, "activities");
  const essays = dimension(dimensions, "essays");
  const strategy = dimension(dimensions, "strategy");

  if (locale === "en") {
    if (completeness < 0.45) {
      return "There isn’t enough signal yet to name a clean school band; I’d treat this as a conservative first read.";
    }
    if (academic.score < 48) {
      return "The list should stay anchored in the Top 50–80 range until the transcript context is clearer.";
    }
    if (testing.score < 48 && form.testing === "will_submit") {
      return "Your ceiling is hard to price until the promised test score becomes real; keep the first list conservative.";
    }
    if (activities.score < 50 && essays.score < 58) {
      return "Academics may carry part of the case, but the application story is not ready for a Top 30-heavy list yet.";
    }
    if (avg >= 74 && academic.score >= 66 && (testing.score >= 66 || form.testing === "test_optional") && activities.score >= 62) {
      return "You have a real high-selectivity case; the risk is overloading the list with reach schools, not lacking ambition.";
    }
    if (avg >= 64 && weakest.score >= 54) {
      return "You are closer to a Top 30–50 main battlefield; the next move is tightening fit proof, not adding more names.";
    }
    if (strongest.key === "academic" && activities.score < 58) {
      return "Your academic signal is the anchor, but activity evidence still keeps the list closer to Top 40–60 for now.";
    }
    if (strategy.score < 54) {
      return "The profile has usable signals, but the school list will wobble until budget, geography, and risk posture are fixed.";
    }
    return "This reads like a Top 40–60 planning case right now: workable, but not stable enough to call Top 30 by default.";
  }

  if (completeness < 0.45) {
    return "现在信息还不够给出稳定档位；系统会先按保守模式处理，别急着把目标锁死。";
  }
  if (academic.score < 48) {
    return "当前名单更应该先锚在 Top 50–80；成绩单口径没补清前，不适合直接喊 Top 30。";
  }
  if (testing.score < 48 && form.testing === "will_submit") {
    return "你现在的上限还卡在标化承诺上：说要交分但分数没落地，名单先别推太激进。";
  }
  if (activities.score < 50 && essays.score < 58) {
    return "学术可能能撑住一部分，但活动和叙事还不够，暂时不适合做 Top 30 密集名单。";
  }
  if (avg >= 74 && academic.score >= 66 && (testing.score >= 66 || form.testing === "test_optional") && activities.score >= 62) {
    return "你已经有冲高选择性学校的基础；真正要控的是名单风险，不是继续证明自己够不够敢。";
  }
  if (avg >= 64 && weakest.score >= 54) {
    return "你更接近 Top 30–50 主战场；下一步不是加学校，而是把匹配证据写得更硬。";
  }
  if (strongest.key === "academic" && activities.score < 58) {
    return "你的学术信号是锚点，但活动证据还没跟上；现在更像 Top 40–60 的规划局面。";
  }
  if (strategy.score < 54) {
    return "你的材料里有可用信号，但预算、地区和风险姿态没定清，名单会比较容易摇摆。";
  }
  return "目前更像 Top 40–60 的规划盘：不是没有机会，而是还不足以默认按 Top 30 来排。";
}

function sublineFromForm(form: FormState, weakest: ProfileDimension, locale: Locale): string | null {
  if (form.riskStyle !== "aggressive") return null;
  if (weakest.score >= 58) return null;
  if (locale === "en") {
    return "Your list posture looks aggressive—if the short board above stays short, pushing the very top tier gets risky.";
  }
  return "你选校风格偏激进：最短那块不先补，硬顶最顶尖档风险会偏高。";
}

export function buildOverallVerdict(form: FormState, dimensions: ProfileDimension[], locale: Locale): OverallVerdict {
  const weakest = pickWeakestDimension(dimensions);
  const strongest = pickStrongestDimension(dimensions);
  const headline = headlineFromProfile(form, dimensions, locale);
  const subline = sublineFromForm(form, weakest, locale);

  if (locale === "en") {
    return {
      headline,
      subline,
      advantage: `Your strongest board right now is ${labelEn(strongest.key)}: ${strongest.judgment}`,
      weakness: `Your biggest drag is ${labelEn(weakest.key)}: ${weakest.judgment}`,
      strategy: strategyLineForWeakest(weakest.key, locale),
    };
  }

  return {
    headline,
    subline,
    advantage: `你目前握得最稳的是「${labelZh(strongest.key)}」——${strongest.judgment}`,
    weakness: `你目前最大的窟窿在「${labelZh(weakest.key)}」——${weakest.judgment}`,
    strategy: strategyLineForWeakest(weakest.key, locale),
  };
}

function labelZh(k: ProfileDimensionKey): string {
  const m: Record<ProfileDimensionKey, string> = {
    academic: "学术（GPA）",
    testing: "标化成绩",
    activities: "活动与经历",
    essays: "文书潜力",
    strategy: "申请策略",
  };
  return m[k];
}

function labelEn(k: ProfileDimensionKey): string {
  const m: Record<ProfileDimensionKey, string> = {
    academic: "Academics (GPA)",
    testing: "Testing",
    activities: "Activities",
    essays: "Essays",
    strategy: "Strategy",
  };
  return m[k];
}

function stakeLine(weakest: ProfileDimension, locale: Locale): string {
  if (locale === "en") {
    switch (weakest.key) {
      case "activities":
        return "This is the main lever that decides whether your tier story looks “real” or generic.";
      case "essays":
        return "This is what decides whether your application reads like a person—or a polished outline.";
      case "academic":
        return "This is what admissions will weight first when they sanity-check your Reach list.";
      case "testing":
        return "This is what changes how conservative your verification work—and merit screens—should be.";
      case "strategy":
        return "This is what keeps your Safety schools from becoming “paper comfort” when decisions get stressful.";
      default:
        return "Fixing this moves your whole list from fragile to negotiable.";
    }
  }
  switch (weakest.key) {
    case "activities":
      return "这是决定你「像真人」还是「像模板」的关键杠杆，也会直接拽住冲刺上限。";
    case "essays":
      return "这是决定你读起来像不像「你自己」的关键杠杆。";
    case "academic":
      return "这是招生官最先拿来 sanity check 你冲校名单的那根梁。";
    case "testing":
      return "这会直接改变你核对材料时该保守还是该收紧。";
    case "strategy":
      return "这是压力下还能不能让「保底」继续成立的那根绳。";
    default:
      return "这是把名单从「飘」拉回「可执行」的核心问题。";
  }
}

export function buildBiggestGapBlock(dimensions: ProfileDimension[], locale: Locale): BiggestGapBlock {
  const dimension = pickWeakestDimension(dimensions);
  return { dimension, stakeLine: stakeLine(dimension, locale) };
}
