/**
 * OnlyApply engine standards — counselor-maintained benchmark profiles (draft → live).
 * Non-programmers update via admin: write from review, trial-run, publish.
 * Persisted in Supabase (production) with JSON file fallback for local dev.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDecisionEngine } from "./decisionEngine.mjs";
import { benchmarkSimilarityScore, profileSignatureFromBody } from "./engineIntakeProfile.mjs";
import {
  ensureBenchmarksLoaded,
  getBenchmarkStorageSource,
  getLastPublishedAt,
  listDraftBenchmarksCached,
  listLiveBenchmarksCached,
  persistBenchmarkEntry,
  publishDraftBenchmarksToLive,
} from "./engineBenchmarksStore.mjs";
import { extractReviewFeedback, feedbackTrainingStats } from "./engineReviewFeedback.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.join(__dirname, "..", "data", "engine");
const DRAFT_FILE = path.join(ENGINE_DIR, "benchmarks-draft.json");
const LIVE_FILE = path.join(ENGINE_DIR, "benchmarks-live.json");

export { ensureBenchmarksLoaded };

function parseSchoolEntry(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const school = raw.trim();
    return school ? { school } : null;
  }
  if (typeof raw === "object") {
    const school = String(raw.school ?? "").trim();
    if (!school) return null;
    const note = String(raw.note ?? "").trim();
    return note ? { school, note } : { school };
  }
  return null;
}

function normalizeTier(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseSchoolEntry).filter(Boolean).slice(0, 3);
}

export function normalizeApprovedSchools(raw) {
  if (!raw || typeof raw !== "object") {
    return { reach: [], match: [], safety: [], notes: null };
  }
  return {
    reach: normalizeTier(raw.reach),
    match: normalizeTier(raw.match),
    safety: normalizeTier(raw.safety),
    notes: String(raw.notes ?? "").trim() || null,
  };
}

function hasCompleteSchools(schools) {
  return (
    schools.reach.length >= 3 &&
    schools.match.length >= 3 &&
    schools.safety.length >= 3
  );
}

function normalizeSchoolKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tierSchoolSet(tier) {
  return new Set((tier ?? []).map((r) => normalizeSchoolKey(r.school)).filter(Boolean));
}

export { profileSignatureFromBody };

export function findBestBenchmark(entries, reportBody, tags = []) {
  const query = profileSignatureFromBody(reportBody, tags);
  const ranked = entries
    .map((e) => ({ entry: e, score: benchmarkSimilarityScore(query, e) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.entry ?? null;
}

function compareSchoolLists(expected, actual) {
  let matches = 0;
  let total = 0;
  for (const tier of ["reach", "match", "safety"]) {
    const exp = tierSchoolSet(expected[tier]);
    const act = tierSchoolSet(actual[tier]);
    for (const s of exp) {
      total += 1;
      if (act.has(s)) matches += 1;
    }
  }
  return { matches, total, rate: total ? matches / total : null };
}

function readCatalogCount() {
  const catalogFile = path.join(ENGINE_DIR, "school-major-catalog.json");
  if (!fs.existsSync(catalogFile)) return 0;
  try {
    const raw = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
}

export function getEngineStandardsStats() {
  const draft = listDraftBenchmarksCached();
  const live = listLiveBenchmarksCached();
  return {
    draftCount: draft.length,
    liveCount: live.length,
    catalogSchoolCount: readCatalogCount(),
    v2Enabled: (process.env.DECISION_ENGINE_V2_ENABLED ?? "1").trim().toLowerCase() !== "0",
    lastPublishedAt: getLastPublishedAt(),
    storageSource: getBenchmarkStorageSource(),
    draftFile: DRAFT_FILE,
    liveFile: LIVE_FILE,
  };
}

export function listDraftBenchmarks() {
  return listDraftBenchmarksCached();
}

export function listLiveBenchmarks() {
  return listLiveBenchmarksCached();
}

function buildBenchmarkEntryFromReview(input) {
  const { evalCase, review, reviewerEmail } = input;
  if (!evalCase?.caseKey) return { ok: false, reason: "missing_case" };

  const status = review?.status;
  if (status !== "submitted" && status !== "approved") {
    return { ok: false, reason: "review_not_submitted" };
  }

  const approvedSchools = normalizeApprovedSchools(review.finalApprovedRecommendation);
  if (!hasCompleteSchools(approvedSchools)) {
    return { ok: false, reason: "incomplete_schools" };
  }

  const reportBody = evalCase.reportBody;
  if (!reportBody || typeof reportBody !== "object") {
    return { ok: false, reason: "missing_report_body" };
  }

  const profile = profileSignatureFromBody(reportBody, evalCase.tags);
  const reviewFeedback = extractReviewFeedback(review);
  const entry = {
    id: evalCase.caseKey,
    sourceCaseKey: evalCase.caseKey,
    title: evalCase.title ?? evalCase.caseKey,
    profile,
    approvedSchools,
    reviewFeedback,
    notes: approvedSchools.notes ?? review.overallNotes ?? null,
    updatedAt: new Date().toISOString(),
    updatedBy: reviewerEmail ?? null,
  };

  return { ok: true, entry };
}

/**
 * @param {object} input
 * @param {object} input.evalCase
 * @param {object} input.review
 * @param {string} input.reviewerEmail
 */
export async function upsertBenchmarkFromReview(input) {
  const built = buildBenchmarkEntryFromReview(input);
  if (!built.ok) return built;

  const { entry } = built;
  await persistBenchmarkEntry(entry, ["draft"]);

  return {
    ok: true,
    entry,
    draftCount: listDraftBenchmarksCached().length,
    storageSource: getBenchmarkStorageSource(),
  };
}

/** Write the same benchmark to draft and live (used after counselor submit). */
export async function upsertBenchmarkToLiveFromReview(input) {
  const built = buildBenchmarkEntryFromReview(input);
  if (!built.ok) return built;

  const { entry } = built;
  try {
    await persistBenchmarkEntry(entry, ["draft", "live"]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[engine-benchmarks] live_upsert_failed", msg);
    return { ok: false, reason: "benchmark_persist_failed", message: msg };
  }

  return {
    ok: true,
    entry,
    draftCount: listDraftBenchmarksCached().length,
    liveCount: listLiveBenchmarksCached().length,
    syncedToLive: true,
    storageSource: getBenchmarkStorageSource(),
    reviewFeedback: entry.reviewFeedback ?? null,
    trainingStats: entry.reviewFeedback ? feedbackTrainingStats(entry.reviewFeedback) : null,
  };
}

/**
 * @param {Array<{ case: object, review?: object }>} evalEntries
 */
export function trialRunEngineStandards(evalEntries = []) {
  const draft = listDraftBenchmarksCached();
  const live = listLiveBenchmarksCached();

  const caseResults = [];
  let draftMatchSum = 0;
  let draftMatchTotal = 0;
  let liveMatchSum = 0;
  let liveMatchTotal = 0;
  let engineMatchSum = 0;
  let engineMatchTotal = 0;
  let engineScoredCount = 0;
  let engineBenchmarkCount = 0;

  for (const row of evalEntries) {
    const evalCase = row.case ?? row.evalCase;
    const review = row.review;
    if (!evalCase?.reportBody) continue;

    let counselor = null;
    if (review && (review.status === "submitted" || review.status === "approved")) {
      counselor = normalizeApprovedSchools(review.finalApprovedRecommendation);
    }
    if (!counselor || !hasCompleteSchools(counselor)) {
      const exp = {
        reach: normalizeTier(evalCase.expectedReach),
        match: normalizeTier(evalCase.expectedMatch),
        safety: normalizeTier(evalCase.expectedSafety),
      };
      if (hasCompleteSchools(exp)) counselor = exp;
    }
    if (!counselor || !hasCompleteSchools(counselor)) continue;

    const draftHit = findBestBenchmark(draft, evalCase.reportBody, evalCase.tags);
    const liveHit = findBestBenchmark(live, evalCase.reportBody, evalCase.tags);

    const draftCmp = draftHit
      ? compareSchoolLists(counselor, draftHit.approvedSchools)
      : { matches: 0, total: 9, rate: 0 };
    const liveCmp = liveHit
      ? compareSchoolLists(counselor, liveHit.approvedSchools)
      : { matches: 0, total: 9, rate: 0 };

    draftMatchSum += draftCmp.matches;
    draftMatchTotal += draftCmp.total;
    liveMatchSum += liveCmp.matches;
    liveMatchTotal += liveCmp.total;

    const engineDecision = runDecisionEngine(evalCase.reportBody, evalCase.tags);
    const engineCmp = engineDecision.ok
      ? compareSchoolLists(counselor, engineDecision.schools)
      : { matches: 0, total: 9, rate: 0 };
    engineMatchSum += engineCmp.matches;
    engineMatchTotal += engineCmp.total;
    if (engineDecision.ok && engineDecision.mode === "scored") engineScoredCount += 1;
    if (engineDecision.ok && engineDecision.mode?.startsWith("benchmark")) engineBenchmarkCount += 1;

    caseResults.push({
      caseKey: evalCase.caseKey,
      title: evalCase.title,
      draftBenchmarkId: draftHit?.sourceCaseKey ?? null,
      liveBenchmarkId: liveHit?.sourceCaseKey ?? null,
      draftMatchRate: draftCmp.rate,
      liveMatchRate: liveCmp.rate,
      engineMode: engineDecision.ok ? engineDecision.mode : null,
      engineMatchRate: engineCmp.rate,
    });
  }

  return {
    draftCount: draft.length,
    liveCount: live.length,
    catalogSchoolCount: readCatalogCount(),
    evaluatedCaseCount: caseResults.length,
    draftSchoolMatchRate: draftMatchTotal ? draftMatchSum / draftMatchTotal : null,
    liveSchoolMatchRate: liveMatchTotal ? liveMatchSum / liveMatchTotal : null,
    engineSchoolMatchRate: engineMatchTotal ? engineMatchSum / engineMatchTotal : null,
    engineScoredCaseCount: engineScoredCount,
    engineBenchmarkCaseCount: engineBenchmarkCount,
    caseResults,
  };
}

export async function publishEngineStandardsDraft(reviewerEmail) {
  return publishDraftBenchmarksToLive(reviewerEmail);
}
