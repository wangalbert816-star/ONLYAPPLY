#!/usr/bin/env node
/** One-time import of benchmarks-draft/live JSON into Supabase. */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseAdmin } from "../server/supabaseAdmin.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = join(root, "data/engine");

function readJsonArray(file) {
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function entryToRow(entry, tier) {
  return {
    tier,
    source_case_key: entry.sourceCaseKey,
    title: entry.title ?? entry.sourceCaseKey,
    profile: entry.profile ?? {},
    approved_schools: entry.approvedSchools ?? {},
    review_feedback: entry.reviewFeedback ?? null,
    notes: entry.notes ?? entry.approvedSchools?.notes ?? null,
    updated_at: entry.updatedAt ?? new Date().toISOString(),
    updated_by: entry.updatedBy ?? null,
  };
}

const sb = supabaseAdmin();
if (!sb) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
  process.exit(1);
}

const draft = readJsonArray(join(engineDir, "benchmarks-draft.json"));
const live = readJsonArray(join(engineDir, "benchmarks-live.json"));
const rows = [
  ...draft.map((e) => entryToRow(e, "draft")),
  ...live.map((e) => entryToRow(e, "live")),
];

if (!rows.length) {
  console.log("No benchmark JSON rows to import.");
  process.exit(0);
}

const { error } = await sb.from("engine_benchmarks").upsert(rows, { onConflict: "tier,source_case_key" });
if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}

console.log(`Imported ${rows.length} benchmark row(s) (${draft.length} draft, ${live.length} live).`);
