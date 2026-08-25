/**
 * Per-school stats gap vs student profile (2026 official admit stats).
 */

import { applyMajorGuidanceToStatsGap } from "./majorGuidance.mjs";
import { resolveGpaNumbersFromBody } from "./transcriptSheetReport.mjs";

const INTL_SAT_OFFSET = 20;
const INTL_ACT_OFFSET = 1;
const INTL_GPA_OFFSET = 0.05;
const CMU_CS_SAT_STRICT = 15;
const SAT_ENGINE_DIVISOR = 4.5;
const ACT_ENGINE_WEIGHT = 2.2;
const BELOW_TESTING_BAND_ENGINE_GAP = 80 / SAT_ENGINE_DIVISOR;
const ABOVE_TESTING_BAND_ENGINE_GAP = -40 / SAT_ENGINE_DIVISOR;
const CS_MAJOR_RE =
  /computer science|\bcs\b|software|data science|artificial intelligence|\bai\b|computational|informatics/i;

export function isCsMajor(majorPrimary) {
  return CS_MAJOR_RE.test(String(majorPrimary ?? ""));
}

export function buildStudentStatsProfile(body) {
  const b = body && typeof body === "object" ? body : {};
  const testing = String(b.testing ?? "").trim().toLowerCase();
  const satDigits = String(b.satScore ?? "").replace(/\D/g, "");
  const actDigits = String(b.actScore ?? "").replace(/\D/g, "");
  const sat = satDigits.length >= 3 ? Number(satDigits.slice(0, 4)) : null;
  const act = actDigits.length >= 1 ? Number(actDigits.slice(0, 2)) : null;
  const satOk = sat != null && sat >= 400 && sat <= 1600;
  const actOk = act != null && act >= 10 && act <= 36;

  const { unweighted, weighted } = resolveGpaNumbersFromBody(b);
  const uwGpa = unweighted ?? null;
  const wGpa = weighted ?? null;

  const hasSubmittedTesting =
    testing === "will_submit" && ((satOk && sat != null) || (actOk && act != null));
  const testOptionalNoScore =
    (testing === "test_optional" || testing === "will_submit") && !hasSubmittedTesting;

  const applicantIdentity = String(b.applicantIdentity ?? "").trim().toLowerCase();
  const intl =
    applicantIdentity === "intl" ||
    (Array.isArray(b.tags) && b.tags.some((t) => String(t).toLowerCase() === "intl"));

  return {
    uwGpa,
    wGpa,
    sat: satOk ? sat : null,
    act: actOk ? act : null,
    hasSubmittedTesting,
    testOptionalNoScore,
    testing,
    intl,
    majorPrimary: String(b.majorPrimary ?? "").trim(),
    isCsMajor: isCsMajor(b.majorPrimary),
  };
}

export function effectiveTestPolicy(statsEntry, student) {
  if (!statsEntry) return "unknown";
  if (statsEntry.testPolicy === "test_blind") return "test_blind";
  if (statsEntry.testPolicyCs === "required" && student.isCsMajor) return "required";
  return statsEntry.testPolicyDefault ?? statsEntry.testPolicy ?? "optional";
}

function pickBestTestingGap(satGap, actGap) {
  const candidates = [];
  if (satGap != null) {
    candidates.push({
      source: "sat",
      engineContribution: satGap / SAT_ENGINE_DIVISOR,
    });
  }
  if (actGap != null) {
    candidates.push({
      source: "act",
      engineContribution: actGap * ACT_ENGINE_WEIGHT,
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.engineContribution - b.engineContribution);
  const best = candidates[0];
  return {
    ...best,
    // SAT-equivalent gap used by legacy block/flag thresholds.
    thresholdGap: best.engineContribution * SAT_ENGINE_DIVISOR,
  };
}

/** Positive gap = student below school band (harder / reach-ward). */
export function computeSchoolStatsGap(student, statsEntry, majorBucket = "default") {
  if (!statsEntry) return null;

  const policy = effectiveTestPolicy(statsEntry, student);
  const flags = [];
  let priorityPenalty = 0;

  if (policy === "required" && !student.hasSubmittedTesting) {
    flags.push("missing_required_testing");
    priorityPenalty += 18;
  }

  let satGap = null;
  let actGap = null;
  let gpaGap = null;
  let testingCompared = false;

  const canCompareTesting =
    policy !== "test_blind" && !(student.testOptionalNoScore && policy !== "required");

  if (canCompareTesting) {
    if (student.sat != null && statsEntry.satCompositeMid != null) {
      satGap = statsEntry.satCompositeMid - student.sat;
      testingCompared = true;
    }
    if (student.act != null && statsEntry.actMid != null) {
      actGap = statsEntry.actMid - student.act;
      testingCompared = true;
    }
  }

  if (statsEntry.gpaPublished && student.uwGpa != null && statsEntry.gpaUwMid != null) {
    gpaGap = statsEntry.gpaUwMid - student.uwGpa;
  }

  if (student.intl) {
    if (satGap != null) satGap += INTL_SAT_OFFSET;
    if (actGap != null) actGap += INTL_ACT_OFFSET;
    if (gpaGap != null) gpaGap += INTL_GPA_OFFSET;
    flags.push("intl_stricter");
  }

  if (statsEntry.testPolicyCs === "required" && student.isCsMajor && satGap != null) {
    satGap += CMU_CS_SAT_STRICT;
    flags.push("cmu_cs_strict");
  }

  const testingGap = pickBestTestingGap(satGap, actGap);

  let engineGap = 6;
  if (testingGap != null) engineGap += testingGap.engineContribution;
  if (gpaGap != null) engineGap += gpaGap * 22;

  if (!testingCompared && gpaGap == null && statsEntry.selectivity != null) {
    engineGap = statsEntry.selectivity / 4 - 12;
  }

  if (testingGap != null && testingGap.engineContribution >= BELOW_TESTING_BAND_ENGINE_GAP) {
    flags.push("below_sat_band");
  }
  if (gpaGap != null && gpaGap >= 0.3) flags.push("below_gpa_band");
  if (
    testingGap != null &&
    testingGap.engineContribution <= ABOVE_TESTING_BAND_ENGINE_GAP &&
    (gpaGap == null || gpaGap <= 0)
  ) {
    flags.push("above_testing_band");
  }

  const suggestedTier = suggestTierFromEngineGap(engineGap, flags);
  const effectiveTier = computeEffectiveTier({
    engineGap,
    flags,
    suggestedTier,
    statsEntry,
    gpaGap,
    policy,
  });

  const safetyBand = classifySafetyBand(statsEntry, effectiveTier, flags, gpaGap);

  const base = {
    engineGap: Math.round(engineGap * 10) / 10,
    satGap,
    actGap,
    testingGap: testingGap?.thresholdGap ?? null,
    testingGapSource: testingGap?.source ?? null,
    gpaGap,
    flags,
    priorityPenalty,
    suggestedTier,
    effectiveTier,
    safetyBand,
    testingCompared,
    testPolicy: policy,
    gpaPublished: statsEntry.gpaPublished,
    blocksMatch: statsGapBlocksMatch(testingGap?.thresholdGap ?? null, gpaGap),
    blocksSafety: statsGapBlocksSafety(engineGap, testingGap?.thresholdGap ?? null, gpaGap),
  };

  const adjusted = applyMajorGuidanceToStatsGap(base, statsEntry, student, majorBucket);
  const adjustedTestingGap = adjusted.testingGap ?? adjusted.satGap;
  return {
    ...adjusted,
    blocksSafety: statsGapBlocksSafety(adjusted.engineGap, adjustedTestingGap, adjusted.gpaGap),
    safetyBand: classifySafetyBand(statsEntry, adjusted.effectiveTier, adjusted.flags, adjusted.gpaGap),
  };
}

/** Cap "SAT-only" safeties at selective flagships; promote high-admit test-blind schools. */
function computeEffectiveTier({ engineGap, flags, suggestedTier, statsEntry, gpaGap, policy }) {
  let tier = suggestedTier;
  const selectivity = Number(statsEntry.selectivity ?? 70);
  const acceptRate = statsEntry.acceptanceRate;

  const prestigeStatsOnly =
    tier === "safety" &&
    selectivity >= 55 &&
    flags.includes("above_testing_band") &&
    (gpaGap == null || gpaGap < 0.12) &&
    !flags.includes("below_gpa_band");

  if (prestigeStatsOnly) {
    tier = "match";
    flags.push("cap_prestige_stats_safety");
  }

  const stableHighAdmit =
    tier === "match" &&
    !flags.includes("below_sat_band") &&
    !flags.includes("below_gpa_band") &&
    engineGap < 12 &&
    (policy === "test_blind" || (acceptRate != null && acceptRate >= 0.6) || selectivity <= 38) &&
    (gpaGap == null || gpaGap <= 0.15);

  if (stableHighAdmit) {
    tier = "safety";
    flags.push("stable_high_admit_safety");
  }

  return tier;
}

/** @returns {"stable"|"moderate"|"prestige"|null} */
export function classifySafetyBand(statsEntry, effectiveTier, flags = [], gpaGap = null) {
  if (effectiveTier !== "safety") return null;
  if (flags.includes("stable_high_admit_safety")) return "stable";
  const selectivity = Number(statsEntry?.selectivity ?? 70);
  const acceptRate = statsEntry?.acceptanceRate;
  if ((acceptRate != null && acceptRate >= 0.6) || selectivity <= 38) return "stable";
  if (selectivity >= 55 && flags.includes("above_testing_band")) return "prestige";
  if (selectivity >= 48) return "moderate";
  return "stable";
}

export function isStableSafetyCandidate(candidate) {
  const { statsEntry, statsGap, entry } = candidate;
  if (statsGap?.safetyBand === "stable") return true;
  if (statsGap?.flags?.includes("stable_high_admit_safety")) return true;
  const sel = Number(statsEntry?.selectivity ?? entry?.selectivity ?? 70);
  const rate = statsEntry?.acceptanceRate;
  return (rate != null && rate >= 0.6) || sel <= 38;
}

export function isPrestigeStatsSafetyCandidate(candidate) {
  const { statsEntry, statsGap } = candidate;
  if (statsGap?.safetyBand === "prestige") return true;
  const sel = Number(statsEntry?.selectivity ?? 70);
  return sel >= 55 && statsGap?.flags?.includes("above_testing_band");
}

function suggestTierFromEngineGap(engineGap, flags) {
  if (flags.includes("missing_required_testing")) return "reach";
  if (flags.includes("below_sat_band") || flags.includes("below_gpa_band")) return "reach";
  if (engineGap >= 14) return "reach";
  if (engineGap >= -4 && engineGap < 14) return "match";
  if (engineGap <= -4) return "safety";
  return "match";
}

export function statsGapBlocksMatch(satGap, gpaGap) {
  if (satGap != null && satGap >= 80) return true;
  if (gpaGap != null && gpaGap >= 0.3) return true;
  return false;
}

export function statsGapBlocksSafety(engineGap, satGap, gpaGap) {
  if (statsGapBlocksMatch(satGap, gpaGap)) return true;
  if (engineGap >= 8) return true;
  return false;
}

/** Test-optional without scores: private selective schools should not default to Match. */
export function applyTestOptionalTierAdjustment(tier, entry, statsEntry, statsGap, student) {
  if (!student?.testOptionalNoScore || !statsEntry || !entry) {
    return { tier, statsGap };
  }

  const flags = [...(statsGap?.flags ?? [])];
  let adjusted = tier;
  const rate = statsEntry.acceptanceRate;
  const isPrivate = entry.type === "private";

  if (adjusted === "match" && isPrivate && rate != null && rate < 0.2) {
    adjusted = "reach";
    if (!flags.includes("test_optional_private_strict")) flags.push("test_optional_private_strict");
  } else if (adjusted === "match" && isPrivate && rate != null && rate < 0.35 && student.intl) {
    if (!flags.includes("test_optional_intl_caution")) flags.push("test_optional_intl_caution");
  }

  if (!statsGap) return { tier: adjusted, statsGap: null };
  return { tier: adjusted, statsGap: { ...statsGap, flags, effectiveTier: adjusted } };
}
