/**
 * Decision Engine v2 — five-dimension scoring + school×major catalog + tier rules.
 * Covers profiles without an exact counselor benchmark match.
 */

import { profileCompositeScore, scoreFiveDimensions } from "./fiveDimensionScore.mjs";
import {
  buildEngineContext,
  classifySchoolTier,
  formatSchoolNote,
  isSchoolEligible,
  listSchoolMajorCatalog,
  majorFitForSchool,
  pickTopPerTier,
  rankCandidate,
  tierGap,
} from "./engineTierRules.mjs";
import { normalizeApprovedSchools } from "./engineStandards.mjs";

const BENCHMARK_STRONG_SCORE = 10;

function buildSchoolsFromCandidates(reachRows, matchRows, safetyRows, context) {
  const toTier = (rows, tier) =>
    rows.map(({ entry, gap }) => {
      const note = formatSchoolNote(entry, context, tier, gap);
      return note ? { school: entry.school, note } : { school: entry.school };
    });

  return normalizeApprovedSchools({
    reach: toTier(reachRows, "reach"),
    match: toTier(matchRows, "match"),
    safety: toTier(safetyRows, "safety"),
    notes: `引擎 v2：五维 composite ${Math.round(context.composite)} · 专业 ${context.majorBucket}`,
  });
}

/**
 * @param {Record<string, unknown>} body
 * @param {string[]} [tags]
 */
export function runDecisionEngineV2(body, tags = []) {
  const profileScores = scoreFiveDimensions(body);
  const composite = profileCompositeScore(profileScores);
  const context = buildEngineContext(body, tags, { ...profileScores, composite });
  const catalog = listSchoolMajorCatalog();

  if (!catalog.length) {
    return { ok: false, reason: "catalog_empty" };
  }

  const candidates = [];
  for (const entry of catalog) {
    if (!isSchoolEligible(entry, context)) continue;
    const gap = tierGap(composite, entry.selectivity, context, entry);
    const tier = classifySchoolTier(entry, context, gap);
    if (!tier) continue;
    const fit = majorFitForSchool(entry, context.majorBucket);
    candidates.push({
      entry,
      gap,
      tier,
      fit,
      rank: rankCandidate(entry, context, gap, tier),
    });
  }

  const reachRows = pickTopPerTier(candidates, "reach", 3);
  const matchRows = pickTopPerTier(candidates, "match", 3);
  const safetyRows = pickTopPerTier(candidates, "safety", 3);

  if (reachRows.length < 3 || matchRows.length < 3 || safetyRows.length < 3) {
    return {
      ok: false,
      reason: "incomplete_tiers",
      profileScores,
      composite,
      majorBucket: context.majorBucket,
      tierCounts: {
        reach: reachRows.length,
        match: matchRows.length,
        safety: safetyRows.length,
      },
      candidateCount: candidates.length,
    };
  }

  const schools = buildSchoolsFromCandidates(reachRows, matchRows, safetyRows, context);

  return {
    ok: true,
    source: "scored",
    mode: "scored",
    benchmarkId: null,
    benchmarkTitle: `五维算分 · ${context.majorBucket}`,
    matchScore: null,
    schools,
    notes: schools.notes,
    profile: {
      majorBucket: context.majorBucket,
      composite: Math.round(composite * 10) / 10,
      scores: profileScores,
      rules: {
        budgetSensitive: context.budgetSensitive,
        intl: context.intl,
        testOptional: context.testOptional,
        riskStyle: context.riskStyle || "balanced",
      },
    },
    v2Meta: {
      candidateCount: candidates.length,
      reachGap: reachRows.map((r) => Math.round(r.gap * 10) / 10),
      matchGap: matchRows.map((r) => Math.round(r.gap * 10) / 10),
      safetyGap: safetyRows.map((r) => Math.round(r.gap * 10) / 10),
    },
  };
}

export { BENCHMARK_STRONG_SCORE };
