import type { ReportPayload, SchoolRow, SchoolTier } from "../types";
import type { Locale } from "../i18n/strings";
import { normalizeSchoolNameInput, schoolNameLookupVariants } from "./schoolNameResolve";

type SchoolTierEntry = {
  school: string;
  tier: SchoolTier;
  matchTokens: string[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tierLabel(tier: SchoolTier, locale: Locale): string {
  if (locale === "en") {
    if (tier === "reach") return "Reach";
    if (tier === "match") return "Match";
    return "Safety";
  }
  if (tier === "reach") return "冲刺";
  if (tier === "match") return "匹配";
  return "保底";
}

function collectReportSchools(report: ReportPayload): SchoolTierEntry[] {
  const out: SchoolTierEntry[] = [];
  for (const tier of ["reach", "match", "safety"] as const) {
    for (const row of report[tier] ?? []) {
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

function sameSchool(a: string, b: string): boolean {
  return normalizeSchoolNameInput(a).toLowerCase() === normalizeSchoolNameInput(b).toLowerCase();
}

/** 在文案中找「名单里另一所学校」的首次命中（最长 token 优先） */
export function findCrossTierSchoolMention(
  text: string,
  currentSchool: string,
  schools: SchoolTierEntry[],
): SchoolTierEntry | null {
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

/** 修正 differentiation / why 中「跨档学校却写同档」的矛盾表述 */
export function sanitizeCrossTierDifferentiation(
  text: string,
  currentSchool: string,
  currentTier: SchoolTier,
  report: ReportPayload,
  locale: Locale = "zh",
): string {
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
      s = s.replace(
        new RegExp(`same-tier\\s+(?:schools?|peers?)[^,.;]*?(${esc})`, "gi"),
        `schools in your ${theirLabel} tier such as $1`,
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

function sanitizeRowTierCopy(
  row: SchoolRow,
  tier: SchoolTier,
  report: ReportPayload,
  locale: Locale,
): SchoolRow {
  const school = row.school || "";
  const clean = (text: string | undefined) =>
    text ? sanitizeCrossTierDifferentiation(text, school, tier, report, locale) : text;

  return {
    ...row,
    why_reach_for_you: clean(row.why_reach_for_you),
    why_match_for_you: clean(row.why_match_for_you),
    why_safety_for_you: clean(row.why_safety_for_you),
    differentiation: clean(row.differentiation),
    campus_vibe: clean(row.campus_vibe),
    context_note: clean(row.context_note),
    key_fit_signals: (row.key_fit_signals ?? []).map((x) => clean(x) ?? x),
    key_risks: (row.key_risks ?? []).map((x) => clean(x) ?? x),
    verification_focus: (row.verification_focus ?? []).map((x) => clean(x) ?? x),
  };
}

/** 全报告：修正主名单 9 校跨档「同档」矛盾 */
export function sanitizeReportTierDifferentiation(report: ReportPayload, locale: Locale): ReportPayload {
  const reach = (report.reach ?? []).map((r) => sanitizeRowTierCopy(r, "reach", report, locale));
  const match = (report.match ?? []).map((r) => sanitizeRowTierCopy(r, "match", report, locale));
  const safety = (report.safety ?? []).map((r) => sanitizeRowTierCopy(r, "safety", report, locale));
  return { ...report, reach, match, safety };
}
