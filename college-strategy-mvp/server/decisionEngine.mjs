/**
 * OnlyApply Decision Engine — benchmark match (v1) + preferences-first scored catalog (v2) + AI gap fill.
 */

import {
  ensureBenchmarksLoaded,
  findBestBenchmark,
  listDraftBenchmarks,
  listLiveBenchmarks,
  normalizeApprovedSchools,
} from "./engineStandards.mjs";
import { BENCHMARK_STRONG_SCORE, runDecisionEngineV2, runDecisionEngineV2Catalog } from "./decisionEngineV2.mjs";
import { fillDecisionGapsWithAi } from "./decisionEngineAiFill.mjs";
import {
  buildReviewFeedbackPromptBlock,
  profileScoresWithFeedback,
} from "./engineReviewFeedback.mjs";
import { scoreFiveDimensions } from "./fiveDimensionScore.mjs";
import {
  BENCHMARK_REFERENCE_SCORE_CEILING,
  benchmarkProfilePrefDiff,
  benchmarkReferenceWeight,
  benchmarkSimilarityScore,
  buildEngineIntakeProfile,
  intakeProfileSummaryForPrompt,
  isUcSchoolName,
  profileSignatureFromBody,
  schoolRegionMatchesPrefs,
} from "./engineIntakeProfile.mjs";
import {
  listSchoolMajorCatalog,
  schoolMatchesCatalogEntry,
} from "./engineTierRules.mjs";
import { schoolMatchesForbidden } from "./topReferenceSchools.mjs";

function decisionEngineEnabled() {
  const raw = (process.env.DECISION_ENGINE_ENABLED ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function useDraftBenchmarks() {
  const raw = (process.env.DECISION_ENGINE_USE_DRAFT ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function scoringEngineEnabled() {
  const raw = (process.env.DECISION_ENGINE_V2_ENABLED ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function aiGapFillEnabled() {
  const raw = (process.env.DECISION_ENGINE_AI_FILL ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function catalogEntryForSchoolName(name, catalog) {
  return catalog.find((e) => schoolMatchesCatalogEntry(name, e)) ?? null;
}

/** Benchmark 9-school list or stored profile conflicts user preferences → reference only, never copy plan. */
export function benchmarkConflictsPreferences(body, hit) {
  const intake = buildEngineIntakeProfile(body);
  const schools = hit?.approvedSchools;
  if (!schools) return { conflict: false, reasons: [] };

  const catalog = listSchoolMajorCatalog();
  const all = [...(schools.reach ?? []), ...(schools.match ?? []), ...(schools.safety ?? [])];
  const names = all.map((r) => String(r?.school ?? r ?? "").trim()).filter(Boolean);
  const reasons = [];
  if (!names.length) return { conflict: false, reasons };

  if (intake.geo.strict) {
    let inRegion = 0;
    let known = 0;
    for (const name of names) {
      const entry = catalogEntryForSchoolName(name, catalog);
      if (!entry) continue;
      known += 1;
      if (schoolRegionMatchesPrefs(entry.region, intake.geo)) inRegion += 1;
    }
    if (known >= 5 && inRegion < Math.ceil(known * 0.6)) reasons.push("geo_schools");
  }

  if (!intake.budget.allowHighPrivate) {
    let highPrivate = 0;
    for (const name of names) {
      const entry = catalogEntryForSchoolName(name, catalog);
      if (entry?.budgetTier === "high" && entry.type === "private") highPrivate += 1;
    }
    if (highPrivate >= 3) reasons.push("budget_schools");
  }

  if (intake.dealbreakers.themes.includes("no_religious")) {
    const religiousRe = /notre dame|byu|brigham|liberty university|christian|baylor|pepperdine|georgetown/i;
    if (names.some((n) => religiousRe.test(n))) reasons.push("no_religious");
  }

  if (!intake.ucIntent) {
    const ucCount = names.filter((n) => isUcSchoolName(n)).length;
    if (ucCount >= 1) reasons.push("uc_without_intent");
  }

  for (const name of names) {
    if (intake.forbidden.length && schoolMatchesForbidden(name, intake.forbidden)) {
      reasons.push("forbidden_school");
      break;
    }
  }

  return { conflict: reasons.length > 0, reasons };
}

function tryBenchmarkMatch(body, tags) {
  const query = profileSignatureFromBody(body, tags);
  const live = listLiveBenchmarks();
  const draft = useDraftBenchmarks() ? listDraftBenchmarks() : [];

  let hit = findBestBenchmark(live, body, tags);
  let source = "live";
  if (!hit && draft.length) {
    hit = findBestBenchmark(draft, body, tags);
    source = "draft";
  }
  if (!hit) return { ok: false, reason: "no_benchmark_match" };

  const intake = buildEngineIntakeProfile(body, tags);
  const schools = normalizeApprovedSchools(hit.approvedSchools);
  const score = benchmarkSimilarityScore(query, hit);
  const prefCheck = benchmarkConflictsPreferences(body, hit);
  const profilePref = benchmarkProfilePrefDiff(query, hit.profile, intake);
  const prefConflict = prefCheck.conflict || profilePref.differs;
  const prefConflictReasons = [...prefCheck.reasons, ...profilePref.reasons];
  const canApplyExact = score >= BENCHMARK_STRONG_SCORE && !prefConflict;

  return {
    ok: true,
    mode: canApplyExact ? "benchmark" : "benchmark_reference",
    canApplyExact,
    prefConflict,
    prefConflictReasons,
    profilePrefDiff: profilePref.differs,
    source,
    benchmarkId: hit.sourceCaseKey,
    benchmarkTitle: hit.title,
    matchScore: score,
    schools,
    notes: hit.notes ?? schools.notes ?? null,
    profile: hit.profile,
    reviewFeedback: hit.reviewFeedback ?? null,
  };
}

function benchmarkReferenceFromAttempt(attempt) {
  if (!attempt?.ok) return null;
  if (attempt.canApplyExact) return null;
  const referenceWeight = benchmarkReferenceWeight(attempt.matchScore);
  if (referenceWeight <= 0) return null;
  return {
    benchmarkId: attempt.benchmarkId,
    benchmarkTitle: attempt.benchmarkTitle,
    matchScore: attempt.matchScore,
    referenceWeight,
    prefConflict: attempt.prefConflict,
    prefConflictReasons: attempt.prefConflictReasons ?? [],
    schools: attempt.schools,
    notes: attempt.notes,
    reviewFeedback: attempt.reviewFeedback ?? null,
  };
}

function buildScoringOptsFromBenchmark(benchmark, body) {
  if (!benchmark?.ok) return {};
  const computed = scoreFiveDimensions(body);
  let calibratedProfileScores = null;
  if (benchmark.reviewFeedback?.profileScoreOverrides) {
    calibratedProfileScores = profileScoresWithFeedback(
      computed,
      benchmark.reviewFeedback,
      benchmark.matchScore ?? 0,
      BENCHMARK_STRONG_SCORE,
    );
  }
  const profileCalibrated =
    calibratedProfileScores != null &&
    PROFILE_CALIBRATION_KEYS.some((k) => calibratedProfileScores[k] !== computed[k]);

  return {
    calibratedProfileScores,
    reviewFeedback: benchmark.reviewFeedback ?? null,
    benchmarkMatchScore: benchmark.matchScore ?? null,
    benchmarkId: benchmark.benchmarkId ?? null,
    benchmarkTitle: benchmark.benchmarkTitle ?? null,
    profileCalibrated,
  };
}

const PROFILE_CALIBRATION_KEYS = ["academic", "testing", "activities", "rigor", "strategy"];

function attachBenchmarkReference(result, benchmarkAttempt) {
  const ref = benchmarkReferenceFromAttempt(benchmarkAttempt);
  if (!ref) return result;
  return { ...result, benchmarkReference: ref };
}

function formatTierLine(tier, locale) {
  return tier
    .map((r) => (r.note ? `${r.school}（${r.note}）` : r.school))
    .join(locale === "en" ? ", " : "、");
}

async function runScoredWithAiFill(body, tags, locale, generateJson, scoringOpts = {}) {
  let pick = runDecisionEngineV2Catalog(body, tags, {
    geoStrict: true,
    calibratedProfileScores: scoringOpts.calibratedProfileScores,
  });

  if (pick.ok) {
    return finalizeV2FromPick(pick, "scored", {
      reviewFeedback: scoringOpts.reviewFeedback,
      benchmarkMatchScore: scoringOpts.benchmarkMatchScore,
      benchmarkId: scoringOpts.benchmarkId,
      benchmarkTitle: scoringOpts.benchmarkTitle,
      profileCalibrated: scoringOpts.profileCalibrated,
    });
  }

  const gaps = pick.gaps;
  if (gaps && generateJson && aiGapFillEnabled()) {
    const fillResult = await fillDecisionGapsWithAi({
      body,
      intake: pick.context.intake,
      partialSchools: pick.schools,
      gaps,
      locale,
      generateJson,
    });

    if (fillResult.ok) {
      const ctx = pick.context;
      const schools = fillResult.schools;
      return {
        ok: true,
        source: "scored",
        mode: "scored_ai_fill",
        benchmarkId: null,
        benchmarkTitle: `五维算分+AI补校 · ${ctx.majorBucket}`,
        matchScore: scoringOpts.benchmarkMatchScore ?? null,
        reviewFeedback: scoringOpts.reviewFeedback ?? null,
        schools,
        notes: schools.notes ?? `偏好优先 catalog + AI 补 ${fillResult.aiFilled} 所`,
        profile: {
          majorBucket: ctx.majorBucket,
          composite: Math.round(ctx.composite * 10) / 10,
          scores: ctx.profileScores,
          rules: {
            budgetSensitive: ctx.budgetSensitive,
            geoStrict: ctx.geoStrict,
            geoAllowed: ctx.geo.allowed,
            aiFilled: fillResult.aiFilled,
            profileCalibrated: Boolean(scoringOpts.profileCalibrated),
          },
        },
        v2Meta: {
          catalogMode: pick.catalogMode,
          aiFilled: fillResult.aiFilled,
          gapsBeforeFill: gaps,
        },
      };
    }
  }

  const relaxed = runDecisionEngineV2Catalog(body, tags, {
    geoStrict: false,
    calibratedProfileScores: scoringOpts.calibratedProfileScores,
  });
  if (relaxed.ok) {
    return finalizeV2FromPick(relaxed, "scored_relaxed_geo", {
      reviewFeedback: scoringOpts.reviewFeedback,
      benchmarkMatchScore: scoringOpts.benchmarkMatchScore,
      benchmarkId: scoringOpts.benchmarkId,
      benchmarkTitle: scoringOpts.benchmarkTitle,
      profileCalibrated: scoringOpts.profileCalibrated,
    });
  }

  return { ok: false, reason: "incomplete_tiers", gaps, partial: pick.schools };
}

function finalizeV2FromPick(pick, mode, extra = {}) {
  const { reachRows, matchRows, safetyRows, context, schools } = pick;
  return {
    ok: true,
    source: "scored",
    mode,
    benchmarkId: extra.benchmarkId ?? null,
    benchmarkTitle: extra.benchmarkTitle ?? `五维算分 · ${context.majorBucket}`,
    matchScore: extra.benchmarkMatchScore ?? null,
    reviewFeedback: extra.reviewFeedback ?? null,
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
        profileCalibrated: Boolean(extra.profileCalibrated),
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

/**
 * Sync path (trial-run, no LLM). Preferences strict → relaxed geo; no AI fill.
 */
export function runDecisionEngine(body, tags = []) {
  if (!decisionEngineEnabled()) {
    return { ok: false, reason: "disabled" };
  }

  const benchmark = tryBenchmarkMatch(body, tags);
  if (benchmark.ok && benchmark.canApplyExact) {
    return benchmark;
  }

  if (scoringEngineEnabled()) {
    const scored = runDecisionEngineV2(body, tags, { allowRelaxedGeo: true });
    if (scored.ok) {
      return attachBenchmarkReference({ ...scored, benchmarkAttempt: benchmark.ok ? benchmark : null }, benchmark);
    }
  }

  return { ok: false, reason: "no_engine_match", benchmarkAttempt: benchmark };
}

/**
 * Full path for report generation — catalog under preferences, then AI fills gaps.
 * @param {Record<string, unknown>} body
 * @param {string[]} [tags]
 * @param {{ locale?: string, generateJson?: (messages: object[]) => Promise<{ parsed: object }> }} [opts]
 */
export async function runDecisionEngineAsync(body, tags = [], opts = {}) {
  if (!decisionEngineEnabled()) {
    return { ok: false, reason: "disabled" };
  }

  await ensureBenchmarksLoaded();

  const locale = opts.locale === "en" ? "en" : "zh";
  const benchmark = tryBenchmarkMatch(body, tags);
  const scoringOpts = buildScoringOptsFromBenchmark(benchmark, body);

  if (benchmark.ok && benchmark.canApplyExact) {
    return benchmark;
  }

  if (scoringEngineEnabled()) {
    const withAi = await runScoredWithAiFill(body, tags, locale, opts.generateJson, scoringOpts);
    if (withAi.ok) {
      return attachBenchmarkReference({ ...withAi, benchmarkAttempt: benchmark.ok ? benchmark : null }, benchmark);
    }
  }

  return { ok: false, reason: "no_engine_match", benchmarkAttempt: benchmark };
}

export function buildBenchmarkReferencePromptBlock(benchmarkReference, locale = "zh") {
  if (!benchmarkReference) return "";
  const r = benchmarkReference;
  const w = r.referenceWeight ?? benchmarkReferenceWeight(r.matchScore);
  if (w <= 0) return "";

  const pct = Math.round(w * 100);
  const score = r.matchScore ?? 0;
  const title = r.benchmarkTitle || r.benchmarkId || "case";

  const reasonLine =
    w >= 0.2 && r.prefConflictReasons?.length > 0
      ? locale === "en"
        ? `Preference gaps vs that case: ${r.prefConflictReasons.join(", ")}.`
        : `与案例偏好差异：${r.prefConflictReasons.join("、")}。`
      : "";

  const reach = (r.schools?.reach ?? []).map((x) => x.school).filter(Boolean);
  const match = (r.schools?.match ?? []).map((x) => x.school).filter(Boolean);
  const safety = (r.schools?.safety ?? []).map((x) => x.school).filter(Boolean);
  const join = locale === "en" ? ", " : "、";

  const guidance =
    w >= 0.66
      ? locale === "en"
        ? "Strong reference — you may borrow tiering logic and major-fit framing from the past list, but MUST NOT reuse school names in reach/match/safety."
        : "参考强度较高——可借鉴过往分档逻辑与专业匹配表述，但 reach/match/safety 不得使用下列校名。"
      : w >= 0.33
        ? locale === "en"
          ? "Moderate reference — calibrate tier tone and risk wording only; do not reuse past school names."
          : "参考强度中等——仅校准档位语气与风险表述，勿照搬下列校名。"
        : locale === "en"
          ? "Light reference — background context only; rely on the engine 9-school list below."
          : "参考强度较低——仅作背景提示，以下方引擎 9 校为准。";

  const tierLines = [];
  if (w >= 0.35 && reach.length) {
    tierLines.push(
      locale === "en" ? `- Past Reach (${pct}% ref): ${reach.join(join)}` : `- 当时冲（参考 ${pct}%）：${reach.join(join)}`,
    );
  }
  if (w >= 0.5 && match.length) {
    tierLines.push(
      locale === "en" ? `- Past Match (${pct}% ref): ${match.join(join)}` : `- 当时稳（参考 ${pct}%）：${match.join(join)}`,
    );
  }
  if (w >= 0.65 && safety.length) {
    tierLines.push(
      locale === "en" ? `- Past Safety (${pct}% ref): ${safety.join(join)}` : `- 当时保（参考 ${pct}%）：${safety.join(join)}`,
    );
  }

  const notesLine =
    w >= 0.75 && r.notes
      ? locale === "en"
        ? `- Past counselor note (${pct}% ref): ${r.notes}`
        : `- 当时顾问要点（参考 ${pct}%）：${r.notes}`
      : "";

  if (locale === "en") {
    return `

[OnlyApply — linear historical reference ${pct}% | similarity ${score}/~${BENCHMARK_REFERENCE_SCORE_CEILING}]
Similar past case "${title}". ${reasonLine}
${guidance}
${tierLines.join("\n")}
${notesLine}
Past lists are NOT approved for this student — use ONLY the engine 9 schools below for reach/match/safety.
`;
  }

  return `

【OnlyApply — 线性历史参考 ${pct}%｜相似度 ${score}/约 ${BENCHMARK_REFERENCE_SCORE_CEILING}】
相似过往案例「${title}」。${reasonLine}
${guidance}
${tierLines.join("\n")}
${notesLine}
过往校单未获批准用于本次学生——reach/match/safety 只能使用下方引擎 9 校。
`;
}

export function buildDecisionEnginePromptBlock(decision, locale = "zh", body = null, tags = []) {
  if (!decision?.ok) return "";
  const s = decision.schools;

  const intakeBlock =
    body && typeof body === "object"
      ? `\n${intakeProfileSummaryForPrompt(buildEngineIntakeProfile(body, tags), locale)}\n`
      : "";

  const referenceBlock = buildBenchmarkReferencePromptBlock(decision.benchmarkReference, locale);
  const feedbackSource = decision.reviewFeedback ?? decision.benchmarkReference?.reviewFeedback ?? null;
  const trainingBlock = buildReviewFeedbackPromptBlock(feedbackSource, locale, {
    caseTitle: decision.benchmarkTitle ?? decision.benchmarkId ?? undefined,
    matchScore: decision.matchScore ?? decision.benchmarkReference?.matchScore ?? null,
  });

  const prefNote =
    decision.mode === "scored_ai_fill"
      ? locale === "en"
        ? "Schools combine catalog picks under budget/geo/dealbreakers plus AI-suggested gap fills where the catalog was short."
        : "名单在预算/地理/底线约束下由校表选出；校表不足部分由 AI 按相同约束补校。"
      : decision.mode === "scored" || decision.mode === "scored_relaxed_geo"
        ? locale === "en"
          ? "Source: five-dimension scoring + school×major catalog under user budget/geo/dealbreaker preferences."
          : "来源：五维算分 + 校专业表，已纳入用户预算/地理/底线偏好。"
        : locale === "en"
          ? `Reference benchmark: ${decision.benchmarkTitle || decision.benchmarkId}`
          : `参考 benchmark：${decision.benchmarkTitle || decision.benchmarkId}`;

  if (locale === "en") {
    return `

[OnlyApply Decision Engine — MANDATORY school skeleton]
The following 9 schools are engine-approved. Do NOT rename, remove, swap tiers, or add different schools in reach/match/safety.
${prefNote}
${referenceBlock}
${trainingBlock}
${intakeBlock}
- Reach: ${formatTierLine(s.reach, "en")}
- Match: ${formatTierLine(s.match, "en")}
- Safety: ${formatTierLine(s.safety, "en")}
${decision.notes ? `- Engine note: ${decision.notes}\n` : ""}Write why_reach_for_you / why_match_for_you / why_safety_for_you, key_risks, and other prose fields for THESE schools only.
`;
  }

  return `

【OnlyApply Decision Engine — 以下 9 校为引擎判定，禁止更改】
reach / match / safety 必须使用下列校名与档位，不得替换、删除或新增其它学校。
${prefNote}
${referenceBlock}
${trainingBlock}
${intakeBlock}
- 冲：${formatTierLine(s.reach, "zh")}
- 稳：${formatTierLine(s.match, "zh")}
- 保：${formatTierLine(s.safety, "zh")}
${decision.notes ? `- 引擎要点：${decision.notes}\n` : ""}请仅为上述学校撰写 why_*、key_risks 等说明字段。
`;
}

export function mergeDecisionSchoolsIntoReport(parsed, decision, locale = "zh") {
  if (!parsed || typeof parsed !== "object" || !decision?.ok) return parsed;
  const s = decision.schools;

  for (const tier of ["reach", "match", "safety"]) {
    const approved = s[tier] ?? [];
    const whyKey =
      tier === "reach" ? "why_reach_for_you" : tier === "match" ? "why_match_for_you" : "why_safety_for_you";
    const existing = Array.isArray(parsed[tier]) ? parsed[tier] : [];
    parsed[tier] = approved.map((row, i) => {
      const prev = existing[i] && typeof existing[i] === "object" ? existing[i] : {};
      const note = String(row.note ?? "").trim();
      const whyFromLlm = String(prev[whyKey] ?? "").trim();
      return {
        ...prev,
        school: row.school,
        [whyKey]: whyFromLlm || note || (locale === "en" ? "Engine benchmark fit." : "引擎 benchmark 匹配。"),
      };
    });
  }

  parsed.decision_engine = {
    version: decision.mode?.startsWith("scored") ? "2" : "1",
    mode: decision.mode ?? "benchmark",
    source: decision.source,
    benchmark_id: decision.benchmarkId ?? decision.benchmarkReference?.benchmarkId ?? null,
    benchmark_title: decision.benchmarkTitle ?? decision.benchmarkReference?.benchmarkTitle ?? null,
    benchmark_reference_only: Boolean(decision.benchmarkReference),
    benchmark_reference_weight: decision.benchmarkReference?.referenceWeight ?? null,
    match_score: decision.matchScore ?? decision.benchmarkReference?.matchScore ?? null,
    profile_composite: decision.profile?.composite ?? null,
    major_bucket: decision.profile?.majorBucket ?? null,
    ai_filled: decision.v2Meta?.aiFilled ?? decision.profile?.rules?.aiFilled ?? null,
    geo_strict: decision.profile?.rules?.geoStrict ?? null,
  };

  return parsed;
}

export { runDecisionEngineV2 };
