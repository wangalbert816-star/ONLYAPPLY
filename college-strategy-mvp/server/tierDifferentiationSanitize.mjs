import { normalizeSchoolNameInput, schoolNameLookupVariants } from "./schoolNameResolve.mjs";
import { coerceStringArray } from "./coerceStringArray.mjs";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tierLabel(tier, locale) {
  if (locale === "en") {
    if (tier === "reach") return "Reach";
    if (tier === "match") return "Match";
    return "Safety";
  }
  if (tier === "reach") return "冲刺";
  if (tier === "match") return "匹配";
  return "保底";
}

function collectReportSchools(report) {
  const out = [];
  for (const tier of ["reach", "match", "safety"]) {
    for (const row of report[tier] || []) {
      const school = String(row.school || "").trim();
      if (!school) continue;
      const variants = schoolNameLookupVariants(school);
      const matchTokens = [...new Set([school, ...variants])]
        .filter((t) => t.length >= 3)
        .sort((a, b) => b.length - a.length);
      out.push({ school, tier, matchTokens });
    }
  }
  return out;
}

function sameSchool(a, b) {
  return normalizeSchoolNameInput(a).toLowerCase() === normalizeSchoolNameInput(b).toLowerCase();
}

export function findCrossTierSchoolMention(text, currentSchool, schools) {
  const blob = String(text || "");
  if (!blob.trim()) return null;
  for (const entry of schools) {
    if (sameSchool(entry.school, currentSchool)) continue;
    for (const token of entry.matchTokens) {
      if (token.length < 4 && !/^(UNC|USC|NYU|UCLA|UCSD|UCI)$/i.test(token)) continue;
      if (new RegExp(escapeRegExp(token), "i").test(blob)) return entry;
    }
  }
  return null;
}

export function sanitizeCrossTierDifferentiation(text, currentSchool, currentTier, report, locale = "zh") {
  let s = String(text || "").trim();
  if (!s) return s;

  const schools = collectReportSchools(report);
  const mentioned = findCrossTierSchoolMention(s, currentSchool, schools);
  if (!mentioned || mentioned.tier === currentTier) return s;

  const theirLabel = tierLabel(mentioned.tier, locale);

  if (locale === "en") {
    for (const token of mentioned.matchTokens) {
      if (token.length < 4 && !/^(UNC|USC|NYU)$/i.test(token)) continue;
      const esc = escapeRegExp(token);
      s = s.replace(
        new RegExp(
          `(compared?\\s+(?:with|to)|vs\\.?)\\s+other\\s+schools?\\s+in\\s+the\\s+same\\s+tier[^,.;]*?(${esc})`,
          "gi",
        ),
        `Compared with $1 (listed in your ${theirLabel} tier)`,
      );
    }
    s = s.replace(
      /\bother schools in the same tier\b/gi,
      `other schools in your ${theirLabel} tier (not the same list tier as this row)`,
    );
    return s.trim();
  }

  for (const token of mentioned.matchTokens) {
    if (token.length < 4 && !/^(UNC|USC|NYU)$/i.test(token)) continue;
    const esc = escapeRegExp(token);
    s = s.replace(new RegExp(`与同档(的|其它|其他)?\\s*(${esc})`, "gi"), `相较你名单中${theirLabel}档的 $2`);
    s = s.replace(new RegExp(`同档(的|其它|其他)?\\s*(${esc})`, "gi"), `${theirLabel}档的 $2`);
  }

  s = s.replace(/与同档(的|其它|其他)?(?:校|推荐校|学校)?/g, `相较你名单中${theirLabel}档院校`);
  s = s.replace(/其它同档|其他同档/g, `名单中${theirLabel}档`);
  s = s.replace(/同档其它|同档其他/g, `${theirLabel}档`);

  return s.trim();
}

function sanitizeRowTierCopy(row, tier, report, locale) {
  const school = row.school || "";
  const clean = (text) => (text ? sanitizeCrossTierDifferentiation(text, school, tier, report, locale) : text);
  return {
    ...row,
    why_reach_for_you: clean(row.why_reach_for_you),
    why_match_for_you: clean(row.why_match_for_you),
    why_safety_for_you: clean(row.why_safety_for_you),
    differentiation: clean(row.differentiation),
    campus_vibe: clean(row.campus_vibe),
    context_note: clean(row.context_note),
    key_fit_signals: coerceStringArray(row.key_fit_signals).map((x) => clean(x) ?? x),
    key_risks: coerceStringArray(row.key_risks).map((x) => clean(x) ?? x),
    verification_focus: coerceStringArray(row.verification_focus).map((x) => clean(x) ?? x),
  };
}

export function sanitizeReportTierDifferentiation(report, locale = "zh") {
  return {
    ...report,
    reach: (Array.isArray(report.reach) ? report.reach : []).map((r) => sanitizeRowTierCopy(r, "reach", report, locale)),
    match: (Array.isArray(report.match) ? report.match : []).map((r) => sanitizeRowTierCopy(r, "match", report, locale)),
    safety: (Array.isArray(report.safety) ? report.safety : []).map((r) => sanitizeRowTierCopy(r, "safety", report, locale)),
  };
}
