import type { FormState } from "../types";
import type { Locale } from "../i18n/strings";
import type { ProfileDimension, ProfileDimensionKey } from "./fiveDimensionProfile";
import { getEffectiveIntake } from "./intakeTerm";

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

type ProfileFacts = {
  major: string;
  major2: string | null;
  intake: string | null;
  gpaSnippet: string | null;
  testingLine: string | null;
  activitySnippet: string | null;
  budgetLine: string | null;
  riskLine: string | null;
  missingFields: string[];
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

function listMissingFields(form: FormState, locale: Locale): string[] {
  const isEn = locale === "en";
  const missing: string[] = [];
  if (!form.gpa.trim()) missing.push(isEn ? "GPA notes" : "GPA/成绩说明");
  if (!form.majorPrimary.trim()) missing.push(isEn ? "primary major" : "主申专业");
  if (!form.testing) missing.push(isEn ? "testing strategy" : "标化策略");
  if (form.activities.trim().length < 20 && !hasStructuredActivities(form))
    missing.push(isEn ? "activities" : "活动摘要");
  if (!form.budget) missing.push(isEn ? "budget posture" : "预算/经济");
  if (!form.riskStyle) missing.push(isEn ? "list posture" : "选校风格");
  return missing.slice(0, 3);
}

function budgetLabel(form: FormState, locale: Locale): string | null {
  if (!form.budget) return null;
  const zh: Record<string, string> = {
    full_pay: "可全额自费",
    high_budget: "预算较高但仍控成本",
    budget_cap: "有明确预算上限",
    need_aid: "需要奖助学金支撑",
    unsure: "预算尚不确定",
  };
  const en: Record<string, string> = {
    full_pay: "full-pay feasible",
    high_budget: "high budget with cost control",
    budget_cap: "clear budget cap",
    need_aid: "needs aid/scholarships",
    unsure: "budget unclear",
  };
  return (locale === "en" ? en : zh)[form.budget] ?? form.budget;
}

function riskLabel(form: FormState, locale: Locale): string | null {
  if (!form.riskStyle) return null;
  const zh: Record<string, string> = {
    conservative: "偏保守",
    balanced: "偏平衡",
    aggressive: "偏激进",
  };
  const en: Record<string, string> = {
    conservative: "conservative",
    balanced: "balanced",
    aggressive: "aggressive",
  };
  return (locale === "en" ? en : zh)[form.riskStyle] ?? form.riskStyle;
}

function testingLine(form: FormState, locale: Locale): string | null {
  if (!form.testing) return null;
  if (form.testing === "test_optional") {
    return locale === "en" ? "test-optional" : "选 Test-Optional";
  }
  if (form.testing === "will_submit") {
    const sat = form.satScore.trim();
    const act = form.actScore.trim();
    if (sat && act) return locale === "en" ? `submit SAT ${sat} / ACT ${act}` : `计划递交 SAT ${sat}、ACT ${act}`;
    if (sat) return locale === "en" ? `submit SAT ${sat}` : `计划递交 SAT ${sat}`;
    if (act) return locale === "en" ? `submit ACT ${act}` : `计划递交 ACT ${act}`;
    return locale === "en" ? "will submit scores (not filled in yet)" : "计划递交标化（分数未填）";
  }
  return null;
}

function extractProfileFacts(form: FormState, locale: Locale): ProfileFacts {
  const major = form.majorPrimary.trim();
  const major2 = form.majorSecondary.trim() || null;
  const intake = getEffectiveIntake(form) || null;
  const gpaSnippet = form.gpa.trim() ? form.gpa.trim().slice(0, 72) : null;
  let activitySnippet: string | null = null;
  const structured = (form.structuredActivities ?? []).find((a) => a.name?.trim());
  if (structured?.name) {
    activitySnippet =
      locale === "en"
        ? structured.name.trim().slice(0, 48)
        : `结构化活动「${structured.name.trim().slice(0, 32)}」`;
  } else if (form.activities.trim().length > 12) {
    activitySnippet = form.activities.trim().slice(0, 56);
  }
  return {
    major: major || (locale === "en" ? "your intended major" : "你的主申方向"),
    major2,
    intake,
    gpaSnippet,
    testingLine: testingLine(form, locale),
    activitySnippet,
    budgetLine: budgetLabel(form, locale),
    riskLine: riskLabel(form, locale),
    missingFields: listMissingFields(form, locale),
  };
}

function dimension(dimensions: ProfileDimension[], key: ProfileDimensionKey): ProfileDimension {
  return dimensions.find((d) => d.key === key) ?? dimensions[0];
}

/** 过滤模型返回的过于空泛的「策略总览」首句 */
function isUsableExecutiveLead(line: string | null | undefined, facts: ProfileFacts): boolean {
  const s = String(line ?? "").trim();
  if (s.length < 18 || s.length > 200) return false;
  const genericZh = /整体画像偏|平衡型 STEM|不是缺乏野心|可把目标校往上抬|宜采用.*策略/i;
  const genericEn = /balanced.*profile|not lacking ambition|lift targets|generic/i;
  if (genericZh.test(s) || genericEn.test(s)) {
    const hasFact =
      s.includes(facts.major) ||
      (facts.gpaSnippet && s.includes(facts.gpaSnippet.slice(0, 12))) ||
      (facts.activitySnippet && s.includes(facts.activitySnippet.slice(0, 10)));
    if (!hasFact) return false;
  }
  return true;
}

function headlineFromProfile(form: FormState, dimensions: ProfileDimension[], locale: Locale): string {
  const facts = extractProfileFacts(form, locale);
  const completeness = informationCompleteness(form);
  const weakest = pickWeakestDimension(dimensions);
  const strongest = pickStrongestDimension(dimensions);
  const academic = dimension(dimensions, "academic");
  const testing = dimension(dimensions, "testing");
  const activities = dimension(dimensions, "activities");
  const weakLabel = locale === "en" ? labelEn(weakest.key) : labelZh(weakest.key);

  if (locale === "en") {
    if (completeness < 0.45 && facts.missingFields.length) {
      return `For ${facts.major} (${facts.intake ?? "intake TBD"}), I can’t lock a band yet—missing ${facts.missingFields.join(", ")}—so read this as a conservative first pass.`;
    }
    if (academic.score < 48) {
      return `With ${facts.major} as the anchor, your transcript notes are still too thin to justify a reach-heavy list; I’d keep the first cut closer to match/safety until GPA context is checkable.`;
    }
    if (testing.score < 48 && form.testing === "will_submit") {
      return `You chose to submit scores but haven’t anchored a number yet—until ${facts.testingLine ?? "testing"} is real, I wouldn’t price a high-selectivity ceiling for ${facts.major}.`;
    }
    if (activities.score < 50 && !facts.activitySnippet) {
      return `For ${facts.major}, academics may carry part of the case, but with almost no activity signal the story isn’t ready for a prestige-heavy reach stack.`;
    }
    if (activities.score < 50 && facts.activitySnippet) {
      return `For ${facts.major}, you have a start (${facts.activitySnippet}), but activity depth is still the cap—reach names that need a sharp thread will wobble.`;
    }
    if (form.riskStyle === "aggressive" && weakest.score < 54) {
      return `Your list posture is aggressive, but ${weakLabel} is still short for ${facts.major}—pushing the very top tier before that board is fixed is where families get burned.`;
    }
    if (facts.budgetLine === "needs aid/scholarships" && dimension(dimensions, "strategy").score < 58) {
      return `You need aid/scholarships for ${facts.major}; until net-cost rules are written down, “reach” schools can look exciting on paper and painful after decisions.`;
    }
    if (strongest.key === "academic" && activities.score >= 62 && facts.gpaSnippet) {
      return `Your academic line (${facts.gpaSnippet}) is the anchor for ${facts.major}; the list can aim higher, but reach should still be argued with coursework + activities—not brand names alone.`;
    }
    if (avgScore(dimensions) >= 68 && weakest.score >= 56) {
      return `For ${facts.major}, you’re in a workable selective band; the next lever is tightening ${weakLabel}, not sprinkling on more famous names.`;
    }
    return `For ${facts.major}${facts.intake ? ` (${facts.intake})` : ""}, this is a workable planning case—${weakLabel} is what still sets how high the reach tier can responsibly go.`;
  }

  if (completeness < 0.45 && facts.missingFields.length) {
    return `你主申 ${facts.major}${facts.intake ? `、目标 ${facts.intake}` : ""}，但 ${facts.missingFields.join("、")} 等还没对齐，整体结论只能先按保守初判，别急着锁死冲刺校。`;
  }
  if (academic.score < 48) {
    return `在「${facts.major}」前提下，成绩单信息仍偏薄，名单不宜先按冲名校排；${facts.gpaSnippet ? `你写的「${facts.gpaSnippet}」` : "GPA 口径"} 还需要能对照官网核对。`;
  }
  if (testing.score < 48 && form.testing === "will_submit") {
    return `你主申 ${facts.major} 且${facts.testingLine ?? "计划递交标化"}，但分数/节奏未落地——在上限没锚定前，不宜把名单推得过激进。`;
  }
  if (activities.score < 50 && !facts.activitySnippet) {
    return `主申 ${facts.major} 时，学术可能能撑住一部分，但活动几乎为空，暂不适合做「冲名校密集」名单。`;
  }
  if (activities.score < 50 && facts.activitySnippet) {
    return `主申 ${facts.major}，你已有「${facts.activitySnippet}」等线索，但活动深度仍卡上限——依赖名气的冲刺校理由会发虚。`;
  }
  if (form.riskStyle === "aggressive" && weakest.score < 54) {
    return `你选校风格偏激进，但「${weakLabel}」仍偏短（${facts.major}）——这块不先补，硬顶最顶尖档风险会偏高。`;
  }
  if (form.budget === "need_aid" && dimension(dimensions, "strategy").score < 58) {
    return `你主申 ${facts.major} 且需要奖助支撑；预算与净花费规则没写清前，「冲」校容易看起来很美、落地很难。`;
  }
  if (strongest.key === "academic" && activities.score >= 62 && facts.gpaSnippet) {
    return `主申 ${facts.major}，学术线（${facts.gpaSnippet}）是目前最稳的锚；名单可以往上探，但冲刺仍需课程+活动证据，不能只看排名。`;
  }
  if (avgScore(dimensions) >= 68 && weakest.score >= 56) {
    return `就 ${facts.major} 而言，你已在「可规划的选择性区间」内；下一步是补强「${weakLabel}」，而不是再加一所名气更大的学校。`;
  }
  return `主申 ${facts.major}${facts.intake ? `、${facts.intake}` : ""}：整体可规划，但「${weakLabel}」仍决定你能不能把冲刺档写得让招生官信。`;
}

function sublineFromForm(form: FormState, weakest: ProfileDimension, facts: ProfileFacts, locale: Locale): string | null {
  const parts: string[] = [];
  if (form.riskStyle === "aggressive" && weakest.score < 58) {
    parts.push(
      locale === "en"
        ? "List posture is aggressive"
        : "名单风格偏激进",
    );
  }
  if (facts.budgetLine) {
    parts.push(locale === "en" ? `Budget: ${facts.budgetLine}` : `经济：${facts.budgetLine}`);
  }
  if (facts.testingLine) {
    parts.push(locale === "en" ? `Testing: ${facts.testingLine}` : `标化：${facts.testingLine}`);
  }
  if (!parts.length) return null;
  const joiner = locale === "en" ? "; " : "；";
  const tail =
    locale === "en"
      ? `—fix ${labelEn(weakest.key)} before you treat reach names as free options.`
      : `——先抬「${labelZh(weakest.key)}」，别把冲刺校当「加了不亏」。`;
  return parts.join(joiner) + tail;
}

function strategyLineForWeakest(
  weakest: ProfileDimensionKey,
  facts: ProfileFacts,
  locale: Locale,
): string {
  const major = facts.major;
  if (locale === "en") {
    switch (weakest) {
      case "activities":
        return facts.activitySnippet
          ? `Deepen “${facts.activitySnippet}” into one measurable thread for ${major}, then trim reach schools that only work with a vague story.`
          : `Pick one verifiable activity spine for ${major} (role + outcome), then cut reach names that need hype instead of evidence.`;
      case "essays":
        return `Lock ${major} + one activity scene before drafting—don’t let the essay invent a persona you haven’t built in the form.`;
      case "academic":
        return `Pin down GPA scale/rigor for ${major}, then rewrite reach rationales so they cite courses—not rank dreams.`;
      case "testing":
        return `Decide submit vs optional and real test months for ${major}, then rebuild verification around actual dates.`;
      case "strategy":
        return `Write who owns budget/aid decisions for ${major}—so safety schools stay real floors, not comfort language.`;
      default:
        return `Fix the shortest board above before adding more reach for ${major}.`;
    }
  }
  switch (weakest) {
    case "activities":
      return facts.activitySnippet
        ? `先把「${facts.activitySnippet}」收成一条可核对的主线（角色+结果），再收紧与 ${major} 不匹配、只靠名气的冲刺校。`
        : `先为 ${major} 定 1 条可验证的活动主线，再删那些需要「空叙事」才能成立的冲刺校。`;
    case "essays":
      return `先把 ${major} 与 1 个活动场景写实，再动笔主文书——别让文书单独发明人设。`;
    case "academic":
      return `先把 ${major} 相关的 GPA 口径与核心课强度写清，再改冲校理由，让它引用课程而不是排名。`;
    case "testing":
      return `先把 ${major} 申请链路上的「交不交分、何时考」定死，再把核对清单落到具体月份。`;
    case "strategy":
      return `把 ${major} 申请里的预算/奖助/谁拍板写进补充说明，让保底校成为真保底。`;
    default:
      return `先把最短的那一项抬到及格线，再为 ${major} 扩张冲刺名单。`;
  }
}

function advantageLine(strongest: ProfileDimension, facts: ProfileFacts, locale: Locale): string {
  const label = locale === "en" ? labelEn(strongest.key) : labelZh(strongest.key);
  let factHook = "";
  if (strongest.key === "academic" && facts.gpaSnippet) {
    factHook = locale === "en" ? ` (${facts.gpaSnippet})` : `（${facts.gpaSnippet}）`;
  } else if (strongest.key === "activities" && facts.activitySnippet) {
    factHook = locale === "en" ? ` (e.g. ${facts.activitySnippet})` : `（如 ${facts.activitySnippet}）`;
  } else if (strongest.key === "testing" && facts.testingLine) {
    factHook = locale === "en" ? ` (${facts.testingLine})` : `（${facts.testingLine}）`;
  } else if (strongest.key === "strategy" && facts.riskLine) {
    factHook = locale === "en" ? ` (${facts.riskLine} posture)` : `（名单${facts.riskLine}）`;
  }
  if (locale === "en") {
    return `Strongest board: ${label}${factHook} — ${strongest.judgment}`;
  }
  return `目前最稳的是「${label}」${factHook}：${strongest.judgment}`;
}

function weaknessLine(weakest: ProfileDimension, facts: ProfileFacts, locale: Locale): string {
  const label = locale === "en" ? labelEn(weakest.key) : labelZh(weakest.key);
  let factHook = "";
  if (weakest.key === "activities" && !facts.activitySnippet) {
    factHook = locale === "en" ? " (activities still thin in the form)" : "（问卷里活动仍偏薄）";
  } else if (weakest.key === "testing" && facts.testingLine) {
    factHook = locale === "en" ? ` (${facts.testingLine})` : `（${facts.testingLine}）`;
  } else if (weakest.key === "academic" && !facts.gpaSnippet) {
    factHook = locale === "en" ? " (transcript notes missing)" : "（成绩说明未写清）";
  } else if (weakest.key === "strategy" && facts.budgetLine) {
    factHook = locale === "en" ? ` (${facts.budgetLine})` : `（${facts.budgetLine}）`;
  }
  if (locale === "en") {
    return `Biggest drag: ${label}${factHook} — ${weakest.judgment}`;
  }
  return `目前最大短板在「${label}」${factHook}：${weakest.judgment}`;
}

export type BuildOverallVerdictOptions = {
  /** 模型生成的策略总览首句；足够具体时优先作为整体结论标题 */
  executiveLead?: string | null;
};

export function buildOverallVerdict(
  form: FormState,
  dimensions: ProfileDimension[],
  locale: Locale,
  options?: BuildOverallVerdictOptions,
): OverallVerdict {
  const facts = extractProfileFacts(form, locale);
  const weakest = pickWeakestDimension(dimensions);
  const strongest = pickStrongestDimension(dimensions);
  const headline =
    isUsableExecutiveLead(options?.executiveLead, facts) && options?.executiveLead
      ? options.executiveLead.trim()
      : headlineFromProfile(form, dimensions, locale);
  const subline = sublineFromForm(form, weakest, facts, locale);

  return {
    headline,
    subline,
    advantage: advantageLine(strongest, facts, locale),
    weakness: weaknessLine(weakest, facts, locale),
    strategy: strategyLineForWeakest(weakest.key, facts, locale),
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
