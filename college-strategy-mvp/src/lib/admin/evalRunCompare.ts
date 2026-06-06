import type { AdminEvalRun, AdminEvalRunResult } from "./crmAdminApi";
import type { ProfileDimensionKey } from "../fiveDimensionProfile";
import {
  PROFILE_DIMENSION_KEYS,
  RUBRIC_DIMENSIONS,
  rubricAverage,
  type EvalReviewDraft,
  type RubricDimension,
} from "./evalRubric";
import { buildInitialReviewDraft, reviewToDraft } from "./evalReviewState";

export type EvalSchoolTier = "reach" | "match" | "safety";

const TIERS: EvalSchoolTier[] = ["reach", "match", "safety"];

export function normalizeSchoolKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function schoolTierMapFromReport(
  payload: Record<string, unknown> | null | undefined,
): Map<string, { school: string; tier: EvalSchoolTier }> {
  const map = new Map<string, { school: string; tier: EvalSchoolTier }>();
  if (!payload) return map;
  for (const tier of TIERS) {
    const rows = payload[tier];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const school = String((row as Record<string, unknown>).school ?? "").trim();
      if (!school) continue;
      map.set(normalizeSchoolKey(school), { school, tier });
    }
  }
  return map;
}

export type SchoolCompareRow = {
  school: string;
  tierA: EvalSchoolTier | null;
  tierB: EvalSchoolTier | null;
  changed: boolean;
};

export function buildSchoolCompareRows(
  mapA: Map<string, { school: string; tier: EvalSchoolTier }>,
  mapB: Map<string, { school: string; tier: EvalSchoolTier }>,
): SchoolCompareRow[] {
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  const rows: SchoolCompareRow[] = [];
  for (const key of keys) {
    const a = mapA.get(key);
    const b = mapB.get(key);
    const school = a?.school ?? b?.school ?? key;
    const tierA = a?.tier ?? null;
    const tierB = b?.tier ?? null;
    rows.push({
      school,
      tierA,
      tierB,
      changed: tierA !== tierB || (tierA == null) !== (tierB == null),
    });
  }
  return rows.sort((x, y) => {
    if (x.changed !== y.changed) return x.changed ? -1 : 1;
    return x.school.localeCompare(y.school);
  });
}

export function resultForCase(results: AdminEvalRunResult[], caseId: string): AdminEvalRunResult | null {
  return results.find((r) => r.caseId === caseId && r.status === "ok") ?? null;
}

export function runsWithCaseResult(
  runSummaries: Array<{ run: AdminEvalRun; results: AdminEvalRunResult[] }>,
  caseId: string,
): Array<{ run: AdminEvalRun; result: AdminEvalRunResult }> {
  return runSummaries
    .map(({ run, results }) => {
      const result = resultForCase(results, caseId);
      return result ? { run, result } : null;
    })
    .filter((row): row is { run: AdminEvalRun; result: AdminEvalRunResult } => row != null);
}

export function rubricAvgFromResult(
  result: AdminEvalRunResult,
  profileLabel: (key: ProfileDimensionKey) => string,
): number | null {
  const draft = reviewDraftFromResult(result, profileLabel);
  if (!draft || !result.review) return null;
  return rubricAverage(draft.rubricScores);
}

export function reviewDraftFromResult(
  result: AdminEvalRunResult,
  profileLabel: (key: ProfileDimensionKey) => string,
): EvalReviewDraft | null {
  if (!result.case) return null;
  const fallback = buildInitialReviewDraft(result.case, result, profileLabel);
  return result.review ? reviewToDraft(result.review, fallback) : fallback;
}

export type ScoreCompareRow = {
  key: string;
  label: string;
  scoreA: number | null;
  scoreB: number | null;
  delta: number | null;
  changed: boolean;
};

function profileDisplayScore(draft: EvalReviewDraft, key: ProfileDimensionKey): number | null {
  const row = draft.profileDimensionReviews.find((r) => r.key === key);
  if (!row) return null;
  if (resultReviewed(draft) && row.counselorScore != null) return row.counselorScore;
  return row.aiScore;
}

function resultReviewed(draft: EvalReviewDraft): boolean {
  return draft.status === "submitted" || draft.status === "approved";
}

function rubricDisplayScore(draft: EvalReviewDraft, key: RubricDimension): number | null {
  if (!resultReviewed(draft)) return null;
  const score = draft.rubricScores[key]?.score;
  return typeof score === "number" ? score : null;
}

export function buildRubricCompareRows(
  draftA: EvalReviewDraft | null,
  draftB: EvalReviewDraft | null,
  labelForKey: (key: RubricDimension) => string,
): ScoreCompareRow[] {
  return RUBRIC_DIMENSIONS.map((key) => {
    const scoreA = draftA ? rubricDisplayScore(draftA, key) : null;
    const scoreB = draftB ? rubricDisplayScore(draftB, key) : null;
    const delta = scoreA != null && scoreB != null ? scoreB - scoreA : null;
    return {
      key,
      label: labelForKey(key),
      scoreA,
      scoreB,
      delta,
      changed: scoreA !== scoreB,
    };
  });
}

export function buildProfileCompareRows(
  draftA: EvalReviewDraft | null,
  draftB: EvalReviewDraft | null,
  labelForKey: (key: ProfileDimensionKey) => string,
): ScoreCompareRow[] {
  return PROFILE_DIMENSION_KEYS.map((key) => {
    const scoreA = draftA ? profileDisplayScore(draftA, key) : null;
    const scoreB = draftB ? profileDisplayScore(draftB, key) : null;
    const delta = scoreA != null && scoreB != null ? scoreB - scoreA : null;
    return {
      key,
      label: labelForKey(key),
      scoreA,
      scoreB,
      delta,
      changed: scoreA !== scoreB,
    };
  });
}

export function formatCompareScore(value: number | null): string {
  if (value == null) return "—";
  return String(Math.round(value));
}

export function formatCompareDelta(delta: number | null): string {
  if (delta == null) return "—";
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : String(delta);
}

export function rubricAvgFromDraft(draft: EvalReviewDraft | null): number | null {
  if (!draft || !resultReviewed(draft)) return null;
  return rubricAverage(draft.rubricScores);
}

export function formatRunWhen(iso: string, locale: "zh" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
