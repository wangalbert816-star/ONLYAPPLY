#!/usr/bin/env node
/**
 * Seed report eval golden cases into Supabase (upsert by case_key).
 *
 * Requires in college-strategy-mvp/.env:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/seed-eval-cases.mjs
 *   node scripts/seed-eval-cases.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

function loadDotEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
  }
}

loadDotEnv();

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

function normalizeExpectedSchools(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const school = String(item.school ?? "").trim();
      if (!school) return null;
      const note = String(item.note ?? "").trim();
      return note ? { school, note } : { school };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeCase(raw) {
  const caseKey = String(raw.caseKey ?? raw.case_key ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const reportBody = raw.reportBody ?? raw.report_body;
  if (!caseKey || !title || !reportBody || typeof reportBody !== "object") {
    throw new Error(`Invalid case: ${caseKey || "(missing key)"}`);
  }
  const locale = reportBody.locale === "en" ? "en" : "zh";
  return {
    case_key: caseKey,
    title,
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
    locale,
    report_body: reportBody,
    expected_reach: normalizeExpectedSchools(raw.expectedReach ?? raw.expected_reach),
    expected_match: normalizeExpectedSchools(raw.expectedMatch ?? raw.expected_match),
    expected_safety: normalizeExpectedSchools(raw.expectedSafety ?? raw.expected_safety),
    forbidden_schools: Array.isArray(raw.forbiddenSchools ?? raw.forbidden_schools)
      ? (raw.forbiddenSchools ?? raw.forbidden_schools).map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [],
    notes: String(raw.notes ?? "").trim() || null,
    active: raw.active !== false,
    created_by: "seed-eval-cases.mjs",
    updated_at: new Date().toISOString(),
  };
}

const seedPath = join(root, "scripts/eval-seed-cases.json");
const items = JSON.parse(readFileSync(seedPath, "utf8"));
const payloads = items.map(normalizeCase);

if (dryRun) {
  console.log(`Dry run: would upsert ${payloads.length} cases:`);
  for (const p of payloads) console.log(`  - ${p.case_key}: ${p.title}`);
  process.exit(0);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ok = 0;
let failed = 0;

for (const payload of payloads) {
  const { data, error } = await admin
    .from("report_eval_cases")
    .upsert(payload, { onConflict: "case_key" })
    .select("case_key, title")
    .single();

  if (error) {
    failed += 1;
    console.error(`FAIL ${payload.case_key}:`, error.message);
    continue;
  }
  ok += 1;
  console.log(`OK   ${data.case_key}: ${data.title}`);
}

console.log("");
console.log(`Done. ${ok} upserted, ${failed} failed.`);

if (failed > 0) {
  console.error("Did you run supabase/schema-report-eval.sql in Supabase SQL Editor?");
  process.exit(1);
}
