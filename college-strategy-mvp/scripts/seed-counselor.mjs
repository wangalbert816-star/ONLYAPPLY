#!/usr/bin/env node
/**
 * One-time local setup: create counselor Auth user + counselors row.
 *
 * Requires in college-strategy-mvp/.env (or env):
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   COUNSELOR_EMAIL=weiyiwang603@gmail.com COUNSELOR_PASSWORD='your-password' node scripts/seed-counselor.mjs
 *
 * Get service role key: Supabase → Project Settings → API → service_role (never commit).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
const email = (process.env.COUNSELOR_EMAIL || "weiyiwang603@gmail.com").trim();
const password = (process.env.COUNSELOR_PASSWORD || "").trim();
const name = (process.env.COUNSELOR_NAME || "王老师").trim();
const title = (process.env.COUNSELOR_TITLE || "首席留学顾问").trim();

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!password) {
  console.error("Set COUNSELOR_PASSWORD in the environment (do not commit passwords to git).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

let userId = created.user?.id;

if (createErr) {
  const msg = createErr.message || "";
  if (!/already|registered|exists/i.test(msg)) {
    console.error("createUser failed:", createErr.message);
    process.exit(1);
  }
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("User may exist but listUsers failed:", listErr.message);
    process.exit(1);
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    console.error("User exists message but could not find user by email.");
    process.exit(1);
  }
  userId = existing.id;
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateErr) {
    console.error("updateUserById (password) failed:", updateErr.message);
    process.exit(1);
  }
  console.log("User already existed; password updated.");
}

if (!userId) {
  console.error("No user id");
  process.exit(1);
}

const { data: existingCounselor } = await admin
  .from("counselors")
  .select("id")
  .eq("user_id", userId)
  .maybeSingle();

if (existingCounselor) {
  const { error: updErr } = await admin
    .from("counselors")
    .update({ name, title, email, active: true })
    .eq("id", existingCounselor.id);
  if (updErr) {
    console.error("counselors update failed:", updErr.message);
    process.exit(1);
  }
  console.log("Counselor row already linked; profile updated.");
} else {
  const { error: insErr } = await admin.from("counselors").insert({
    user_id: userId,
    name,
    title,
    email,
    active: true,
  });
  if (insErr) {
    console.error("counselors insert failed:", insErr.message);
    console.error("Did you run supabase/schema-crm.sql in SQL Editor?");
    process.exit(1);
  }
  console.log("Counselor row created.");
}

console.log("");
console.log("Done.");
console.log("  Email:", email);
console.log("  User ID:", userId);
console.log("  Login: http://localhost:5173/#counselor");
