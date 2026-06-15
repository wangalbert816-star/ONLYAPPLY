/** Shared Supabase service-role client for server routes. */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = (process.env.SUPABASE_URL || "").trim() || (process.env.VITE_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function supabaseConfigured() {
  return Boolean(supabaseAdmin());
}
