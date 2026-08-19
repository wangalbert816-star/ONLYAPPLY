/**
 * Engine benchmarks — Supabase primary store with JSON file fallback for local dev.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseAdmin } from "./supabaseAdmin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.join(__dirname, "..", "data", "engine");
const DRAFT_FILE = path.join(ENGINE_DIR, "benchmarks-draft.json");
const LIVE_FILE = path.join(ENGINE_DIR, "benchmarks-live.json");
const LOG_FILE = path.join(ENGINE_DIR, "publish-log.json");

const CACHE_TTL_MS = 30_000;

/** @type {object[] | null} */
let draftCache = null;
/** @type {object[] | null} */
let liveCache = null;
/** @type {string | null} */
let lastPublishedAt = null;
/** @type {"supabase" | "file" | "file_fallback" | null} */
let storageSource = null;
let cacheLoadedAt = 0;
/** @type {Promise<void> | null} */
let loadPromise = null;

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

function rowToEntry(row) {
  return {
    id: row.source_case_key,
    sourceCaseKey: row.source_case_key,
    title: row.title ?? row.source_case_key,
    profile: row.profile ?? {},
    approvedSchools: row.approved_schools ?? {},
    reviewFeedback: row.review_feedback ?? null,
    notes: row.notes ?? null,
    updatedAt: row.updated_at ?? new Date().toISOString(),
    updatedBy: row.updated_by ?? null,
  };
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

function sortEntries(entries) {
  return [...entries].sort((a, b) => String(a.sourceCaseKey).localeCompare(String(b.sourceCaseKey)));
}

function loadFromJsonFiles() {
  draftCache = readJsonArray(DRAFT_FILE);
  liveCache = readJsonArray(LIVE_FILE);
  const log = readJsonArray(LOG_FILE);
  lastPublishedAt = log[0]?.publishedAt ?? null;
  storageSource = "file";
  cacheLoadedAt = Date.now();
}

function hasLoadedCache() {
  return draftCache !== null && liveCache !== null;
}

function loadFromJsonFallback() {
  loadFromJsonFiles();
  storageSource = "file_fallback";
}

function keepWarmCacheAfterSupabaseFailure(reason, err) {
  if (!hasLoadedCache()) return false;
  const msg = err?.message ?? String(err ?? "");
  console.warn(`[engine-benchmarks] ${reason}_using_warm_cache`, msg);
  cacheLoadedAt = Date.now();
  return true;
}

async function seedJsonToSupabaseIfEmpty(sb) {
  const draft = readJsonArray(DRAFT_FILE);
  const live = readJsonArray(LIVE_FILE);
  if (!draft.length && !live.length) return false;

  const rows = [
    ...draft.map((e) => entryToRow(e, "draft")),
    ...live.map((e) => entryToRow(e, "live")),
  ];
  let { error } = await sb.from("engine_benchmarks").upsert(rows, { onConflict: "tier,source_case_key" });
  if (error && isSchemaColumnMissingError(error, "review_feedback")) {
    const legacyRows = rows.map(({ review_feedback: _rf, ...rest }) => rest);
    ({ error } = await sb.from("engine_benchmarks").upsert(legacyRows, { onConflict: "tier,source_case_key" }));
  }
  if (error) throw error;

  const log = readJsonArray(LOG_FILE);
  if (log[0]) {
    await sb.from("engine_benchmark_publish_log").insert({
      published_at: log[0].publishedAt ?? new Date().toISOString(),
      published_by: log[0].publishedBy ?? "json-import",
      entry_count: log[0].entryCount ?? live.length,
    });
  }
  console.info(`[engine-benchmarks] seeded ${rows.length} row(s) from JSON into Supabase`);
  return true;
}

function isSchemaColumnMissingError(err, column = "") {
  const msg = err?.message ?? String(err ?? "");
  if (!/PGRST204|Could not find the .* column/i.test(msg)) return false;
  if (column && !msg.includes(column)) return false;
  return true;
}

async function loadFromSupabase(sb, forceReseed = false) {
  if (!forceReseed) {
    const { count, error: countErr } = await sb
      .from("engine_benchmarks")
      .select("*", { count: "exact", head: true });
    if (countErr) {
      if (/does not exist|relation|engine_benchmarks/i.test(countErr.message)) {
        if (keepWarmCacheAfterSupabaseFailure("supabase_schema_unavailable", countErr)) return;
        loadFromJsonFallback();
        return;
      }
      throw countErr;
    }
    if ((count ?? 0) === 0) {
      const seeded = await seedJsonToSupabaseIfEmpty(sb);
      if (seeded) return loadFromSupabase(sb, true);
    }
  }

  const { data, error } = await sb
    .from("engine_benchmarks")
    .select("*")
    .order("source_case_key", { ascending: true });
  if (error) {
    if (isSchemaColumnMissingError(error, "review_feedback")) {
      if (keepWarmCacheAfterSupabaseFailure("supabase_schema_unavailable", error)) return;
      loadFromJsonFallback();
      return;
    }
    throw error;
  }

  draftCache = sortEntries((data ?? []).filter((r) => r.tier === "draft").map(rowToEntry));
  liveCache = sortEntries((data ?? []).filter((r) => r.tier === "live").map(rowToEntry));

  const { data: logRow, error: logErr } = await sb
    .from("engine_benchmark_publish_log")
    .select("published_at")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (logErr && !/does not exist|relation/i.test(logErr.message)) throw logErr;
  lastPublishedAt = logRow?.published_at ?? null;

  storageSource = "supabase";
  cacheLoadedAt = Date.now();
}

/** Load benchmarks from Supabase (or JSON fallback). Safe to call repeatedly. */
export async function ensureBenchmarksLoaded(force = false) {
  if (!force && draftCache !== null && liveCache !== null && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return { source: storageSource };
  }
  if (loadPromise && !force) {
    await loadPromise;
    return { source: storageSource };
  }

  loadPromise = (async () => {
    const sb = supabaseAdmin();
    if (!sb) {
      loadFromJsonFiles();
      return;
    }
    try {
      await loadFromSupabase(sb);
    } catch (e) {
      if (!keepWarmCacheAfterSupabaseFailure("supabase_load_failed", e)) {
        console.warn("[engine-benchmarks] supabase_load_failed", e instanceof Error ? e.message : e);
        loadFromJsonFallback();
      }
    }
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
  return { source: storageSource };
}

export function getBenchmarkStorageSource() {
  return storageSource;
}

export function listDraftBenchmarksCached() {
  return draftCache ?? readJsonArray(DRAFT_FILE);
}

export function listLiveBenchmarksCached() {
  return liveCache ?? readJsonArray(LIVE_FILE);
}

export function getLastPublishedAt() {
  return lastPublishedAt;
}

function setDraftCache(entries) {
  draftCache = sortEntries(entries);
}

function setLiveCache(entries) {
  liveCache = sortEntries(entries);
}

async function upsertTierEntry(entry, tier) {
  const sb = supabaseAdmin();
  if (sb) {
    let { error } = await sb
      .from("engine_benchmarks")
      .upsert(entryToRow(entry, tier), { onConflict: "tier,source_case_key" });
    if (error && isSchemaColumnMissingError(error, "review_feedback")) {
      const { review_feedback: _rf, ...legacyRow } = entryToRow(entry, tier);
      ({ error } = await sb
        .from("engine_benchmarks")
        .upsert(legacyRow, { onConflict: "tier,source_case_key" }));
    }
    if (error) throw error;
    return;
  }

  const file = tier === "live" ? LIVE_FILE : DRAFT_FILE;
  const list = readJsonArray(file);
  const idx = list.findIndex((r) => r.sourceCaseKey === entry.sourceCaseKey);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  writeJsonArray(file, sortEntries(list));
}

/** @param {object} entry @param {("draft"|"live")[]} tiers */
export async function persistBenchmarkEntry(entry, tiers) {
  await ensureBenchmarksLoaded(true);

  for (const tier of tiers) {
    await upsertTierEntry(entry, tier);
  }

  if (tiers.includes("draft")) {
    const draft = listDraftBenchmarksCached();
    const idx = draft.findIndex((r) => r.sourceCaseKey === entry.sourceCaseKey);
    if (idx >= 0) draft[idx] = entry;
    else draft.push(entry);
    setDraftCache(draft);
  }
  if (tiers.includes("live")) {
    const live = listLiveBenchmarksCached();
    const idx = live.findIndex((r) => r.sourceCaseKey === entry.sourceCaseKey);
    if (idx >= 0) live[idx] = entry;
    else live.push(entry);
    setLiveCache(live);
  }

  return { storageSource: storageSource ?? getBenchmarkStorageSource() };
}

export async function publishDraftBenchmarksToLive(reviewerEmail) {
  const loadState = await ensureBenchmarksLoaded(true);
  const sb = supabaseAdmin();
  if (sb && loadState.source === "file_fallback") {
    return { ok: false, reason: "benchmark_store_unavailable" };
  }

  const draft = listDraftBenchmarksCached();
  if (!draft.length) return { ok: false, reason: "draft_empty" };

  const publishedAt = new Date().toISOString();

  if (sb) {
    const draftKeys = new Set(draft.map((e) => e.sourceCaseKey));
    const liveRows = draft.map((e) => entryToRow(e, "live"));
    const { error: upsertErr } = await sb
      .from("engine_benchmarks")
      .upsert(liveRows, { onConflict: "tier,source_case_key" });
    if (upsertErr) throw upsertErr;

    const { data: existingLive } = await sb
      .from("engine_benchmarks")
      .select("source_case_key")
      .eq("tier", "live");
    const stale = (existingLive ?? []).filter((r) => !draftKeys.has(r.source_case_key));
    if (stale.length) {
      const { error: delErr } = await sb
        .from("engine_benchmarks")
        .delete()
        .eq("tier", "live")
        .in(
          "source_case_key",
          stale.map((r) => r.source_case_key),
        );
      if (delErr) throw delErr;
    }

    const { error: logErr } = await sb.from("engine_benchmark_publish_log").insert({
      published_at: publishedAt,
      published_by: reviewerEmail ?? null,
      entry_count: draft.length,
    });
    if (logErr && !/does not exist|relation/i.test(logErr.message)) throw logErr;
  } else {
    writeJsonArray(LIVE_FILE, draft);
    const log = readJsonArray(LOG_FILE);
    log.unshift({
      publishedAt,
      publishedBy: reviewerEmail ?? null,
      entryCount: draft.length,
    });
    writeJsonArray(LOG_FILE, log.slice(0, 20));
  }

  setLiveCache(draft);
  lastPublishedAt = publishedAt;
  cacheLoadedAt = Date.now();

  return { ok: true, liveCount: draft.length, publishedAt, storageSource: storageSource ?? getBenchmarkStorageSource() };
}
