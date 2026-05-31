/** CRM Admin API — service_role writes, JWT + CRM_ADMIN_EMAILS gate. */

const EMPTY_FORM_STATE = {
  intakeTerm: "",
  intakeOtherDetail: "",
  applicantIdentity: "",
  citizenship: "",
  residenceRegion: "",
  budget: "",
  testing: "",
  satScore: "",
  actScore: "",
  highSchoolSystem: "",
  currentHighSchool: "",
  gpa: "",
  gpaTrend: "",
  languageScores: "",
  academicSpecialFlags: [],
  academicSpecialNotes: "",
  majorPrimary: "",
  majorSecondary: "",
  schoolSize: "",
  campusCulturePref: "",
  geoPrefs: [],
  activities: "",
  structuredActivities: [],
  riskStyle: "",
  dealbreakers: "",
};

const PLACEHOLDER_TITLES = {
  en: "Signed service · My application",
  zh: "签约服务 · 我的申请",
};

function crmAdminEmails() {
  return (process.env.CRM_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function bearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

async function findAuthUserByEmail(admin, email) {
  const target = email.trim().toLowerCase();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 1000) break;
    page += 1;
  }
  return null;
}

async function requireAdmin(req, res, supabaseAdmin) {
  const admin = supabaseAdmin();
  if (!admin) {
    res.status(503).json({ error: "supabase_admin_missing" });
    return null;
  }
  const allow = crmAdminEmails();
  if (allow.length === 0) {
    res.status(503).json({ error: "crm_admin_not_configured" });
    return null;
  }
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "auth_required" });
    return null;
  }
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    res.status(401).json({ error: "invalid_session" });
    return null;
  }
  const email = userData.user.email?.toLowerCase() ?? "";
  if (!email || !allow.includes(email)) {
    res.status(403).json({ error: "admin_forbidden" });
    return null;
  }
  return { admin, user: userData.user };
}

function mapCounselor(row, engagementCounts) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    title: row.title,
    bio: row.bio,
    email: row.email,
    calendlyUrl: row.calendly_url,
    active: row.active,
    createdAt: row.created_at,
    studentCount: engagementCounts.get(row.id) ?? 0,
  };
}

function mapEngagement(row, counselorsById) {
  const counselor = counselorsById.get(row.counselor_id);
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    studentEmail: row.student_email,
    studentName: row.student_name,
    applicationId: row.application_id,
    applicationTitle: row.application_title,
    counselorId: row.counselor_id,
    counselorName: counselor?.name ?? null,
    counselorEmail: counselor?.email ?? null,
    status: row.status,
    phase: row.phase,
    planLabel: row.plan_label,
    nextMeetingLabel: row.next_meeting_label,
    needsFollowUp: row.needs_follow_up,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {import("express").Express} app
 * @param {{ supabaseAdmin: () => import("@supabase/supabase-js").SupabaseClient | null }} deps
 */
export function registerAdminCrmRoutes(app, { supabaseAdmin }) {
  app.get("/api/admin/crm/session", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;
    res.json({ ok: true, email: ctx.user.email });
  });

  app.get("/api/admin/crm/counselors", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;
    try {
      const { data: counselors, error: cErr } = await ctx.admin
        .from("counselors")
        .select("*")
        .order("created_at", { ascending: true });
      if (cErr) throw cErr;

      const { data: engagements, error: eErr } = await ctx.admin
        .from("engagements")
        .select("counselor_id, status");
      if (eErr) throw eErr;

      const counts = new Map();
      for (const row of engagements ?? []) {
        if (row.status !== "active") continue;
        counts.set(row.counselor_id, (counts.get(row.counselor_id) ?? 0) + 1);
      }

      res.json({
        counselors: (counselors ?? []).map((row) => mapCounselor(row, counts)),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/counselors", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const name = String(req.body?.name ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const calendlyUrl = String(req.body?.calendlyUrl ?? "").trim() || null;

    if (!email || !name || !title) {
      return res.status(400).json({ error: "email_name_title_required" });
    }

    try {
      const authUser = await findAuthUserByEmail(ctx.admin, email);
      const payload = {
        user_id: authUser?.id ?? null,
        name,
        title,
        email,
        calendly_url: calendlyUrl,
        active: true,
      };

      if (authUser) {
        const { data, error } = await ctx.admin
          .from("counselors")
          .upsert(payload, { onConflict: "user_id" })
          .select("*")
          .single();
        if (error) throw error;
        return res.json({
          counselor: mapCounselor(data, new Map()),
          authLinked: true,
        });
      }

      const { data: existing } = await ctx.admin
        .from("counselors")
        .select("*")
        .ilike("email", email)
        .maybeSingle();

      if (existing) {
        const { data, error } = await ctx.admin
          .from("counselors")
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        return res.json({
          counselor: mapCounselor(data, new Map()),
          authLinked: false,
        });
      }

      const { data, error } = await ctx.admin.from("counselors").insert(payload).select("*").single();
      if (error) throw error;
      return res.json({
        counselor: mapCounselor(data, new Map()),
        authLinked: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/admin/crm/counselors/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;

    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "id_required" });

    /** @type {Record<string, unknown>} */
    const patch = {};
    if (req.body?.name != null) patch.name = String(req.body.name).trim();
    if (req.body?.title != null) patch.title = String(req.body.title).trim();
    if (req.body?.email != null) patch.email = String(req.body.email).trim().toLowerCase();
    if (req.body?.calendlyUrl !== undefined) {
      patch.calendly_url = String(req.body.calendlyUrl ?? "").trim() || null;
    }
    if (typeof req.body?.active === "boolean") patch.active = req.body.active;
    if (req.body?.linkAuth === true) {
      const email = String(req.body?.email ?? patch.email ?? "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "email_required_for_link" });
      const authUser = await findAuthUserByEmail(ctx.admin, email);
      if (!authUser) return res.status(404).json({ error: "auth_user_not_found" });
      patch.user_id = authUser.id;
      if (!patch.email) patch.email = email;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no_fields" });
    }

    try {
      const { data, error } = await ctx.admin
        .from("counselors")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ counselor: mapCounselor(data, new Map()) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/engagements", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;
    try {
      const { data: counselors, error: cErr } = await ctx.admin.from("counselors").select("id, name, email");
      if (cErr) throw cErr;
      const counselorsById = new Map((counselors ?? []).map((c) => [c.id, c]));

      const { data: rows, error: eErr } = await ctx.admin
        .from("engagements")
        .select("*")
        .order("updated_at", { ascending: false });
      if (eErr) throw eErr;

      res.json({
        engagements: (rows ?? []).map((row) => mapEngagement(row, counselorsById)),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/students/lookup", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;

    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email_required" });

    try {
      const authUser = await findAuthUserByEmail(ctx.admin, email);
      if (!authUser) {
        return res.json({
          found: false,
          email,
          message: "auth_user_not_found",
          applications: [],
        });
      }

      const { data: apps, error: appErr } = await ctx.admin
        .from("saved_applications")
        .select("id, title, locale, updated_at, created_at")
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false });
      if (appErr) throw appErr;

      res.json({
        found: true,
        email,
        userId: authUser.id,
        applications: (apps ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          locale: a.locale,
          updatedAt: a.updated_at,
          createdAt: a.created_at,
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/engagements", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;

    const studentEmail = String(req.body?.studentEmail ?? "").trim().toLowerCase();
    const counselorId = String(req.body?.counselorId ?? "").trim();
    let applicationId = req.body?.applicationId ? String(req.body.applicationId).trim() : null;
    const createPlaceholder = Boolean(req.body?.createPlaceholderApplication);
    const placeholderLocale = req.body?.placeholderLocale === "zh" ? "zh" : "en";
    const phase = String(req.body?.phase ?? "planning").trim();
    const planLabel = req.body?.planLabel != null ? String(req.body.planLabel).trim() : null;
    const nextMeetingLabel =
      req.body?.nextMeetingLabel != null ? String(req.body.nextMeetingLabel).trim() : null;

    const validPhases = new Set(["onboarding", "planning", "essays", "applications", "done"]);
    if (!validPhases.has(phase)) {
      return res.status(400).json({ error: "invalid_phase" });
    }
    if (!studentEmail || !counselorId) {
      return res.status(400).json({ error: "student_email_and_counselor_required" });
    }

    try {
      const authUser = await findAuthUserByEmail(ctx.admin, studentEmail);
      if (!authUser) {
        return res.status(404).json({ error: "auth_user_not_found" });
      }

      const { data: counselor, error: cErr } = await ctx.admin
        .from("counselors")
        .select("id, active")
        .eq("id", counselorId)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!counselor || !counselor.active) {
        return res.status(400).json({ error: "counselor_not_found" });
      }

      let appTitle = PLACEHOLDER_TITLES[placeholderLocale];
      if (applicationId) {
        const { data: app, error: appErr } = await ctx.admin
          .from("saved_applications")
          .select("id, title, user_id")
          .eq("id", applicationId)
          .maybeSingle();
        if (appErr) throw appErr;
        if (!app || app.user_id !== authUser.id) {
          return res.status(400).json({ error: "application_not_found" });
        }
        appTitle = app.title || appTitle;
      } else if (createPlaceholder) {
        const now = new Date().toISOString();
        const { data: created, error: createErr } = await ctx.admin
          .from("saved_applications")
          .insert({
            user_id: authUser.id,
            title: PLACEHOLDER_TITLES[placeholderLocale],
            form_state: EMPTY_FORM_STATE,
            locale: placeholderLocale,
            updated_at: now,
          })
          .select("id, title")
          .single();
        if (createErr) throw createErr;
        applicationId = created.id;
        appTitle = created.title;
      } else {
        return res.status(400).json({ error: "application_required" });
      }

      const now = new Date().toISOString();
      const { data: engagement, error: engErr } = await ctx.admin
        .from("engagements")
        .upsert(
          {
            student_user_id: authUser.id,
            student_email: studentEmail,
            student_name: studentEmail.split("@")[0],
            application_id: applicationId,
            application_title: appTitle,
            counselor_id: counselorId,
            phase,
            status: "active",
            plan_label: planLabel || null,
            next_meeting_label: nextMeetingLabel || null,
            updated_at: now,
          },
          { onConflict: "student_user_id,application_id" },
        )
        .select("*")
        .single();
      if (engErr) throw engErr;

      const { data: counselorRow } = await ctx.admin
        .from("counselors")
        .select("id, name, email")
        .eq("id", counselorId)
        .maybeSingle();
      const counselorsById = new Map(counselorRow ? [[counselorRow.id, counselorRow]] : []);

      res.json({ engagement: mapEngagement(engagement, counselorsById) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/admin/crm/engagements/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;

    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "id_required" });

    /** @type {Record<string, unknown>} */
    const patch = { updated_at: new Date().toISOString() };
    if (req.body?.counselorId != null) patch.counselor_id = String(req.body.counselorId).trim();
    if (req.body?.status != null) patch.status = String(req.body.status).trim();
    if (req.body?.phase != null) patch.phase = String(req.body.phase).trim();
    if (req.body?.planLabel !== undefined) {
      patch.plan_label = String(req.body.planLabel ?? "").trim() || null;
    }
    if (req.body?.nextMeetingLabel !== undefined) {
      patch.next_meeting_label = String(req.body.nextMeetingLabel ?? "").trim() || null;
    }

    const validStatus = new Set(["active", "paused", "completed"]);
    const validPhases = new Set(["onboarding", "planning", "essays", "applications", "done"]);
    if (patch.status && !validStatus.has(patch.status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
    if (patch.phase && !validPhases.has(patch.phase)) {
      return res.status(400).json({ error: "invalid_phase" });
    }

    if (Object.keys(patch).length <= 1) {
      return res.status(400).json({ error: "no_fields" });
    }

    try {
      if (patch.counselor_id) {
        const { data: counselor, error: cErr } = await ctx.admin
          .from("counselors")
          .select("id, active")
          .eq("id", patch.counselor_id)
          .maybeSingle();
        if (cErr) throw cErr;
        if (!counselor || !counselor.active) {
          return res.status(400).json({ error: "counselor_not_found" });
        }
      }

      const { data, error } = await ctx.admin
        .from("engagements")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      const { data: counselorRow } = await ctx.admin
        .from("counselors")
        .select("id, name, email")
        .eq("id", data.counselor_id)
        .maybeSingle();
      const counselorsById = new Map(counselorRow ? [[counselorRow.id, counselorRow]] : []);

      res.json({ engagement: mapEngagement(data, counselorsById) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });
}

export function crmAdminConfigured() {
  return crmAdminEmails().length > 0 && Boolean(
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() &&
      ((process.env.SUPABASE_URL || "").trim() || (process.env.VITE_SUPABASE_URL || "").trim()),
  );
}
