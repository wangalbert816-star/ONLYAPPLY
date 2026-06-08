#!/usr/bin/env node
/**
 * Seed data/training-corpus/gold-cases.jsonl from eval-reviewed-export + eval-seed-cases.
 *
 * Usage: node scripts/seed-training-corpus.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertGoldCaseFromEval } from "../server/trainingCorpus.mjs";
import { REPORT_PROMPT_VERSION } from "../server/evalConstants.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = join(root, "scripts/eval-seed-cases.json");
const reviewedPath = join(root, "scripts/eval-reviewed-export.json");

const seedCases = JSON.parse(readFileSync(seedPath, "utf8"));
const reviewed = JSON.parse(readFileSync(reviewedPath, "utf8"));
const entries = reviewed.entries ?? [];

const seedByKey = new Map(seedCases.map((c) => [c.caseKey, c]));
let ok = 0;
let skipped = 0;

for (const entry of entries) {
  const caseKey = entry.caseKey;
  const seed = seedByKey.get(caseKey);
  if (!seed) {
    skipped += 1;
    continue;
  }
  const far = entry.exportedReview?.finalApprovedRecommendation ?? {
    reach: entry.expectedReach,
    match: entry.expectedMatch,
    safety: entry.expectedSafety,
    notes: entry.notes,
  };
  const out = upsertGoldCaseFromEval({
    evalCase: {
      caseKey: seed.caseKey,
      title: seed.title,
      tags: seed.tags ?? [],
      reportBody: seed.reportBody,
    },
    review: {
      status: entry.reviewStatus ?? "submitted",
      finalApprovedRecommendation: far,
      overallNotes: entry.notes ?? null,
      reviewedBy: "seed-script",
      submittedAt: reviewed.mergedAt ?? new Date().toISOString(),
    },
    result: null,
    run: { promptVersion: REPORT_PROMPT_VERSION },
  });
  if (out.ok) ok += 1;
  else skipped += 1;
}

console.log(`Seeded ${ok} gold case(s), skipped ${skipped}.`);
console.log(`Corpus file: data/training-corpus/gold-cases.jsonl`);
