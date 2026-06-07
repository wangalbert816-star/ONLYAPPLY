#!/usr/bin/env node
/**
 * Merge eval harness JSON exports, pick the best submitted review per case,
 * normalize school/note fields, and refresh scripts/eval-seed-cases.json.
 *
 * Usage:
 *   node scripts/merge-eval-review-export.mjs path/to/export1.json [export2.json ...]
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = join(root, "scripts/eval-seed-cases.json");
const outPath = join(root, "scripts/eval-reviewed-export.json");

const NOTE_SUFFIX = /^(.+?)[（(](.+?)[）)]\s*$/;

function parseSchoolEntry(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const m = text.match(NOTE_SUFFIX);
  if (m) {
    return { school: m[1].trim(), note: m[2].trim() };
  }
  return { school: text };
}

function normalizeTier(raw, limit = 3) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    let entry = null;
    if (typeof item === "string") {
      entry = parseSchoolEntry(item);
    } else if (item && typeof item === "object") {
      const school = String(item.school ?? "").trim();
      if (!school) continue;
      const parsed = parseSchoolEntry(school);
      const note = String(item.note ?? parsed?.note ?? "").trim();
      entry = note ? { school: parsed?.school ?? school, note } : { school: parsed?.school ?? school };
    }
    if (entry?.school) out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

function reviewCompleteness(entry) {
  const review = entry.review ?? {};
  let far = review.finalApprovedRecommendation;
  if (typeof far === "string") {
    try {
      far = JSON.parse(far);
    } catch {
      far = null;
    }
  }
  if (!far || typeof far !== "object") return 0;
  return (
    normalizeTier(far.reach).length +
    normalizeTier(far.match).length +
    normalizeTier(far.safety).length
  );
}

function pickBestEntries(allEntries) {
  const best = new Map();
  for (const entry of allEntries) {
    const caseKey = entry?.case?.caseKey;
    if (!caseKey) continue;
    const score = reviewCompleteness(entry);
    const prev = best.get(caseKey);
    if (!prev || score > prev.score) {
      best.set(caseKey, { score, entry });
    }
  }
  return [...best.values()]
    .sort((a, b) => a.entry.case.caseKey.localeCompare(b.entry.case.caseKey))
    .map(({ entry }) => entry);
}

/** Preserve useful seed notes when review drops them but schools match. */
function mergeTierNotes(reviewTier, seedTier) {
  const seedBySchool = new Map(
    (seedTier ?? []).map((row) => [String(row.school ?? "").trim().toLowerCase(), row]),
  );
  return reviewTier.map((row) => {
    const seed = seedBySchool.get(row.school.toLowerCase());
    if (seed?.note && !row.note) {
      return { ...row, note: seed.note };
    }
    return row;
  });
}

function loadExports(paths) {
  const entries = [];
  for (const p of paths) {
    const data = JSON.parse(readFileSync(p, "utf8"));
    if (Array.isArray(data)) {
      entries.push(...data);
      continue;
    }
    if (Array.isArray(data.entries)) entries.push(...data.entries);
  }
  return entries;
}

const inputPaths = process.argv.slice(2);
if (inputPaths.length === 0) {
  console.error("Provide at least one eval export JSON path.");
  process.exit(1);
}

const bestEntries = pickBestEntries(loadExports(inputPaths));
const seedCases = JSON.parse(readFileSync(seedPath, "utf8"));
const seedByKey = new Map(seedCases.map((c) => [c.caseKey, c]));

const optimizedEntries = [];
const updatedKeys = [];

for (const entry of bestEntries) {
  const caseKey = entry.case.caseKey;
  const review = entry.review ?? {};
  let far = review.finalApprovedRecommendation;
  if (typeof far === "string") {
    try {
      far = JSON.parse(far);
    } catch {
      far = null;
    }
  }
  if (!far || review.status !== "submitted") continue;

  const seed = seedByKey.get(caseKey);
  if (!seed) continue;

  const nextReach = mergeTierNotes(normalizeTier(far.reach), seed.expectedReach);
  const nextMatch = mergeTierNotes(normalizeTier(far.match), seed.expectedMatch);
  const nextSafety = mergeTierNotes(normalizeTier(far.safety), seed.expectedSafety);

  const changed =
    JSON.stringify(seed.expectedReach) !== JSON.stringify(nextReach) ||
    JSON.stringify(seed.expectedMatch) !== JSON.stringify(nextMatch) ||
    JSON.stringify(seed.expectedSafety) !== JSON.stringify(nextSafety);

  if (changed) {
    seed.expectedReach = nextReach;
    seed.expectedMatch = nextMatch;
    seed.expectedSafety = nextSafety;
    updatedKeys.push(caseKey);
  }

  optimizedEntries.push({
    caseKey,
    title: seed.title,
    reviewStatus: review.status,
    expectedReach: nextReach,
    expectedMatch: nextMatch,
    expectedSafety: nextSafety,
    notes: seed.notes ?? null,
    runLabel: entry.run?.label ?? null,
    exportedReview: {
      status: review.status,
      finalApprovedRecommendation: {
        reach: nextReach,
        match: nextMatch,
        safety: nextSafety,
        notes: seed.notes ?? null,
      },
    },
  });
}

writeFileSync(seedPath, `${JSON.stringify(seedCases, null, 2)}\n`, "utf8");
writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      mergedAt: new Date().toISOString(),
      sourceFiles: inputPaths.map((p) => p.split("/").pop()),
      updatedCaseKeys: updatedKeys,
      entries: optimizedEntries,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Merged ${bestEntries.length} reviewed case(s) from ${inputPaths.length} file(s).`);
console.log(`Updated seed keys: ${updatedKeys.length ? updatedKeys.join(", ") : "(none)"}`);
console.log(`Wrote ${seedPath}`);
console.log(`Wrote ${outPath}`);
