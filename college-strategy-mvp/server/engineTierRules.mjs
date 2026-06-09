/**
 * Decision Engine v2 — tier rules, major buckets, school catalog loader.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forbiddenSchoolsFromBody, isUltraSelectiveSchoolName, schoolMatchesForbidden } from "./topReferenceSchools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = path.join(__dirname, "..", "data", "engine", "school-major-catalog.json");

const MAJOR_BUCKET_PATTERNS = [
  ["cs", /computer science|\bcs\b|software|data science|artificial intelligence|\bai\b|computational|informatics/i],
  ["business", /business|entrepreneurship|finance|economics|accounting|marketing|management|\bmba\b/i],
  ["bio", /biology|\bbio\b|pre-?med|medicine|public health|biomedical|neuroscience|biochem/i],
  ["engineering", /engineering|mechanical|electrical|civil|aerospace|chemical eng|industrial eng/i],
  ["arts", /film|media studies|art\b|design|music|theater|architecture|fine arts|animation/i],
  ["social", /psychology|sociology|political|history|philosophy|anthropology|international relations/i],
  ["environmental", /environmental|sustainability|ecology|climate|earth science/i],
];

let catalogCache = null;

function readCatalogFile() {
  if (catalogCache) return catalogCache;
  if (!fs.existsSync(CATALOG_FILE)) {
    catalogCache = [];
    return catalogCache;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
    catalogCache = Array.isArray(raw) ? raw : [];
  } catch {
    catalogCache = [];
  }
  return catalogCache;
}

export function listSchoolMajorCatalog() {
  return readCatalogFile();
}

export function normalizeSchoolKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function schoolMatchesCatalogEntry(name, entry) {
  const key = normalizeSchoolKey(name);
  if (!key) return false;
  const primary = normalizeSchoolKey(entry.school);
  if (key === primary) return true;
  if (primary.length >= 4 && key.includes(primary)) return true;
  if (key.length >= 4 && primary.includes(key)) return true;
  for (const alias of entry.aliases ?? []) {
    const a = normalizeSchoolKey(alias);
    if (!a) continue;
    if (key === a) return true;
    if (a.length >= 4 && key.includes(a)) return true;
  }
  return false;
}

export function resolveMajorBucket(body) {
  const text = [body?.majorPrimary, body?.majorSecondary, ...(body?.tags ?? [])].filter(Boolean).join(" ");
  for (const [bucket, re] of MAJOR_BUCKET_PATTERNS) {
    if (re.test(text)) return bucket;
  }
  return "general";
}

export function majorFitForSchool(entry, bucket) {
  const majors = entry.majors ?? {};
  const row = majors[bucket] ?? majors.general ?? majors.default ?? { fit: 55 };
  return Number(row.fit ?? 55);
}

export function buildEngineContext(body, tags = [], profileScores) {
  const composite =
    profileScores?.composite ??
    profileScores?.academic * 0.26 +
      profileScores?.testing * 0.22 +
      profileScores?.activities * 0.2 +
      profileScores?.rigor * 0.18 +
      profileScores?.strategy * 0.14;

  const budget = String(body?.budget ?? "").trim().toLowerCase();
  const applicantIdentity = String(body?.applicantIdentity ?? "").trim().toLowerCase();
  const testing = String(body?.testing ?? "").trim().toLowerCase();
  const geoPrefs = Array.isArray(body?.geoPrefs) ? body.geoPrefs.map((g) => String(g).toLowerCase()) : [];
  const dealbreakers = String(body?.dealbreakers ?? "").trim().toLowerCase();
  const tagSet = new Set((tags ?? []).map((t) => String(t).toLowerCase()));

  return {
    composite,
    profileScores,
    majorBucket: resolveMajorBucket(body),
    budgetSensitive: /budget|cap|limited|有限|预算|费用|afford|need_aid|financial/i.test(`${budget} ${dealbreakers}`),
    intl: applicantIdentity === "intl" || tagSet.has("intl"),
    testOptional: testing === "test_optional" || tagSet.has("test-optional"),
    weakGpa: composite < 62 || tagSet.has("weak-gpa"),
    strongStats: composite >= 78 || tagSet.has("strong-stats"),
    forbidden: forbiddenSchoolsFromBody(body),
    geoPrefs,
    riskStyle: String(body?.riskStyle ?? "").trim().toLowerCase(),
    tags: tagSet,
  };
}

/** @returns {number} positive = school harder than student (reach territory) */
export function tierGap(profileComposite, schoolSelectivity, context, entry) {
  let gap = Number(schoolSelectivity ?? 70) - profileComposite;

  if (context.intl && entry.intlPenalty) gap += Number(entry.intlPenalty);
  if (context.testOptional && entry.testOptionalPenalty) gap += Number(entry.testOptionalPenalty);
  if (context.weakGpa && /uc (irvine|san diego|los angeles|berkeley)/i.test(entry.school)) gap += 6;
  if (context.budgetSensitive && entry.budgetTier === "high" && entry.type === "private") gap += 8;
  if (context.strongStats && entry.type === "public" && Number(entry.selectivity) >= 88) gap -= 2;

  return gap;
}

export function isSchoolEligible(entry, context) {
  if (schoolMatchesForbidden(entry.school, context.forbidden)) return false;

  if (isUltraSelectiveSchoolName(entry.school) && context.composite < 78 && !context.strongStats) {
    return false;
  }

  if (context.budgetSensitive) {
    if (entry.budgetTier === "high" && entry.type === "private") return false;
  }

  const fit = majorFitForSchool(entry, context.majorBucket);
  if (fit < 40) return false;

  return true;
}

/** @returns {"reach"|"match"|"safety"|null} */
export function classifySchoolTier(entry, context, gap) {
  const selectivity = Number(entry.selectivity ?? 70);
  const fit = majorFitForSchool(entry, context.majorBucket);

  if (fit < 45) return null;

  if (context.riskStyle === "conservative") {
    if (gap >= 14) return "reach";
    if (gap >= -2 && gap <= 8) return "match";
    if (gap <= 0 && selectivity <= 76) return "safety";
    return null;
  }

  if (context.riskStyle === "aggressive") {
    if (gap >= 4 && gap <= 32) return "reach";
    if (gap >= -10 && gap <= 12) return "match";
    if (gap <= 2 && selectivity <= 82) return "safety";
    return null;
  }

  // balanced default
  if (gap >= 7 && gap <= 28) return "reach";
  if (gap >= -7 && gap <= 10) return "match";
  if (gap <= -3 && selectivity <= 78) return "safety";
  return null;
}

export function geoBoost(entry, context) {
  const region = String(entry.region ?? "any").toLowerCase();
  if (!context.geoPrefs.length || context.geoPrefs.includes("any")) return 0;
  if (region === "any") return 0.05;
  if (context.geoPrefs.includes(region)) return 0.18;
  return -0.06;
}

export function rankCandidate(entry, context, gap, tier) {
  const fit = majorFitForSchool(entry, context.majorBucket);
  const tierFit =
    tier === "reach"
      ? clamp01(1 - Math.abs(gap - 16) / 18)
      : tier === "match"
        ? clamp01(1 - Math.abs(gap - 2) / 12)
        : clamp01(1 - Math.abs(gap + 8) / 14);

  return fit * 0.42 + tierFit * 100 * 0.35 + geoBoost(entry, context) * 100 + (entry.engineBoost ?? 0);
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

export function pickTopPerTier(candidates, tier, count = 3) {
  const rows = candidates
    .filter((c) => c.tier === tier)
    .sort((a, b) => b.rank - a.rank || b.fit - a.fit || a.entry.school.localeCompare(b.entry.school));

  const picked = [];
  const seenRegions = new Set();
  for (const row of rows) {
    if (picked.length >= count) break;
    const region = String(row.entry.region ?? "any");
    if (picked.length < count - 1 && seenRegions.has(region) && rows.length > count) continue;
    picked.push(row);
    seenRegions.add(region);
  }
  for (const row of rows) {
    if (picked.length >= count) break;
    if (picked.some((p) => normalizeSchoolKey(p.entry.school) === normalizeSchoolKey(row.entry.school))) continue;
    picked.push(row);
  }
  return picked.slice(0, count);
}

export function formatSchoolNote(entry, context, tier, gap) {
  const fit = majorFitForSchool(entry, context.majorBucket);
  const bits = [];
  if (entry.notes) bits.push(entry.notes);
  if (fit >= 85) bits.push(`${context.majorBucket} 专业匹配`);
  if (context.budgetSensitive && entry.type === "public") bits.push("预算友好公立");
  if (context.intl && entry.intlFriendly) bits.push("国际生路径较常见");
  if (tier === "reach" && gap >= 18) bits.push("现实可冲");
  return bits.filter(Boolean).slice(0, 2).join("；") || null;
}
