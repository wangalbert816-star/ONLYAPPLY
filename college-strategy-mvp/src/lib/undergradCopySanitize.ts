import type { SchoolRow, SchoolTier } from "../types";
import type { Locale } from "../i18n/strings";
import { normalizeSchoolNameInput } from "./schoolNameResolve";

type ReplacementRule = { pattern: RegExp; zh: string; en: string };

function pick(rule: ReplacementRule, locale: Locale): string {
  return locale === "en" ? rule.en : rule.zh;
}

function applyRules(text: string, rules: ReplacementRule[], locale: Locale): string {
  let s = text;
  for (const rule of rules) {
    const rep = pick(rule, locale);
    if (rep && s.includes(rep)) continue;
    s = s.replace(rule.pattern, rep);
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

/** 研究生商学院 / 研究生院误表述 — 按校匹配 */
const SCHOOL_GRAD_RULES: Array<{ schoolMatch: RegExp; replacements: ReplacementRule[] }> = [
  {
    schoolMatch: /\bucla\b|los angeles|洛杉矶/i,
    replacements: [
      {
        pattern: /UCLA\s+Anderson(\s+School(\s+of\s+Management)?)?/gi,
        zh: "UCLA 本科相关专业（Anderson 为研究生商学院，非本科路径）",
        en: "UCLA undergraduate majors (Anderson is graduate-only—not an undergrad school)",
      },
      {
        pattern: /强?\s*商学院\s*[\(（]?\s*Anderson\s*[\)）]?/gi,
        zh: "UCLA 本科经济/商科相关方向",
        en: "undergraduate business/econ-related paths at UCLA",
      },
      { pattern: /核实\s*Anderson/gi, zh: "核实 UCLA 本科招生", en: "Verify UCLA undergraduate admissions" },
      {
        pattern: /Anderson(\s+School(\s+of\s+Management)?)?/gi,
        zh: "UCLA 本科相关专业（Anderson 为研究生商学院）",
        en: "UCLA undergraduate paths (Anderson is graduate-only)",
      },
      { pattern: /Anderson对/gi, zh: "UCLA 本科招生对", en: "UCLA undergraduate admissions for" },
    ],
  },
  {
    schoolMatch: /berkeley|伯克利/i,
    replacements: [
      {
        pattern: /Haas(\s+School\s+of\s+Business)?/gi,
        zh: "Berkeley 商科相关本科方向（Haas 本科极难且非默认路径）",
        en: "Berkeley business-related undergraduate majors (Haas undergrad is separate and ultra-selective)",
      },
      { pattern: /伯克利\s*Haas\s*商学院/gi, zh: "Berkeley 商科相关本科方向", en: "Berkeley business-related undergraduate paths" },
    ],
  },
  {
    schoolMatch: /upenn|penn\b|pennsylvania|宾夕法尼亚|宾大/i,
    replacements: [
      {
        pattern: /Wharton(\s+School(\s+of\s+Business)?)?/gi,
        zh: "Penn 本科相关专业（Wharton 为研究生商学院，非默认本科路径）",
        en: "Penn undergraduate majors (Wharton is graduate-only—not a default undergrad path)",
      },
      { pattern: /核实\s*Wharton/gi, zh: "核实 Penn 本科招生", en: "Verify Penn undergraduate admissions" },
    ],
  },
  {
    schoolMatch: /\bmit\b|massachusetts institute|麻省理工/i,
    replacements: [
      {
        pattern: /Sloan(\s+School(\s+of\s+Management)?)?/gi,
        zh: "MIT 本科相关专业（Sloan 为研究生商学院，非本科路径）",
        en: "MIT undergraduate majors (Sloan is graduate-only—not an undergrad school)",
      },
      { pattern: /核实\s*Sloan/gi, zh: "核实 MIT 本科招生", en: "Verify MIT undergraduate admissions" },
    ],
  },
  {
    schoolMatch: /uchicago|university of chicago|芝加哥大学/i,
    replacements: [
      {
        pattern: /Booth(\s+School(\s+of\s+Business)?)?/gi,
        zh: "UChicago 本科相关专业（Booth 为研究生商学院，非本科路径）",
        en: "UChicago undergraduate majors (Booth is graduate-only—not an undergrad school)",
      },
      { pattern: /核实\s*Booth/gi, zh: "核实 UChicago 本科招生", en: "Verify UChicago undergraduate admissions" },
    ],
  },
  {
    schoolMatch: /northwestern|西北大学/i,
    replacements: [
      {
        pattern: /Kellogg(\s+School(\s+of\s+Management)?)?/gi,
        zh: "Northwestern 本科相关专业（Kellogg 为研究生商学院，非本科路径）",
        en: "Northwestern undergraduate majors (Kellogg is graduate-only—not an undergrad school)",
      },
    ],
  },
  {
    schoolMatch: /columbia|哥伦比亚/i,
    replacements: [
      {
        pattern: /Columbia\s+Business\s+School|\bCBS\b/gi,
        zh: "Columbia 本科相关专业（商学院为研究生，非默认本科路径）",
        en: "Columbia undergraduate majors (business school is graduate—not a default undergrad path)",
      },
    ],
  },
  {
    schoolMatch: /harvard|哈佛/i,
    replacements: [
      {
        pattern: /Harvard\s+Business\s+School|\bHBS\b/gi,
        zh: "Harvard College 本科相关专业（HBS 为研究生商学院，非本科路径）",
        en: "Harvard College undergraduate majors (HBS is graduate-only—not an undergrad school)",
      },
    ],
  },
  {
    schoolMatch: /yale|耶鲁/i,
    replacements: [
      {
        pattern: /Yale\s+School\s+of\s+Management|\bSOM\b/gi,
        zh: "Yale 本科相关专业（SOM 为研究生商学院，非本科路径）",
        en: "Yale undergraduate majors (SOM is graduate-only—not an undergrad school)",
      },
    ],
  },
  {
    schoolMatch: /stanford|斯坦福/i,
    replacements: [
      {
        pattern: /Graduate\s+School\s+of\s+Business|\bGSB\b|Stanford\s+G\.?S\.?B\.?/gi,
        zh: "Stanford 本科相关专业（GSB 为研究生商学院，非本科路径）",
        en: "Stanford undergraduate majors (GSB is graduate-only—not an undergrad school)",
      },
    ],
  },
  {
    schoolMatch: /nyu|new york university|纽约大学/i,
    replacements: [
      {
        pattern: /Stern(\s+School(\s+of\s+Business)?)?/gi,
        zh: "NYU 本科商科相关方向（Stern 本科极难且非默认路径）",
        en: "NYU business-related undergraduate paths (Stern undergrad is ultra-selective—not a default path)",
      },
    ],
  },
  {
    schoolMatch: /michigan|umich|密歇根/i,
    replacements: [
      {
        pattern: /Ross(\s+School(\s+of\s+Business)?)?/gi,
        zh: "Michigan 本科商科相关方向（Ross 本科极难且非默认路径）",
        en: "Michigan business-related undergraduate paths (Ross undergrad is ultra-selective—not a default path)",
      },
    ],
  },
  {
    schoolMatch: /usc\b|southern california|南加州/i,
    replacements: [
      {
        pattern: /Marshall(\s+School(\s+of\s+Business)?)?/gi,
        zh: "USC 本科商科相关方向（Marshall 本科极难且非默认路径）",
        en: "USC business-related undergraduate paths (Marshall undergrad is ultra-selective—not a default path)",
      },
    ],
  },
  {
    schoolMatch: /texas at austin|ut austin|德州奥斯汀/i,
    replacements: [
      {
        pattern: /McCombs(\s+School(\s+of\s+Business)?)?/gi,
        zh: "UT Austin 本科商科/经济相关方向（本科商学院名额极难，非默认路径）",
        en: "UT Austin business/econ-related undergraduate paths (undergrad business is ultra-selective—not a default path)",
      },
    ],
  },
  {
    schoolMatch: /north carolina|unc\b|chapel hill|北卡|教堂山/i,
    replacements: [
      {
        pattern: /Kenan[- ]Flagler(\s+Business\s+School)?/gi,
        zh: "UNC 本科商科/经济相关方向（本科商学院名额极难，非默认路径）",
        en: "UNC business/econ-related undergraduate paths (undergrad business is ultra-selective—not a default path)",
      },
    ],
  },
  {
    schoolMatch: /duke|杜克/i,
    replacements: [
      {
        pattern: /Fuqua(\s+School(\s+of\s+Business)?)?/gi,
        zh: "Duke 本科相关专业（Fuqua 为研究生商学院，非本科路径）",
        en: "Duke undergraduate majors (Fuqua is graduate-only—not an undergrad school)",
      },
    ],
  },
  {
    schoolMatch: /cornell|康奈尔/i,
    replacements: [
      {
        pattern: /Johnson(\s+Graduate\s+School\s+of\s+Management)?/gi,
        zh: "Cornell 本科相关专业（Johnson 为研究生商学院，非本科路径）",
        en: "Cornell undergraduate majors (Johnson is graduate-only—not an undergrad school)",
      },
    ],
  },
  {
    schoolMatch: /dartmouth|达特茅斯/i,
    replacements: [
      {
        pattern: /Tuck(\s+School(\s+of\s+Business)?)?/gi,
        zh: "Dartmouth 本科相关专业（Tuck 为研究生商学院，非本科路径）",
        en: "Dartmouth undergraduate majors (Tuck is graduate-only—not an undergrad school)",
      },
    ],
  },
  {
    schoolMatch: /carnegie mellon|\bcmu\b|卡内基梅隆/i,
    replacements: [
      {
        pattern: /Tepper(\s+School(\s+of\s+Business)?)?/gi,
        zh: "CMU 本科相关专业（Tepper 为研究生商学院，非本科路径）",
        en: "CMU undergraduate majors (Tepper is graduate-only—not an undergrad school)",
      },
    ],
  },
];

/** 无校名上下文时的保守兜底（避免 executive summary 等字段漏网） */
const GLOBAL_GRAD_REPLACEMENTS: ReplacementRule[] = [
  {
    pattern: /UCLA\s+Anderson(\s+School(\s+of\s+Management)?)?/gi,
    zh: "UCLA 本科相关专业（Anderson 为研究生商学院）",
    en: "UCLA undergraduate paths (Anderson is graduate-only)",
  },
  {
    pattern: /Haas\s+School\s+of\s+Business/gi,
    zh: "Berkeley 商科相关本科方向",
    en: "Berkeley business-related undergraduate paths",
  },
  {
    pattern: /Wharton(\s+School(\s+of\s+Business)?)?/gi,
    zh: "Penn 本科相关专业（Wharton 为研究生商学院）",
    en: "Penn undergraduate paths (Wharton is graduate-only)",
  },
  {
    pattern: /核实\s*(Anderson|Wharton|Sloan|Booth|Haas|Fuqua|Tepper|Tuck|Kellogg)/gi,
    zh: "核实该校本科招生",
    en: "Verify undergraduate admissions on the official site",
  },
];

function rulesForSchool(school: string): ReplacementRule[] {
  const normalized = normalizeSchoolNameInput(school);
  const schoolSpecific: ReplacementRule[] = [];
  for (const block of SCHOOL_GRAD_RULES) {
    if (block.schoolMatch.test(normalized) || block.schoolMatch.test(school)) {
      schoolSpecific.push(...block.replacements);
    }
  }
  if (schoolSpecific.length > 0) return schoolSpecific;
  return GLOBAL_GRAD_REPLACEMENTS;
}

/** 本科报告：去除 Anderson/Wharton/Sloan 等研究生院系误表述 */
export function sanitizeUndergradSchoolMentions(text: string, school: string, locale: Locale = "zh"): string {
  const s = String(text || "").trim();
  if (!s) return s;
  return applyRules(s, rulesForSchool(school), locale);
}

export function sanitizeSchoolRowUndergradCopy(row: SchoolRow, _tier: SchoolTier, locale: Locale): SchoolRow {
  const school = row.school || "";
  return {
    ...row,
    why_reach_for_you: row.why_reach_for_you
      ? sanitizeUndergradSchoolMentions(row.why_reach_for_you, school, locale)
      : row.why_reach_for_you,
    why_match_for_you: row.why_match_for_you
      ? sanitizeUndergradSchoolMentions(row.why_match_for_you, school, locale)
      : row.why_match_for_you,
    why_safety_for_you: row.why_safety_for_you
      ? sanitizeUndergradSchoolMentions(row.why_safety_for_you, school, locale)
      : row.why_safety_for_you,
    campus_vibe: row.campus_vibe ? sanitizeUndergradSchoolMentions(row.campus_vibe, school, locale) : row.campus_vibe,
    differentiation: row.differentiation ? sanitizeUndergradSchoolMentions(row.differentiation, school, locale) : row.differentiation,
    context_note: row.context_note ? sanitizeUndergradSchoolMentions(row.context_note, school, locale) : row.context_note,
    key_fit_signals: (row.key_fit_signals ?? []).map((x) => sanitizeUndergradSchoolMentions(x, school, locale)).filter(Boolean),
    key_risks: (row.key_risks ?? []).map((x) => sanitizeUndergradSchoolMentions(x, school, locale)).filter(Boolean),
    verification_focus: (row.verification_focus ?? []).map((x) => sanitizeUndergradSchoolMentions(x, school, locale)).filter(Boolean),
  };
}

const FACULTY_ERROR_RE =
  /UCLA\s+Anderson|强?\s*商学院\s*[\(（]?\s*Anderson|核实\s*Anderson|Anderson对|Haas\s*School|伯克利\s*Haas\s*商学院|(verify|核实)\s*(Anderson|Wharton|Sloan|Booth|Haas|Kellogg|Fuqua|Tepper|Tuck)/i;

export function containsUndergradFacultyErrors(blob: string): boolean {
  return FACULTY_ERROR_RE.test(String(blob || ""));
}
