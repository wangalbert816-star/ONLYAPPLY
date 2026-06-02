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
  en: "Premium service · My application",
  zh: "Premium 服务 · 我的申请",
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

function validateCounselorPassword(password) {
  if (!password) return "password_required";
  if (password.length < 6) return "password_too_short";
  return null;
}

/** Create Auth user or update password; returns linked user id. */
async function ensureAuthUserWithPassword(admin, email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });

  if (!createErr && created.user?.id) {
    return { userId: created.user.id, created: true };
  }

  const msg = createErr?.message || "";
  if (!/already|registered|exists/i.test(msg)) {
    throw createErr || new Error("auth_user_create_failed");
  }

  const existing = await findAuthUserByEmail(admin, normalizedEmail);
  if (!existing) throw createErr || new Error("auth_user_not_found");

  const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updateErr) throw updateErr;

  return { userId: existing.id, created: false };
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

const ADMIN_GROUP_CHAT_LABEL = "OnlyApply Admin";

function mapCaseMessage(row) {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    authorRole: row.author_role,
    authorLabel: row.author_label,
    body: row.body,
    channel: row.channel,
    pinned: row.pinned,
    createdAt: row.created_at,
    readByStudent: row.read_by_student,
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
    const password = String(req.body?.password ?? "").trim();

    if (!email || !name || !title) {
      return res.status(400).json({ error: "email_name_title_required" });
    }

    const passwordError = validateCounselorPassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    try {
      const { userId } = await ensureAuthUserWithPassword(ctx.admin, email, password);
      const payload = {
        user_id: userId,
        name,
        title,
        email,
        calendly_url: calendlyUrl,
        active: true,
      };

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
          authLinked: true,
        });
      }

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
    if (req.body?.name != null) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "email_name_title_required" });
      patch.name = name;
    }
    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ error: "email_name_title_required" });
      patch.title = title;
    }
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

    if (req.body?.password != null) {
      const password = String(req.body.password).trim();
      const passwordError = validateCounselorPassword(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      let email = String(req.body?.email ?? patch.email ?? "").trim().toLowerCase();
      if (!email) {
        const { data: row, error: rowErr } = await ctx.admin
          .from("counselors")
          .select("email")
          .eq("id", id)
          .maybeSingle();
        if (rowErr) throw rowErr;
        email = String(row?.email ?? "").trim().toLowerCase();
      }
      if (!email) return res.status(400).json({ error: "email_required_for_password" });

      const { userId } = await ensureAuthUserWithPassword(ctx.admin, email, password);
      patch.user_id = userId;
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

  app.get("/api/admin/crm/engagements/:id/messages", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;
    const engagementId = String(req.params.id ?? "").trim();
    if (!engagementId) {
      res.status(400).json({ error: "engagement_id_required" });
      return;
    }
    try {
      const { data: engagement, error: engErr } = await ctx.admin
        .from("engagements")
        .select("id")
        .eq("id", engagementId)
        .maybeSingle();
      if (engErr) throw engErr;
      if (!engagement) {
        res.status(404).json({ error: "engagement_not_found" });
        return;
      }

      const { data: rows, error } = await ctx.admin
        .from("case_messages")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("channel", "group")
        .order("created_at", { ascending: false });
      if (error) throw error;

      res.json({ messages: (rows ?? []).map(mapCaseMessage) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/engagements/:id/messages", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;
    const engagementId = String(req.params.id ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    if (!engagementId) {
      res.status(400).json({ error: "engagement_id_required" });
      return;
    }
    if (!body) {
      res.status(400).json({ error: "message_body_required" });
      return;
    }
    try {
      const { data: engagement, error: engErr } = await ctx.admin
        .from("engagements")
        .select("id")
        .eq("id", engagementId)
        .maybeSingle();
      if (engErr) throw engErr;
      if (!engagement) {
        res.status(404).json({ error: "engagement_not_found" });
        return;
      }

      const now = new Date().toISOString();
      const { data: row, error } = await ctx.admin
        .from("case_messages")
        .insert({
          engagement_id: engagementId,
          author_role: "admin",
          author_label: ADMIN_GROUP_CHAT_LABEL,
          body,
          channel: "group",
          pinned: false,
          read_by_student: false,
          created_at: now,
        })
        .select("*")
        .single();
      if (error) throw error;

      await ctx.admin.from("engagements").update({ updated_at: now }).eq("id", engagementId);

      res.json({ message: mapCaseMessage(row) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  const CRM_LIBRARY_BUCKET = "crm-library-files";
  const MAX_LIBRARY_FILE_BYTES = 20 * 1024 * 1024;

  function sanitizeLibraryFileName(name) {
    const trimmed = String(name).trim();
    const base = trimmed.replace(/[/\\]+/g, "_").replace(/[^a-zA-Z0-9._-]+/g, "_");
    return (base || "file").slice(0, 180);
  }

  function normalizeGoogleDocsEditUrl(raw) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return null;
    let url;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "docs.google.com") return null;
    const match = url.pathname.match(/^\/(spreadsheets|document|presentation|forms)\/d\/([a-zA-Z0-9-_]+)/);
    if (!match?.[2]) return null;
    return `https://docs.google.com/${match[1]}/d/${match[2]}/edit`;
  }

  function mapLibraryItem(row) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      locale: row.locale,
      itemKind: row.item_kind || "file",
      fileName: row.file_name,
      storagePath: row.storage_path,
      externalUrl: row.external_url,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      active: row.active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  app.get("/api/admin/crm/library", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;
    try {
      const { data, error } = await ctx.admin
        .from("crm_library_items")
        .select("*")
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ items: (data ?? []).map(mapLibraryItem) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/library/prepare-upload", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;

    const title = String(req.body?.title ?? "").trim();
    const description = String(req.body?.description ?? "").trim() || null;
    const category = String(req.body?.category ?? "general").trim() || "general";
    const locale = String(req.body?.locale ?? "all").trim();
    const fileName = String(req.body?.fileName ?? "").trim();
    const contentType = String(req.body?.contentType ?? "").trim() || null;
    const sizeBytes = Number(req.body?.sizeBytes ?? 0);

    if (!title) {
      res.status(400).json({ error: "library_title_required" });
      return;
    }
    if (!fileName) {
      res.status(400).json({ error: "library_file_required" });
      return;
    }
    if (!["zh", "en", "all"].includes(locale)) {
      res.status(400).json({ error: "library_locale_invalid" });
      return;
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      res.status(400).json({ error: "library_size_required" });
      return;
    }
    if (sizeBytes > MAX_LIBRARY_FILE_BYTES) {
      res.status(400).json({ error: "file_too_large" });
      return;
    }

    try {
      const id = crypto.randomUUID();
      const safeName = sanitizeLibraryFileName(fileName);
      const storagePath = `library/${id}/${safeName}`;
      const now = new Date().toISOString();

      const { data: upload, error: uploadErr } = await ctx.admin.storage
        .from(CRM_LIBRARY_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: row, error } = await ctx.admin
        .from("crm_library_items")
        .insert({
          id,
          title,
          description,
          category,
          locale,
          item_kind: "file",
          file_name: fileName,
          storage_path: storagePath,
          content_type: contentType,
          size_bytes: sizeBytes,
          active: true,
          sort_order: 0,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (error) throw error;

      res.json({
        item: mapLibraryItem(row),
        uploadUrl: upload.signedUrl,
        uploadToken: upload.token,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/library/link", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;

    const title = String(req.body?.title ?? "").trim();
    const description = String(req.body?.description ?? "").trim() || null;
    const category = String(req.body?.category ?? "general").trim() || "general";
    const locale = String(req.body?.locale ?? "all").trim();
    const externalUrl = normalizeGoogleDocsEditUrl(req.body?.externalUrl);

    if (!title) {
      res.status(400).json({ error: "library_title_required" });
      return;
    }
    if (!["zh", "en", "all"].includes(locale)) {
      res.status(400).json({ error: "library_locale_invalid" });
      return;
    }
    if (!externalUrl) {
      res.status(400).json({ error: "google_doc_url_invalid" });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { data: row, error } = await ctx.admin
        .from("crm_library_items")
        .insert({
          title,
          description,
          category,
          locale,
          item_kind: "link",
          external_url: externalUrl,
          active: true,
          sort_order: 0,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (error) throw error;

      res.json({ item: mapLibraryItem(row) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/admin/crm/library/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "library_id_required" });
      return;
    }

    const patch = {};
    if (req.body?.title != null) patch.title = String(req.body.title).trim();
    if (req.body?.description != null) {
      patch.description = String(req.body.description).trim() || null;
    }
    if (req.body?.category != null) patch.category = String(req.body.category).trim() || "general";
    if (req.body?.locale != null) {
      const locale = String(req.body.locale).trim();
      if (!["zh", "en", "all"].includes(locale)) {
        res.status(400).json({ error: "library_locale_invalid" });
        return;
      }
      patch.locale = locale;
    }
    if (req.body?.active != null) patch.active = Boolean(req.body.active);
    if (req.body?.sortOrder != null) patch.sort_order = Number(req.body.sortOrder) || 0;
    patch.updated_at = new Date().toISOString();

    if (patch.title === "") {
      res.status(400).json({ error: "library_title_required" });
      return;
    }

    try {
      const { data, error } = await ctx.admin
        .from("crm_library_items")
        .update(patch)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: "library_item_not_found" });
        return;
      }
      res.json({ item: mapLibraryItem(data) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/admin/crm/library/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res, supabaseAdmin);
    if (!ctx) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "library_id_required" });
      return;
    }

    try {
      const { data: row, error: fetchErr } = await ctx.admin
        .from("crm_library_items")
        .select("storage_path, item_kind")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!row) {
        res.status(404).json({ error: "library_item_not_found" });
        return;
      }

      if (row.storage_path && String(row.item_kind || "file") === "file") {
        await ctx.admin.storage.from(CRM_LIBRARY_BUCKET).remove([String(row.storage_path)]);
      }

      const { error } = await ctx.admin.from("crm_library_items").delete().eq("id", id);
      if (error) throw error;

      res.json({ ok: true });
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
