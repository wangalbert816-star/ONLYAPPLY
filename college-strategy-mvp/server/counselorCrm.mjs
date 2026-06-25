/** Counselor CRM snapshot — service_role read after JWT verify (fixes collaborator RLS gaps). */

import { loadCrmSnapshotForEngagementRows, mapCounselor } from "./crmSnapshotMaps.mjs";

function bearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

/**
 * Resolve counselors row for logged-in auth user.
 * Counselor Auth links are created by admin provisioning; never claim rows by email at request time.
 * @returns {Promise<{ counselor: object, linkedAuth: boolean } | null>}
 */
export async function resolveCounselorForAuthUser(admin, user) {
  if (!user?.id) return null;

  const selectCols = "id, user_id, name, title, bio, email, calendly_url, meeting_url, active";

  const { data: byUser, error: userErr } = await admin
    .from("counselors")
    .select(selectCols)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (userErr) throw userErr;
  if (byUser) return { counselor: byUser, linkedAuth: true };
  return null;
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
      .select("id, user_id, name, title, bio, email, calendly_url, meeting_url")
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
      .select("id, user_id, name, title, bio, email, calendly_url, meeting_url")
      .eq("id", counselorId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (counselorRow) snapshot.counselors = [mapCounselor(counselorRow), ...snapshot.counselors];
  }

  return { snapshot, engagementIds };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} counselorId
 * @param {string} engagementId
 */
async function counselorCanAccessEngagement(admin, counselorId, engagementId) {
  const { data: eng, error: engErr } = await admin
    .from("engagements")
    .select("id, counselor_id")
    .eq("id", engagementId)
    .maybeSingle();
  if (engErr) throw engErr;
  if (!eng) return false;
  if (String(eng.counselor_id) === String(counselorId)) return true;

  const { data: collab, error: collabErr } = await admin
    .from("engagement_counselors")
    .select("engagement_id")
    .eq("engagement_id", engagementId)
    .eq("counselor_id", counselorId)
    .eq("active", true)
    .maybeSingle();
  if (collabErr) throw collabErr;
  return Boolean(collab);
}

function normalizeMeetingJoinUrl(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
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

  app.patch("/api/counselor/crm/engagements/:id/meeting-join-url", async (req, res) => {
    const admin = supabaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: "supabase_admin_missing" });
    }

    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "auth_required" });
    }

    const engagementId = String(req.params.id ?? "").trim();
    if (!engagementId) {
      return res.status(400).json({ error: "id_required" });
    }

    const url = normalizeMeetingJoinUrl(req.body?.meetingJoinUrl);
    if (!url && String(req.body?.meetingJoinUrl ?? "").trim()) {
      return res.status(400).json({ error: "invalid_meeting_url" });
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

      const allowed = await counselorCanAccessEngagement(admin, resolved.counselor.id, engagementId);
      if (!allowed) {
        return res.status(403).json({ error: "engagement_access_denied" });
      }

      const { data, error } = await admin
        .from("engagements")
        .update({
          meeting_join_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", engagementId)
        .select("id, meeting_join_url")
        .single();
      if (error) throw error;

      res.json({
        engagementId: data.id,
        meetingJoinUrl: data.meeting_join_url ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/counselor/crm/engagements/:id/resume", async (req, res) => {
    const admin = supabaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: "supabase_admin_missing" });
    }

    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "auth_required" });
    }

    const engagementId = String(req.params.id ?? "").trim();
    if (!engagementId) {
      return res.status(400).json({ error: "id_required" });
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

      const allowed = await counselorCanAccessEngagement(admin, resolved.counselor.id, engagementId);
      if (!allowed) {
        return res.status(403).json({ error: "engagement_access_denied" });
      }

      const { data, error } = await admin
        .from("engagements")
        .select("id, resume_draft, updated_at")
        .eq("id", engagementId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: "engagement_not_found" });
      }

      res.json({
        engagementId: data.id,
        resume: data.resume_draft ?? null,
        updatedAt: data.updated_at ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.put("/api/counselor/crm/engagements/:id/resume", async (req, res) => {
    const admin = supabaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: "supabase_admin_missing" });
    }

    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "auth_required" });
    }

    const engagementId = String(req.params.id ?? "").trim();
    if (!engagementId) {
      return res.status(400).json({ error: "id_required" });
    }

    const resume = req.body?.resume;
    if (!resume || typeof resume !== "object") {
      return res.status(400).json({ error: "resume_required" });
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

      const allowed = await counselorCanAccessEngagement(admin, resolved.counselor.id, engagementId);
      if (!allowed) {
        return res.status(403).json({ error: "engagement_access_denied" });
      }

      const { data, error } = await admin
        .from("engagements")
        .update({
          resume_draft: resume,
          updated_at: new Date().toISOString(),
        })
        .eq("id", engagementId)
        .select("id, resume_draft, updated_at")
        .single();
      if (error) throw error;

      res.json({
        engagementId: data.id,
        resume: data.resume_draft ?? null,
        updatedAt: data.updated_at ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });
}
