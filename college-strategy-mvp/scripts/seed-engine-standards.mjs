#!/usr/bin/env node
/** Seed engine draft standards from training gold-cases.jsonl */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertBenchmarkToLiveFromReview } from "../server/engineStandards.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const goldPath = join(root, "data/training-corpus/gold-cases.jsonl");

const lines = readFileSync(goldPath, "utf8").split("\n").filter((l) => l.trim());
let n = 0;
for (const line of lines) {
  const row = JSON.parse(line);
  const out = upsertBenchmarkToLiveFromReview({
    evalCase: {
      caseKey: row.caseKey,
      title: row.title,
      tags: row.tags ?? [],
      reportBody: row.reportBody,
    },
    review: {
      status: "submitted",
      finalApprovedRecommendation: row.approvedSchools,
      overallNotes: row.overallNotes,
    },
    reviewerEmail: "seed-script",
  });
  if (out.ok) n += 1;
}
console.log(`Seeded ${n} engine draft standard(s) from gold cases.`);
