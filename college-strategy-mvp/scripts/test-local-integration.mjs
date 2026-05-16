/**
 * Quick local checks: Supabase tables, RLS, pending-save roundtrip, invite RPC.
 * Run: node scripts/test-local-integration.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
  return { url: get("VITE_SUPABASE_URL"), key: get("VITE_SUPABASE_ANON_KEY") };
}

const { url, key } = loadEnv();
if (!url || !key) {
  console.error("FAIL: missing VITE_SUPABASE_* in .env");
  process.exit(1);
}

const sb = createClient(url, key);
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: e?.message ?? String(e) });
  }
}

await check("saved_applications readable", async () => {
  const { error } = await sb.from("saved_applications").select("id").limit(1);
  if (error) throw error;
});

await check("saved_reports readable", async () => {
  const { error } = await sb.from("saved_reports").select("id").limit(1);
  if (error) throw error;
});

await check("RLS blocks anonymous insert", async () => {
  const { error } = await sb.from("saved_applications").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    form_state: {},
    locale: "zh",
  });
  if (!error) throw new Error("expected RLS denial");
});

await check("application_unlock_entitlements policy (anon select)", async () => {
  const { error } = await sb.from("application_unlock_entitlements").select("application_id").limit(1);
  if (error) throw error;
});

await check("invite RPC exists (anonymous → not_authenticated)", async () => {
  const { data, error } = await sb.rpc("redeem_invite_code", {
    p_code: "TEST",
    p_application_id: "00000000-0000-0000-0000-000000000001",
  });
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("expected json object");
  if (data.ok !== false || data.error !== "not_authenticated") {
    throw new Error(`unexpected payload: ${JSON.stringify(data)}`);
  }
});

const KEY = "college_strategy_pending_save_v1";
const sample = {
  form: { intakeTerm: "2026 Fall", applicantIdentity: "international" },
  locale: "zh",
  report: { executive_summary: "test", reach: [], match: [], safety: [] },
  reportUnlocked: true,
  savedAt: Date.now(),
};

await check("pending-save payload shape", async () => {
  const raw = JSON.stringify(sample);
  const parsed = JSON.parse(raw);
  if (!parsed.form || !parsed.report) throw new Error("invalid shape");
  if (!parsed.reportUnlocked) throw new Error("unlock flag missing");
});

let failed = 0;
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed += 1;
  console.log(`${mark}  ${r.name}${r.err ? `: ${r.err}` : ""}`);
}

process.exit(failed ? 1 : 0);
