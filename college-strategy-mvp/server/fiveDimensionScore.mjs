/**
 * Server-side five-dimension profile scoring (mirrors src/lib/fiveDimensionProfile.ts numerics).
 * Used by Decision Engine v2 — deterministic tiering, not LLM prose.
 */

import { meaningfulStructuredActivities } from "./activityEvidence.mjs";

function clampScore(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function linearRatio(value, min, max) {
  if (max <= min) return value >= min ? 1 : 0;
  return clampScore((value - min) / (max - min), 0, 1);
}

function scoreFromRatio(ratio, minScore, maxScore) {
  return minScore + ratio * (maxScore - minScore);
}

function gpaSignalQuality(g) {
  const hasGpaNumber = /\d\.\d{1,2}/.test(g) ? 1 : 0;
  const hasPercent = /\b(9[0-9]|[1-9]?\d)\s*(\/\s*100|分)\b/.test(g) ? 1 : 0;
  const hasRigor =
    /rank|排名|top|前\s*\d|%\s*|\bUW\b|\bW\b|unweighted|weighted|未加权|加权|AP|IB|honors|honour|a-?level|course|课程|rigor|difficult/i.test(
      g,
    )
      ? 1
      : 0;
  const hasRank = /rank|排名|top\s*\d|前\s*\d|percentile|decile|堂|T[1-3]/i.test(g) ? 1 : 0;
  const hasTrend = /上升|下滑|trend|improv|declin|junior|senior|11\s*年级|12\s*年级|year\s*\d/i.test(g) ? 1 : 0;
  const hasScale = /\/\s*4|\/\s*5|满分|scale|绩点|GPA|百分/i.test(g) ? 1 : 0;
  return clampScore(
    hasGpaNumber * 0.34 + hasPercent * 0.1 + hasRigor * 0.24 + hasRank * 0.18 + hasTrend * 0.06 + hasScale * 0.08,
    0,
    1,
  );
}

function gpaContextBonus(g) {
  return linearRatio(g.trim().length, 14, 64) * 0.12;
}

function parseSheetGpaNumber(s) {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function transcriptSheetUsable(sheet) {
  if (!sheet || typeof sheet !== "object" || sheet.skipped) return false;
  const courses = Array.isArray(sheet.courses) ? sheet.courses : [];
  return courses.some((c) => String(c?.courseName ?? "").trim() && String(c?.grade ?? "").trim());
}

function scoreAcademic(body) {
  const sheet = body?.transcriptSheet;
  if (transcriptSheetUsable(sheet)) {
    const uw = parseSheetGpaNumber(sheet.unweightedGpa);
    const w = parseSheetGpaNumber(sheet.weightedGpa);
    const gpaNum = uw ?? w;
    if (gpaNum != null && gpaNum > 0 && gpaNum <= 5.5) {
      return Math.round(clampScore(scoreFromRatio(linearRatio(gpaNum, 2.4, 4.0), 34, 94), 34, 94));
    }
    const filled = (sheet.courses ?? []).filter((c) => c?.courseName?.trim() && c?.grade?.trim());
    if (filled.length >= 6) return 62;
    if (filled.length >= 3) return 54;
    if (filled.length >= 1) return 46;
  }

  const g = String(body?.gpa ?? "").trim();
  if (!g) return 34;
  const signals = gpaSignalQuality(g);
  const bonus = gpaContextBonus(g);
  let quality = clampScore(signals * 0.88 + bonus, 0, 1);
  if (g.length > 180 && signals < 0.38) quality = Math.min(quality, 0.48);
  return Math.round(clampScore(scoreFromRatio(quality, 34, 94), 34, 94));
}

function parseSatish(s) {
  const d = String(s ?? "").replace(/\D/g, "");
  if (d.length < 3) return null;
  const n = Number(d.slice(0, 4));
  if (n >= 400 && n <= 1600) return n;
  return null;
}

function parseActish(s) {
  const d = String(s ?? "").replace(/\D/g, "");
  if (!d) return null;
  const n = Number(d.slice(0, 2));
  if (n >= 10 && n <= 36) return n;
  return null;
}

function scoreFromCurve(value, points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (value <= sorted[0][0]) return sorted[0][1];
  for (let i = 1; i < sorted.length; i += 1) {
    const [x2, y2] = sorted[i];
    const [x1, y1] = sorted[i - 1];
    if (value <= x2) return y1 + ((value - x1) / (x2 - x1)) * (y2 - y1);
  }
  return sorted[sorted.length - 1][1];
}

function scoreTesting(body) {
  const testing = String(body?.testing ?? "").trim();
  if (!testing) return 36;
  if (testing === "test_optional") {
    const g = String(body?.gpa ?? "").trim();
    const gpaSupport = gpaSignalQuality(g) * 0.22 + gpaContextBonus(g);
    return Math.round(clampScore(scoreFromRatio(0.58 + gpaSupport, 52, 82), 52, 82));
  }
  const has = Boolean(String(body?.satScore ?? "").trim() || String(body?.actScore ?? "").trim());
  if (!has) return 42;
  const sat = parseSatish(body?.satScore);
  const act = parseActish(body?.actScore);
  const candidates = [];
  if (sat != null) {
    candidates.push(
      scoreFromCurve(sat, [
        [400, 40],
        [1100, 54],
        [1250, 62],
        [1380, 70],
        [1450, 78],
        [1520, 86],
        [1600, 93],
      ]),
    );
  }
  if (act != null) {
    candidates.push(
      scoreFromCurve(act, [
        [10, 40],
        [22, 54],
        [25, 62],
        [28, 70],
        [31, 78],
        [34, 86],
        [36, 93],
      ]),
    );
  }
  if (candidates.length === 0) return 50;
  return Math.min(93, Math.max(40, Math.round(Math.max(...candidates))));
}

const ACTIVITY_LEADERSHIP_RE =
  /lead|chair|captain|founder|president|national|international|research|paper|专利|主席|队长|创始人|国家|国际|科研/i;

function activityItemDepthNorm(item) {
  const name = linearRatio(String(item.name ?? "").trim().length, 0, 14);
  const role = linearRatio(String(item.role ?? "").trim().length, 0, 18);
  const desc = linearRatio(String(item.description ?? "").trim().length, 0, 90);
  const outcome = linearRatio(
    Math.max(String(item.outcome ?? "").trim().length, String(item.award ?? "").trim().length),
    0,
    28,
  );
  const hours = linearRatio(String(item.hours ?? "").trim().length, 0, 10);
  const proof = linearRatio(String(item.proof ?? "").trim().length, 0, 24);
  const scopeLevel =
    item.scope === "international"
      ? 1
      : item.scope === "national"
        ? 0.88
        : item.scope === "state"
          ? 0.68
          : item.scope === "regional"
            ? 0.52
            : item.scope === "local"
              ? 0.36
              : item.scope === "school"
                ? 0.22
                : 0;
  const kind = item.kind === "research" || item.kind === "competition" ? 1 : item.kind ? 0.4 : 0;
  const blob = [item.name, item.role, item.description, item.outcome, item.award].join(" ");
  const lead = /lead|chair|captain|founder|president|主席|队长|创始人|负责人/i.test(blob) ? 1 : 0;
  const quality =
    name * 0.1 +
    role * 0.1 +
    desc * 0.34 +
    outcome * 0.16 +
    hours * 0.05 +
    proof * 0.07 +
    scopeLevel * 0.1 +
    kind * 0.04 +
    lead * 0.04;
  return clampScore(quality, 0, 1);
}

function combinedActivityText(body) {
  return meaningfulStructuredActivities(body)
    .map((item) =>
      [item.name, item.kind, item.role, item.description, item.outcome, item.award, item.scope, item.hours, item.proof]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n");
}

function scoreActivities(body) {
  const structured = meaningfulStructuredActivities(body);
  const combined = combinedActivityText(body);
  if (!combined.trim() && structured.length === 0) return 38;

  const volumeRaw = linearRatio(combined.length, 0, 260);
  const breadth = linearRatio(structured.length, 0, 4);
  const depth =
    structured.length > 0
      ? structured.reduce((sum, item) => sum + activityItemDepthNorm(item), 0) / structured.length
      : volumeRaw * 0.5;
  const signal = ACTIVITY_LEADERSHIP_RE.test(combined) ? 1 : 0;
  const volume = volumeRaw * (0.35 + depth * 0.65);

  let quality = clampScore(volume * 0.34 + breadth * 0.26 + depth * 0.28 + signal * 0.12, 0, 1);
  if (combined.length > 320 && depth < 0.32 && structured.length < 2) quality = Math.min(quality, 0.52);
  return Math.round(clampScore(scoreFromRatio(quality, 38, 92), 38, 92));
}

function gpaRigorSignalQuality(g) {
  if (!g.trim()) return 0;
  const hasRigor =
    /rank|排名|top|前\s*\d|%\s*|\bUW\b|\bW\b|unweighted|weighted|未加权|加权|AP|IB|honors|honour|a-?level|course|课程|rigor|difficult|honors/i.test(
      g,
    )
      ? 1
      : 0;
  const hasRank = /rank|排名|top\s*\d|前\s*\d|percentile|decile|堂|T[1-3]/i.test(g) ? 1 : 0;
  const hasTrend = /上升|下滑|trend|improv|declin|junior|senior|11\s*年级|12\s*年级|year\s*\d/i.test(g) ? 1 : 0;
  return clampScore(hasRigor * 0.62 + hasRank * 0.24 + hasTrend * 0.14, 0, 1);
}

function scoreRigor(body) {
  const school = String(body?.currentHighSchool ?? "").trim();
  const system = body?.highSchoolSystem;
  const schoolNorm = school ? linearRatio(school.length, 3, 28) : 0;
  const systemNorm = system ? 1 : 0;
  const courseSignals = gpaRigorSignalQuality(String(body?.gpa ?? ""));
  const specialBoost = (Array.isArray(body?.academicSpecialFlags) ? body.academicSpecialFlags : []).length > 0 ? 0.08 : 0;
  const trendBoost =
    body?.gpaTrend === "upward" ? 0.06 : body?.gpaTrend === "stable" ? 0.03 : body?.gpaTrend === "downward" ? 0.01 : 0;

  let quality = clampScore(schoolNorm * 0.32 + systemNorm * 0.24 + courseSignals * 0.36 + specialBoost + trendBoost, 0, 1);
  if (!school && system) quality = Math.min(quality, 0.58);
  if (!school && !system) quality = Math.min(quality, 0.4);
  return Math.round(clampScore(scoreFromRatio(quality, 34, 92), 34, 92));
}

function scoreStrategy(body) {
  const riskBase =
    body?.riskStyle === "balanced"
      ? 0.72
      : body?.riskStyle === "aggressive"
        ? 0.7
        : body?.riskStyle === "conservative"
          ? 0.68
          : 0.42;
  const geoPrefs = Array.isArray(body?.geoPrefs) ? body.geoPrefs : [];
  const filled = [
    Boolean(body?.budget),
    geoPrefs.length > 0,
    String(body?.dealbreakers ?? "").trim().length > 3,
    Boolean(body?.schoolSize),
    Boolean(body?.campusCulturePref),
  ].filter(Boolean).length;
  const completeness = linearRatio(filled, 0, 5);
  const geoBreadth = linearRatio(geoPrefs.length, 0, 4);
  const dealbreakers =
    String(body?.dealbreakers ?? "").trim().length > 12 ? 1 : linearRatio(String(body?.dealbreakers ?? "").trim().length, 0, 12);
  const quality = clampScore(riskBase * 0.55 + completeness * 0.25 + geoBreadth * 0.1 + dealbreakers * 0.1, 0, 1);
  return Math.round(clampScore(scoreFromRatio(quality, 36, 90), 36, 90));
}

/** @typedef {"academic"|"testing"|"activities"|"rigor"|"strategy"} ProfileDimensionKey */

/** @returns {Record<ProfileDimensionKey, number>} */
export function scoreFiveDimensions(body) {
  return {
    academic: scoreAcademic(body),
    testing: scoreTesting(body),
    activities: scoreActivities(body),
    rigor: scoreRigor(body),
    strategy: scoreStrategy(body),
  };
}

/** Weighted composite 0–100 for tier-gap vs school selectivity. */
export function profileCompositeScore(scores) {
  return (
    scores.academic * 0.26 +
    scores.testing * 0.22 +
    scores.activities * 0.2 +
    scores.rigor * 0.18 +
    scores.strategy * 0.14
  );
}
