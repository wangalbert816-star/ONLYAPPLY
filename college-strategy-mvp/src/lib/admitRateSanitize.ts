/** 移除或替换无来源的录取率/「你校进了几人」类表述（第三期 #30–31） */
import { coerceStringArray } from "./coerceStringArray";

const UNSOURCED_PATTERNS: RegExp[] = [
  /\b\d{1,2}(\.\d+)?%\s*(的?\s*)?(录取率|acceptance\s+rate|admit\s+rate|admission\s+rate)/gi,
  /(录取率|acceptance\s+rate|admit\s+rate)[^.\n]{0,24}\d{1,2}(\.\d+)?%/gi,
  /(去年|上年度|past\s+year|last\s+year)[^.\n]{0,20}(进了|录取了|admitted)\s*\d+/gi,
  /(你校|你们学校|your\s+school)[^.\n]{0,30}(进了|录取|admit)\s*\d+/gi,
  /\d+\s*(名|人|students?)\s*(被?录取|got\s+in|were\s+admitted)/gi,
];

const REPLACEMENT_ZH = "具体数据请到官网 CDS/录取页核对（勿引用未注明来源的统计）。";
const REPLACEMENT_EN = "Confirm figures on the official CDS/admissions pages—do not cite unsourced statistics.";

export function containsUnsourcedStats(text: string): boolean {
  const s = String(text || "");
  return UNSOURCED_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(s);
  });
}

export function sanitizeUnsourcedStats(text: string, locale: "zh" | "en" = "zh"): string {
  let s = String(text || "").trim();
  if (!s) return s;
  const replacement = locale === "en" ? REPLACEMENT_EN : REPLACEMENT_ZH;
  for (const re of UNSOURCED_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(s)) {
      s = s.replace(re, "").replace(/\s{2,}/g, " ").trim();
      if (s && !/CDS|官网|official/i.test(s)) {
        s = `${s} ${replacement}`;
      } else if (!s) {
        s = replacement;
      }
    }
  }
  return s.trim();
}

export function sanitizeSchoolRowTextFields<T extends Record<string, unknown>>(row: T, locale: "zh" | "en"): T {
  const out = { ...row };
  for (const key of ["context_note", "campus_vibe", "differentiation"] as const) {
    if (typeof out[key] === "string") {
      (out as Record<string, string>)[key] = sanitizeUnsourcedStats(out[key] as string, locale);
    }
  }
  for (const key of ["why_reach_for_you", "why_match_for_you", "why_safety_for_you"] as const) {
    if (typeof out[key] === "string") {
      (out as Record<string, string>)[key] = sanitizeUnsourcedStats(out[key] as string, locale);
    }
  }
  for (const arrKey of ["key_risks", "key_fit_signals", "verification_focus"] as const) {
    const coerced = coerceStringArray(out[arrKey]);
    (out as Record<string, string[]>)[arrKey] = coerced
      .map((x) => sanitizeUnsourcedStats(String(x), locale))
      .filter(Boolean);
  }
  return out;
}
