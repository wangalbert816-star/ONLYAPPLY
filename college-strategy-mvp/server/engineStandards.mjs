/**
 * OnlyApply engine standards — counselor-maintained benchmark profiles (draft → live).
 * Non-programmers update via admin: write from review, trial-run, publish.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDecisionEngine } from "./decisionEngine.mjs";
import { benchmarkSimilarityScore, profileSignatureFromBody } from "./engineIntakeProfile.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.join(__dirname, "..", "data", "engine");
const DRAFT_FILE = path.join(ENGINE_DIR, "benchmarks-draft.json");
const LIVE_FILE = path.join(ENGINE_DIR, "benchmarks-live.json");
const LOG_FILE = path.join(ENGINE_DIR, "publish-log.json");

function ensureEngineDir() {
  if (!fs.existsSync(ENGINE_DIR)) fs.mkdirSync(ENGINE_DIR, { recursive: true });
}

function readJsonArray(file) {
  ensureEngineDir();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeJsonArray(file, rows) {
  ensureEngineDir();
  fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

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

function signatureKey(sig) {
  return JSON.stringify(sig);
}

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
  const draft = readJsonArray(DRAFT_FILE);
  const live = readJsonArray(LIVE_FILE);
  const log = readJsonArray(LOG_FILE);
  return {
    draftCount: draft.length,
    liveCount: live.length,
    catalogSchoolCount: readCatalogCount(),
    v2Enabled: (process.env.DECISION_ENGINE_V2_ENABLED ?? "1").trim().toLowerCase() !== "0",
    lastPublishedAt: log[0]?.publishedAt ?? null,
    draftFile: DRAFT_FILE,
    liveFile: LIVE_FILE,
  };
}

export function listDraftBenchmarks() {
  return readJsonArray(DRAFT_FILE);
}

export function listLiveBenchmarks() {
  return readJsonArray(LIVE_FILE);
}

/**
 * @param {object} input
 * @param {object} input.evalCase
 * @param {object} input.review
 * @param {string} input.reviewerEmail
 */
export function upsertBenchmarkFromReview(input) {
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
  const entry = {
    id: evalCase.caseKey,
    sourceCaseKey: evalCase.caseKey,
    title: evalCase.title ?? evalCase.caseKey,
    profile,
    approvedSchools,
    notes: approvedSchools.notes ?? review.overallNotes ?? null,
    updatedAt: new Date().toISOString(),
    updatedBy: reviewerEmail ?? null,
  };

  const draft = readJsonArray(DRAFT_FILE);
  const idx = draft.findIndex((r) => r.sourceCaseKey === entry.sourceCaseKey);
  if (idx >= 0) draft[idx] = entry;
  else draft.push(entry);
  draft.sort((a, b) => String(a.sourceCaseKey).localeCompare(String(b.sourceCaseKey)));
  writeJsonArray(DRAFT_FILE, draft);

  return { ok: true, entry, draftCount: draft.length };
}

/** Write the same benchmark to draft and live (used after counselor submit). */
export function upsertBenchmarkToLiveFromReview(input) {
  const draftResult = upsertBenchmarkFromReview(input);
  if (!draftResult.ok) return draftResult;

  const live = readJsonArray(LIVE_FILE);
  const idx = live.findIndex((r) => r.sourceCaseKey === draftResult.entry.sourceCaseKey);
  if (idx >= 0) live[idx] = draftResult.entry;
  else live.push(draftResult.entry);
  live.sort((a, b) => String(a.sourceCaseKey).localeCompare(String(b.sourceCaseKey)));
  writeJsonArray(LIVE_FILE, live);

  return { ...draftResult, liveCount: live.length, syncedToLive: true };
}

/**
 * @param {Array<{ case: object, review?: object }>} evalEntries
 */
export function trialRunEngineStandards(evalEntries = []) {
  const draft = readJsonArray(DRAFT_FILE);
  const live = readJsonArray(LIVE_FILE);

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

export function publishEngineStandardsDraft(reviewerEmail) {
  const draft = readJsonArray(DRAFT_FILE);
  if (!draft.length) return { ok: false, reason: "draft_empty" };

  writeJsonArray(LIVE_FILE, draft);
  const log = readJsonArray(LOG_FILE);
  log.unshift({
    publishedAt: new Date().toISOString(),
    publishedBy: reviewerEmail ?? null,
    entryCount: draft.length,
  });
  writeJsonArray(LOG_FILE, log.slice(0, 20));

  return { ok: true, liveCount: draft.length, publishedAt: log[0].publishedAt };
}
