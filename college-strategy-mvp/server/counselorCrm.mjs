/** Counselor CRM snapshot — service_role read after JWT verify (fixes collaborator RLS gaps). */

import { loadCrmSnapshotForEngagementRows, mapCounselor } from "./crmSnapshotMaps.mjs";

function bearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

/**
 * Resolve counselors row for logged-in auth user. Links user_id by email when missing.
 * @returns {Promise<{ counselor: object, linkedAuth: boolean } | null>}
 */
export async function resolveCounselorForAuthUser(admin, user) {
  if (!user?.id) return null;

  const selectCols = "id, user_id, name, title, bio, email, calendly_url, active";

  const { data: byUser, error: userErr } = await admin
    .from("counselors")
    .select(selectCols)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (userErr) throw userErr;
  if (byUser) return { counselor: byUser, linkedAuth: true };

  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  const { data: byEmailRows, error: emailErr } = await admin
    .from("counselors")
    .select(selectCols)
    .ilike("email", email)
    .eq("active", true);
  if (emailErr) throw emailErr;

  const matches = (byEmailRows ?? []).filter(
    (r) => String(r.email ?? "").trim().toLowerCase() === email,
  );
  if (matches.length !== 1) return null;

  const counselor = matches[0];
  let linkedAuth = false;
  if (!counselor.user_id) {
    const { error: linkErr } = await admin
      .from("counselors")
      .update({ user_id: user.id })
      .eq("id", counselor.id)
      .is("user_id", null);
    if (!linkErr) {
      counselor.user_id = user.id;
      linkedAuth = true;
    }
  }

  return { counselor, linkedAuth };
}

export async function loadCounselorCrmSnapshot(admin, counselorId) {
  const engagementIdSet = new Set();

  const { data: collabs, error: collabErr } = await admin
    .from("engagement_counselors")
    .select("engagement_id")
    .eq("counselor_id", counselorId)
    .eq("active", true);
  if (collabErr) throw collabErr;
  for (const row of collabs ?? []) {
    if (row.engagement_id) engagementIdSet.add(String(row.engagement_id));
  }

  const { data: primaryRows, error: primaryErr } = await admin
    .from("engagements")
    .select("id")
    .eq("counselor_id", counselorId);
  if (primaryErr) throw primaryErr;
  for (const row of primaryRows ?? []) {
    if (row.id) engagementIdSet.add(String(row.id));
  }

  const engagementIds = [...engagementIdSet];
  if (engagementIds.length === 0) {
    const { data: counselorRow, error: cErr } = await admin
      .from("counselors")
      .select("id, user_id, name, title, bio, email, calendly_url")
      .eq("id", counselorId)
      .maybeSingle();
    if (cErr) throw cErr;
    return {
      snapshot: {
        counselors: counselorRow ? [mapCounselor(counselorRow)] : [],
        engagements: [],
        messages: [],
        tasks: [],
        documents: [],
        files: [],
        meetingRecaps: [],
      },
      engagementIds: [],
    };
  }

  const { data: engagementRows, error: engErr } = await admin
    .from("engagements")
    .select("*")
    .in("id", engagementIds)
    .order("updated_at", { ascending: false });
  if (engErr) throw engErr;

  const snapshot = await loadCrmSnapshotForEngagementRows(admin, engagementRows ?? []);
  if (!snapshot.counselors.some((c) => c.id === counselorId)) {
    const { data: counselorRow, error: cErr } = await admin
      .from("counselors")
      .select("id, user_id, name, title, bio, email, calendly_url")
      .eq("id", counselorId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (counselorRow) snapshot.counselors = [mapCounselor(counselorRow), ...snapshot.counselors];
  }

  return { snapshot, engagementIds };
}

/**
 * @param {import("express").Express} app
 * @param {{ supabaseAdmin: () => import("@supabase/supabase-js").SupabaseClient | null }} deps
 */
export function registerCounselorCrmRoutes(app, { supabaseAdmin }) {
  app.get("/api/counselor/crm/snapshot", async (req, res) => {
    const admin = supabaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: "supabase_admin_missing" });
    }

    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "auth_required" });
    }

    try {
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData.user) {
        return res.status(401).json({ error: "invalid_session" });
      }

      const resolved = await resolveCounselorForAuthUser(admin, userData.user);
      if (!resolved) {
        return res.status(403).json({ error: "counselor_not_found" });
      }

      const { snapshot, engagementIds } = await loadCounselorCrmSnapshot(admin, resolved.counselor.id);

      res.json({
        counselor: mapCounselor(resolved.counselor),
        linkedAuth: resolved.linkedAuth,
        engagementIds,
        snapshot,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });
}
