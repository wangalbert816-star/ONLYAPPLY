/**
 * Decision Engine v2 — preferences-first catalog + optional AI gap fill.
 */

import { profileCompositeScore, scoreFiveDimensions } from "./fiveDimensionScore.mjs";
import {
  buildCatalogCandidates,
  buildEngineContext,
  formatSchoolNote,
  listSchoolMajorCatalog,
  pickSchoolsFromCandidates,
} from "./engineTierRules.mjs";
import { normalizeApprovedSchools } from "./engineStandards.mjs";
import { computeTierGaps } from "./decisionEngineAiFill.mjs";

export const BENCHMARK_STRONG_SCORE = 10;

function buildSchoolsFromCandidates(reachRows, matchRows, safetyRows, context, modeLabel) {
  const toTier = (rows, tier) =>
    rows.map(({ entry, gap }) => {
      const note = formatSchoolNote(entry, context, tier, gap);
      return note ? { school: entry.school, note } : { school: entry.school };
    });

  const geoNote = context.geoStrict
    ? ` · 地理 ${context.geo.allowed.join("/")}`
    : "";
  const budgetNote = context.budget?.budgetSensitive ? " · 预算敏感" : "";

  return normalizeApprovedSchools({
    reach: toTier(reachRows, "reach"),
    match: toTier(matchRows, "match"),
    safety: toTier(safetyRows, "safety"),
    notes: `引擎 v2${modeLabel}：composite ${Math.round(context.composite)} · ${context.majorBucket}${geoNote}${budgetNote}`,
  });
}

function resultFromPick(body, tags, context, reachRows, matchRows, safetyRows, modeLabel, catalogMode) {
  const gaps = computeTierGaps(reachRows, matchRows, safetyRows);
  const complete = gaps.reach === 0 && gaps.match === 0 && gaps.safety === 0;
  const schools = complete
    ? buildSchoolsFromCandidates(reachRows, matchRows, safetyRows, context, modeLabel)
    : normalizeApprovedSchools({
        reach: reachRows.map(({ entry, gap }) => ({
          school: entry.school,
          note: formatSchoolNote(entry, context, "reach", gap) ?? undefined,
        })),
        match: matchRows.map(({ entry, gap }) => ({
          school: entry.school,
          note: formatSchoolNote(entry, context, "match", gap) ?? undefined,
        })),
        safety: safetyRows.map(({ entry, gap }) => ({
          school: entry.school,
          note: formatSchoolNote(entry, context, "safety", gap) ?? undefined,
        })),
      });

  return {
    ok: complete,
    reason: complete ? null : "incomplete_tiers",
    schools,
    gaps,
    profileScores: context.profileScores,
    composite: context.composite,
    majorBucket: context.majorBucket,
    context,
    catalogMode,
    tierCounts: {
      reach: reachRows.length,
      match: matchRows.length,
      safety: safetyRows.length,
    },
    candidateCount: reachRows.length + matchRows.length + safetyRows.length,
    reachRows,
    matchRows,
    safetyRows,
  };
}

/**
 * Run catalog pick with preference strictness.
 * @param {Record<string, unknown>} body
 * @param {string[]} tags
 * @param {{ geoStrict?: boolean }} [options]
 */
export function runDecisionEngineV2Catalog(body, tags = [], options = {}) {
  const profileScores = options.calibratedProfileScores ?? scoreFiveDimensions(body);
  const composite = profileCompositeScore(profileScores);
  const baseContext = buildEngineContext(body, tags, { ...profileScores, composite });
  const geoStrict = options.geoStrict ?? baseContext.geoStrict;
  const context = { ...baseContext, geoStrict, profileScores, composite };

  const catalog = listSchoolMajorCatalog();
  if (!catalog.length) {
    return { ok: false, reason: "catalog_empty", context, profileScores, composite };
  }

  const candidates = buildCatalogCandidates(catalog, composite, context);
  const { reachRows, matchRows, safetyRows } = pickSchoolsFromCandidates(candidates, context);
  const modeLabel = geoStrict ? "（偏好优先）" : "（放宽地理）";

  return resultFromPick(body, tags, context, reachRows, matchRows, safetyRows, modeLabel, geoStrict ? "strict" : "relaxed");
}

/**
 * @param {Record<string, unknown>} body
 * @param {string[]} tags
 * @param {{ allowRelaxedGeo?: boolean }} [options]
 */
export function runDecisionEngineV2(body, tags = [], options = {}) {
  const strict = runDecisionEngineV2Catalog(body, tags, { geoStrict: true });
  if (strict.ok) {
    return finalizeV2Ok(strict, "scored");
  }

  if (options.allowRelaxedGeo) {
    const relaxed = runDecisionEngineV2Catalog(body, tags, { geoStrict: false });
    if (relaxed.ok) {
      return finalizeV2Ok(relaxed, "scored_relaxed_geo");
    }
    return { ...relaxed, strictAttempt: strict };
  }

  return strict;
}

function finalizeV2Ok(pick, mode) {
  const { reachRows, matchRows, safetyRows, context, schools } = pick;
  return {
    ok: true,
    source: "scored",
    mode,
    benchmarkId: null,
    benchmarkTitle: `五维算分 · ${context.majorBucket}`,
    matchScore: null,
    schools,
    notes: schools.notes,
    profile: {
      majorBucket: context.majorBucket,
      composite: Math.round(context.composite * 10) / 10,
      scores: context.profileScores,
      rules: {
        budgetSensitive: context.budgetSensitive,
        geoStrict: context.geoStrict,
        geoAllowed: context.geo.allowed,
        intl: context.intl,
        testOptional: context.testOptional,
        riskStyle: context.riskStyle || "balanced",
        dealbreakers: context.dealbreakers.themes,
      },
    },
    v2Meta: {
      candidateCount: pick.candidateCount,
      catalogMode: pick.catalogMode,
      reachGap: reachRows.map((r) => Math.round(r.gap * 10) / 10),
      matchGap: matchRows.map((r) => Math.round(r.gap * 10) / 10),
      safetyGap: safetyRows.map((r) => Math.round(r.gap * 10) / 10),
    },
  };
}

/** Partial pick for AI gap fill merge. */
export function runDecisionEngineV2Partial(body, tags = []) {
  const strict = runDecisionEngineV2Catalog(body, tags, { geoStrict: true });
  if (strict.ok) return { partial: strict, gaps: null };

  const relaxed = runDecisionEngineV2Catalog(body, tags, { geoStrict: false });
  const base = relaxed.tierCounts.reach + relaxed.tierCounts.match + relaxed.tierCounts.safety >
    strict.tierCounts.reach + strict.tierCounts.match + strict.tierCounts.safety
    ? relaxed
    : strict;

  return { partial: base, gaps: base.gaps };
}
