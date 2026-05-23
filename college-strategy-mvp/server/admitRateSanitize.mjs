const UNSOURCED_PATTERNS = [
  /\b\d{1,2}(\.\d+)?%\s*(的?\s*)?(录取率|acceptance\s+rate|admit\s+rate|admission\s+rate)/gi,
  /(录取率|acceptance\s+rate|admit\s+rate)[^.\n]{0,24}\d{1,2}(\.\d+)?%/gi,
  /(去年|上年度|past\s+year|last\s+year)[^.\n]{0,20}(进了|录取了|admitted)\s*\d+/gi,
  /(你校|你们学校|your\s+school)[^.\n]{0,30}(进了|录取|admit)\s*\d+/gi,
];

const REPLACEMENT_ZH = "具体数据请到官网 CDS/录取页核对（勿引用未注明来源的统计）。";
const REPLACEMENT_EN = "Confirm figures on the official CDS/admissions pages—do not cite unsourced statistics.";

/** @param {string} text @param {"zh"|"en"} locale */
export function sanitizeUnsourcedStats(text, locale = "zh") {
  let s = String(text || "").trim();
  if (!s) return s;
  const replacement = locale === "en" ? REPLACEMENT_EN : REPLACEMENT_ZH;
  for (const re of UNSOURCED_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(s)) {
      s = s.replace(re, "").replace(/\s{2,}/g, " ").trim();
      if (s && !/CDS|官网|official/i.test(s)) s = `${s} ${replacement}`;
      else if (!s) s = replacement;
    }
  }
  return s.trim();
}

/** @param {Record<string, unknown>} row @param {"zh"|"en"} locale */
export function sanitizeSchoolRowTextFields(row, locale) {
  const out = { ...row };
  for (const key of ["context_note", "campus_vibe", "differentiation", "why_reach_for_you", "why_match_for_you", "why_safety_for_you"]) {
    if (typeof out[key] === "string") out[key] = sanitizeUnsourcedStats(out[key], locale);
  }
  for (const arrKey of ["key_risks", "key_fit_signals", "verification_focus"]) {
    if (Array.isArray(out[arrKey])) {
      out[arrKey] = out[arrKey].map((x) => sanitizeUnsourcedStats(String(x), locale)).filter(Boolean);
    }
  }
  return out;
}
