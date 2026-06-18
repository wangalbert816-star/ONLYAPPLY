/**
 * Decision Engine v2 — tier rules, major buckets, school catalog loader.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildEngineIntakeProfile, isUcSchoolName, normalizeSchoolRegion, schoolRegionMatchesPrefs } from "./engineIntakeProfile.mjs";
import { forbiddenSchoolsFromBody, schoolMatchesForbidden } from "./topReferenceSchools.mjs";
import { findAdmitStatsEntry } from "./schoolAdmitStats.mjs";
import { buildStudentStatsProfile, computeSchoolStatsGap, isPrestigeStatsSafetyCandidate, isStableSafetyCandidate } from "./statsTierGap.mjs";
import { majorGuidanceRankAdjust } from "./majorGuidance.mjs";
import { resolveMajorBucket } from "./majorBucket.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = path.join(__dirname, "..", "data", "engine", "school-major-catalog.json");

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

export { resolveMajorBucket } from "./majorBucket.mjs";

export function majorFitForSchool(entry, bucket) {
  const majors = entry.majors ?? {};
  const row = majors[bucket] ?? majors.general ?? majors.default ?? { fit: 55 };
  return Number(row.fit ?? 55);
}

const KNOWN_SCHOOL_TRAITS = [
  { re: /notre dame|byu|brigham|liberty university|pepperdine|baylor|wheaton|calvin|gordon college/i, religious: true },
  { re: /usc|ucla|nyu|boston university|northeastern|george washington|american university/i, urban: true },
  { re: /dartmouth|williams|amherst|middlebury|bowdoin|colby|bates|hamilton|grinnell|carleton|davidson|colgate/i, size: "small" },
  { re: /ohio state|penn state|michigan state|arizona state|texas a&m|purdue|wisconsin|illinois|maryland|washington/i, size: "large" },
  { re: /usc|ucla|michigan|penn state|ohio state|texas at austin|florida|wisconsin|illinois|arizona state/i, party: true },
];

function inferSchoolTraits(entry) {
  const name = String(entry.school ?? "");
  const traits = {
    size: entry.size ?? "medium",
    culture: entry.culture ?? "balanced",
    religious: Boolean(entry.religious),
    urban: Boolean(entry.urban),
    party: Boolean(entry.party),
  };
  for (const row of KNOWN_SCHOOL_TRAITS) {
    if (!row.re.test(name)) continue;
    if (row.religious) traits.religious = true;
    if (row.urban) traits.urban = true;
    if (row.size) traits.size = row.size;
    if (row.party) traits.party = true;
  }
  if (entry.type === "private" && Number(entry.selectivity) >= 90 && traits.size === "medium") {
    traits.size = "medium";
  }
  return traits;
}

function schoolMatchesSizePref(traits, pref) {
  if (!pref || pref === "any") return true;
  if (pref === traits.size) return true;
  if (pref === "small" && traits.size === "medium") return true;
  if (pref === "large" && traits.size === "medium") return true;
  return false;
}

function schoolMatchesCulturePref(traits, pref) {
  if (!pref || pref === "any") return true;
  if (pref === traits.culture) return true;
  if (pref === "collaborative" && traits.culture === "balanced") return true;
  if (pref === "competitive" && traits.culture === "balanced") return true;
  return false;
}

export function buildEngineContext(body, tags = [], profileScores, intakeOverride = null) {
  const intake = intakeOverride ?? buildEngineIntakeProfile(body, tags);
  const composite =
    profileScores?.composite ??
    profileScores?.academic * 0.26 +
      profileScores?.testing * 0.22 +
      profileScores?.activities * 0.2 +
      profileScores?.rigor * 0.18 +
      profileScores?.strategy * 0.14;

  const tagSet = new Set(intake.tags);

  return {
    composite,
    profileScores,
    intake,
    prefs: {
      geo: intake.geo,
      budget: intake.budget,
      dealbreakers: intake.dealbreakers,
      forbidden: intake.forbidden,
      schoolSize: intake.schoolSize,
      campusCulture: intake.campusCulture,
      riskStyle: intake.riskStyle,
    },
    majorBucket: resolveMajorBucket(body),
    budgetSensitive: intake.budgetSensitive,
    budget: intake.budget,
    geo: intake.geo,
    dealbreakers: intake.dealbreakers,
    forbidden: intake.forbidden.length ? intake.forbidden : forbiddenSchoolsFromBody(body),
    schoolSize: intake.schoolSize,
    campusCulture: intake.campusCulture,
    intl: intake.intl,
    testOptional: intake.testOptional,
    testBand: intake.testBand,
    gpaTrend: intake.gpaTrend,
    competitionDensity: intake.competitionDensity,
    athlete: intake.athlete,
    ucIntent: intake.ucIntent,
    weakGpa: composite < 62 || tagSet.has("weak-gpa") || intake.gpaBand === "weak",
    strongStats: composite >= 78 || tagSet.has("strong-stats") || intake.gpaBand === "strong",
    geoPrefs: intake.geo.normalized,
    riskStyle: intake.riskStyle,
    tags: tagSet,
    geoStrict: intake.geoStrict,
    body,
    studentStatsProfile: buildStudentStatsProfile(body),
  };
}

/** @returns {number} positive = school harder than student (reach territory) */
export function tierGap(profileComposite, schoolSelectivity, context, entry) {
  let gap = Number(schoolSelectivity ?? 70) - profileComposite;

  if (context.intl && entry.intlPenalty) gap += Number(entry.intlPenalty);
  if (context.testOptional && entry.testOptionalPenalty) gap += Number(entry.testOptionalPenalty);
  if (!context.testOptional && context.testBand === "weak") gap += 4;
  if (context.gpaTrend === "upward") gap -= 2;
  if (context.gpaTrend === "downward") gap += 3;
  if (context.competitionDensity === "high" && Number(entry.selectivity) >= 85) gap += 2;
  if (context.weakGpa && /uc (irvine|san diego|los angeles|berkeley)/i.test(entry.school)) gap += 6;
  if (context.budgetSensitive && entry.budgetTier === "high" && entry.type === "private") gap += 8;
  if (context.budget?.preferPublic && entry.type === "public" && entry.budgetTier !== "high") gap -= 2;
  if (context.strongStats && entry.type === "public" && Number(entry.selectivity) >= 88) gap -= 2;
  if (context.athlete?.isAthlete && context.athlete.level === "d3" && /liberal arts|college\b/i.test(entry.school)) {
    gap -= 3;
  }

  return gap;
}

export function isSchoolEligible(entry, context) {
  if (schoolMatchesForbidden(entry.school, context.forbidden)) return false;

  const statsEntry = findAdmitStatsEntry(entry.school);
  const regionForGeo = statsEntry?.region ?? entry.region;
  if (context.geoStrict && !schoolRegionMatchesPrefs(regionForGeo, context.geo)) {
    return false;
  }

  const traits = inferSchoolTraits(entry);

  if (context.dealbreakers?.themes.includes("no_religious") && traits.religious) return false;
  if (context.dealbreakers?.themes.includes("avoid_major_city") && traits.urban) return false;
  if (context.dealbreakers?.themes.includes("avoid_rural") && traits.size === "small" && !traits.urban) {
    return false;
  }

  if (!context.ucIntent && isUcSchoolName(entry.school)) {
    return false;
  }

  const budget = context.budget ?? {};
  if (!budget.allowHighPrivate && entry.budgetTier === "high" && entry.type === "private") {
    return false;
  }
  if (budget.tier === "strict" && entry.budgetTier === "high" && entry.type === "private") {
    return false;
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

  if (gap >= 7 && gap <= 28) return "reach";
  if (gap >= -7 && gap <= 10) return "match";
  if (gap <= -3 && selectivity <= 78) return "safety";
  return null;
}

export function geoBoost(entry, context) {
  const region = normalizeSchoolRegion(entry.region ?? "any") ?? String(entry.region ?? "any").toLowerCase();
  if (context.geoStrict) {
    return schoolRegionMatchesPrefs(region, context.geo) ? 0.25 : -0.2;
  }
  if (!context.geoPrefs.length || context.geo.includesAny) return 0;
  if (region === "any") return 0.05;
  for (const pref of context.geoPrefs) {
    const normalized = String(pref).toLowerCase();
    if (region === normalized) return 0.18;
    if (region === "great_lakes" && normalized === "midwest") return 0.18;
    if (region === "midwest" && normalized === "great_lakes") return 0.18;
  }
  return -0.06;
}

export function rankCandidate(entry, context, gap, tier) {
  const fit = majorFitForSchool(entry, context.majorBucket);
  const traits = inferSchoolTraits(entry);
  const tierFit =
    tier === "reach"
      ? clamp01(1 - Math.abs(gap - 16) / 18)
      : tier === "match"
        ? clamp01(1 - Math.abs(gap - 2) / 12)
        : clamp01(1 - Math.abs(gap + 8) / 14);

  let budgetBoost = 0;
  if (context.budget?.preferPublic && entry.type === "public") budgetBoost = 0.08;
  if (context.budget?.tier === "strict" && entry.budgetTier === "low") budgetBoost += 0.06;

  let prefBoost = 0;
  if (schoolMatchesSizePref(traits, context.schoolSize)) prefBoost += 0.06;
  if (schoolMatchesCulturePref(traits, context.campusCulture)) prefBoost += 0.05;
  if (context.dealbreakers?.themes.includes("no_party") && traits.party) prefBoost -= 0.12;
  if (context.dealbreakers?.themes.includes("avoid_cold") && /midwest|northeast|new england|wisconsin|michigan|minnesota/i.test(entry.school)) {
    prefBoost -= 0.08;
  }

  return fit * 0.4 + tierFit * 100 * 0.32 + geoBoost(entry, context) * 100 + budgetBoost * 100 + prefBoost * 100 + (entry.engineBoost ?? 0);
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

export function pickTopPerTier(candidates, tier, count = 3, context = null) {
  if (tier === "safety") return pickSafetyWithBandSpread(candidates, count, context);
  return pickTopPerTierPlain(candidates, tier, count, context);
}

/**
 * Safety portfolio: prefer 2+ stable/high-admit schools; at most 1 selective "stats-only" safety.
 */
export function pickSafetyWithBandSpread(candidates, count = 3, context = null) {
  const rows = candidates
    .filter((c) => c.tier === "safety")
    .sort((a, b) => b.rank - a.rank || b.fit - a.fit || a.entry.school.localeCompare(b.entry.school));

  const stable = rows.filter(isStableSafetyCandidate);
  const moderate = rows.filter((c) => !isStableSafetyCandidate(c) && !isPrestigeStatsSafetyCandidate(c));
  const prestige = rows.filter(isPrestigeStatsSafetyCandidate);

  const picked = [];
  const seen = new Set();

  const push = (row) => {
    const key = normalizeSchoolKey(row.entry.school);
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(row);
  };

  const targetStable = Math.min(2, count, stable.length);
  for (const row of stable.slice(0, targetStable)) push(row);

  let prestigeUsed = picked.some(isPrestigeStatsSafetyCandidate);
  for (const row of moderate) {
    if (picked.length >= count) break;
    push(row);
  }
  for (const row of prestige) {
    if (picked.length >= count) break;
    if (prestigeUsed) continue;
    push(row);
    prestigeUsed = true;
  }
  for (const row of stable) {
    if (picked.length >= count) break;
    push(row);
  }
  for (const row of rows) {
    if (picked.length >= count) break;
    push(row);
  }

  return picked.slice(0, count);
}

function pickTopPerTierPlain(candidates, tier, count = 3, context = null) {
  const rows = candidates
    .filter((c) => c.tier === tier)
    .sort((a, b) => b.rank - a.rank || b.fit - a.fit || a.entry.school.localeCompare(b.entry.school));

  const picked = [];
  const seenRegions = new Set();
  const diversify = !context?.geoStrict;

  for (const row of rows) {
    if (picked.length >= count) break;
    const region = String(row.entry.region ?? "any");
    if (diversify && picked.length < count - 1 && seenRegions.has(region) && rows.length > count) continue;
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

export function formatSchoolNote(entry, context, tier, gap, statsGap = null) {
  const fit = majorFitForSchool(entry, context.majorBucket);
  const bits = [];
  if (entry.notes) bits.push(entry.notes);
  if (fit >= 85) bits.push(`${context.majorBucket} 专业匹配`);
  if (context.budgetSensitive && entry.type === "public") bits.push("预算友好公立");
  if (context.geoStrict && schoolRegionMatchesPrefs(entry.region, context.geo)) bits.push("符合地理偏好");
  if (context.intl && entry.intlFriendly) bits.push("国际生路径较常见");
  if (tier === "reach" && gap >= 18) bits.push("现实可冲");
  if (statsGap?.flags?.includes("missing_required_testing")) bits.push("缺标化—Required校");
  if (statsGap?.testPolicy === "test_blind") bits.push("test-blind");
  if (statsGap?.flags?.includes("major_selective")) bits.push("专业 selective");
  if (statsGap?.flags?.includes("major_indirect")) bits.push("专业 indirect");
  if (statsGap?.flags?.includes("major_direct")) bits.push("专业可直申");
  return bits.filter(Boolean).slice(0, 3).join("；") || null;
}

/**
 * Build ranked candidates from catalog under current context (geoStrict from context).
 */
export function buildCatalogCandidates(catalog, composite, context) {
  const student = context.studentStatsProfile ?? buildStudentStatsProfile(context.body);
  const candidates = [];
  for (const entry of catalog) {
    if (!isSchoolEligible(entry, context)) continue;
    const statsEntry = findAdmitStatsEntry(entry.school);
    const effectiveEntry =
      statsEntry?.region != null
        ? { ...entry, region: statsEntry.region }
        : entry;
    let gap = tierGap(composite, entry.selectivity, context, effectiveEntry);
    let statsGap = null;
    if (statsEntry) {
      statsGap = computeSchoolStatsGap(student, statsEntry, context.majorBucket);
      gap = statsGap.engineGap;
    }
    const selectivity = statsEntry?.selectivity ?? entry.selectivity;
    let tier = classifySchoolTier({ ...effectiveEntry, selectivity }, context, gap);
    if (statsGap?.effectiveTier) {
      tier = statsGap.effectiveTier;
    }
    if (!tier) continue;
    const fit = majorFitForSchool(entry, context.majorBucket);
    let rank = rankCandidate(effectiveEntry, context, gap, tier);
    if (!statsEntry) rank -= 35;
    if (statsGap?.priorityPenalty) rank -= statsGap.priorityPenalty;
    if (statsEntry) rank += 8;
    if (statsEntry) rank += majorGuidanceRankAdjust(statsEntry, context.majorBucket);
    if (tier === "safety" && isStableSafetyCandidate({ statsEntry, statsGap, entry })) rank += 22;
    if (tier === "safety" && isPrestigeStatsSafetyCandidate({ statsEntry, statsGap, entry })) rank -= 28;
    if (tier === "match" && statsGap?.flags?.includes("cap_prestige_stats_safety")) rank += 12;
    candidates.push({
      entry: effectiveEntry,
      gap,
      tier,
      fit,
      rank,
      statsGap,
      statsEntry,
    });
  }
  return candidates;
}

export function pickSchoolsFromCandidates(candidates, context) {
  const reachRows = pickTopPerTier(candidates, "reach", 3, context);
  const matchRows = pickTopPerTier(candidates, "match", 3, context);
  const safetyRows = pickTopPerTier(candidates, "safety", 3, context);
  return { reachRows, matchRows, safetyRows };
}
