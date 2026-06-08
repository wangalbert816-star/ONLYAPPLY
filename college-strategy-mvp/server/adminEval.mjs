/** Admin report eval: golden cases, batch generation, scoring. */

import {
  REPORT_PROMPT_VERSION,
  REPORT_RUBRIC_VERSION,
  REPORT_TEMPLATE_VERSION,
} from "./evalConstants.mjs";
import {
  buildCorrectionCsv,
  buildDashboardStats,
  buildEngineeringSummary,
  flattenReviewToCsvRows,
  mapEvalReview,
  normalizeReviewInput,
} from "./adminEvalReview.mjs";

function mapEvalCase(row) {
  return {
    id: row.id,
    caseKey: row.case_key,
    title: row.title,
    titleEn: row.title_en ?? null,
    tags: row.tags ?? [],
    locale: row.locale,
    reportBody: row.report_body,
    reportBodyEn: row.report_body_en ?? null,
    expectedReach: row.expected_reach ?? [],
    expectedMatch: row.expected_match ?? [],
    expectedSafety: row.expected_safety ?? [],
    forbiddenSchools: row.forbidden_schools ?? [],
    notes: row.notes,
    notesEn: row.notes_en ?? null,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvalRun(row) {
  return {
    id: row.id,
    label: row.label,
    promptVersion: row.prompt_version,
    rubricVersion: row.rubric_version ?? REPORT_RUBRIC_VERSION,
    reportTemplateVersion: row.report_template_version ?? REPORT_TEMPLATE_VERSION,
    status: row.status,
    caseCount: row.case_count,
    okCount: row.ok_count,
    errorCount: row.error_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvalResult(row) {
  return {
    id: row.id,
    runId: row.run_id,
    caseId: row.case_id,
    status: row.status,
    reportPayload: row.report_payload ?? null,
    error: row.error ?? null,
    llmMs: row.llm_ms ?? null,
    provider: row.provider ?? null,
    model: row.model ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvalScore(row) {
  return {
    id: row.id,
    runId: row.run_id,
    caseId: row.case_id,
    scoreTier: row.score_tier,
    scorePersonalization: row.score_personalization,
    scoreFacts: row.score_facts,
    scoreConsistency: row.score_consistency,
    scoreActionable: row.score_actionable,
    notes: row.notes,
    errorTags: row.error_tags ?? [],
    scoredBy: row.scored_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseScoreInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
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

function validateReportBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "eval_report_body_invalid";
  const locale = body.locale === "en" ? "en" : body.locale === "zh" ? "zh" : null;
  if (!locale) return "eval_locale_invalid";
  return null;
}

function normalizeCaseInput(raw, createdBy) {
  const caseKey = String(raw.caseKey ?? raw.case_key ?? "").trim();
  const title = String(raw.title ?? "").trim();
  if (!caseKey) return { error: "eval_case_key_required" };
  if (!title) return { error: "eval_title_required" };

  const reportBody = raw.reportBody ?? raw.report_body;
  const bodyErr = validateReportBody(reportBody);
  if (bodyErr) return { error: bodyErr };

  const locale = reportBody.locale === "en" ? "en" : "zh";
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : [];

  const titleEn = String(raw.titleEn ?? raw.title_en ?? "").trim() || null;
  const notesEn = String(raw.notesEn ?? raw.notes_en ?? "").trim() || null;
  const reportBodyEn = raw.reportBodyEn ?? raw.report_body_en ?? null;
  if (reportBodyEn != null) {
    const enErr = validateReportBody(reportBodyEn);
    if (enErr) return { error: enErr };
  }

  return {
    payload: {
      case_key: caseKey,
      title,
      title_en: titleEn,
      tags,
      locale,
      report_body: reportBody,
      report_body_en: reportBodyEn,
      expected_reach: normalizeExpectedSchools(raw.expectedReach ?? raw.expected_reach),
      expected_match: normalizeExpectedSchools(raw.expectedMatch ?? raw.expected_match),
      expected_safety: normalizeExpectedSchools(raw.expectedSafety ?? raw.expected_safety),
      forbidden_schools: Array.isArray(raw.forbiddenSchools ?? raw.forbidden_schools)
        ? (raw.forbiddenSchools ?? raw.forbidden_schools).map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
        : [],
      notes: String(raw.notes ?? "").trim() || null,
      notes_en: notesEn,
      active: raw.active !== false,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    },
  };
}

async function refreshRunCounts(admin, runId) {
  const { data: results, error } = await admin
    .from("report_eval_run_results")
    .select("status")
    .eq("run_id", runId);
  if (error) throw error;

  const rows = results ?? [];
  const okCount = rows.filter((r) => r.status === "ok").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const pending = rows.some((r) => r.status === "pending" || r.status === "running");
  const status = pending ? "running" : errorCount > 0 && okCount === 0 ? "failed" : "completed";

  await admin
    .from("report_eval_runs")
    .update({
      ok_count: okCount,
      error_count: errorCount,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export function registerAdminEvalRoutes(app, { requireAdmin, generateReportForAdmin }) {
  app.get("/api/admin/crm/eval/cases", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    try {
      const { data, error } = await ctx.admin
        .from("report_eval_cases")
        .select("*")
        .order("case_key", { ascending: true });
      if (error) throw error;
      res.json({ cases: (data ?? []).map(mapEvalCase) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/eval/cases", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const normalized = normalizeCaseInput(req.body ?? {}, ctx.user.email);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    try {
      const { data, error } = await ctx.admin
        .from("report_eval_cases")
        .insert(normalized.payload)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ case: mapEvalCase(data) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate key|unique/i.test(msg)) {
        return res.status(409).json({ error: "eval_case_key_exists" });
      }
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/eval/cases/import", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const items = req.body?.cases;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "eval_import_empty" });
    }
    if (items.length > 100) {
      return res.status(400).json({ error: "eval_import_too_many" });
    }

    const created = [];
    const failed = [];
    for (const item of items) {
      const normalized = normalizeCaseInput(item, ctx.user.email);
      if (normalized.error) {
        failed.push({ caseKey: item?.caseKey ?? item?.case_key ?? "", error: normalized.error });
        continue;
      }
      try {
        const { data, error } = await ctx.admin
          .from("report_eval_cases")
          .upsert(normalized.payload, { onConflict: "case_key" })
          .select("*")
          .single();
        if (error) throw error;
        created.push(mapEvalCase(data));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failed.push({ caseKey: normalized.payload.case_key, error: msg });
      }
    }

    res.json({ imported: created.length, failed, cases: created });
  });

  app.patch("/api/admin/crm/eval/cases/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "eval_id_required" });

    const patch = { updated_at: new Date().toISOString() };
    if (req.body?.title !== undefined) patch.title = String(req.body.title).trim();
    if (req.body?.tags !== undefined) {
      patch.tags = Array.isArray(req.body.tags)
        ? req.body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
        : [];
    }
    if (req.body?.reportBody !== undefined) {
      const bodyErr = validateReportBody(req.body.reportBody);
      if (bodyErr) return res.status(400).json({ error: bodyErr });
      patch.report_body = req.body.reportBody;
      patch.locale = req.body.reportBody.locale === "en" ? "en" : "zh";
    }
    if (req.body?.expectedReach !== undefined) patch.expected_reach = normalizeExpectedSchools(req.body.expectedReach);
    if (req.body?.expectedMatch !== undefined) patch.expected_match = normalizeExpectedSchools(req.body.expectedMatch);
    if (req.body?.expectedSafety !== undefined) patch.expected_safety = normalizeExpectedSchools(req.body.expectedSafety);
    if (req.body?.forbiddenSchools !== undefined) {
      patch.forbidden_schools = Array.isArray(req.body.forbiddenSchools)
        ? req.body.forbiddenSchools.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
        : [];
    }
    if (req.body?.notes !== undefined) patch.notes = String(req.body.notes).trim() || null;
    if (req.body?.notesEn !== undefined) patch.notes_en = String(req.body.notesEn).trim() || null;
    if (req.body?.titleEn !== undefined) patch.title_en = String(req.body.titleEn).trim() || null;
    if (req.body?.reportBodyEn !== undefined) {
      if (req.body.reportBodyEn === null) {
        patch.report_body_en = null;
      } else {
        const enErr = validateReportBody(req.body.reportBodyEn);
        if (enErr) return res.status(400).json({ error: enErr });
        patch.report_body_en = req.body.reportBodyEn;
      }
    }
    if (req.body?.active !== undefined) patch.active = Boolean(req.body.active);

    try {
      const { data, error } = await ctx.admin
        .from("report_eval_cases")
        .update(patch)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "eval_case_not_found" });
      res.json({ case: mapEvalCase(data) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/admin/crm/eval/cases/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "eval_id_required" });
    try {
      const { error } = await ctx.admin.from("report_eval_cases").delete().eq("id", id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  /** Best display status per case across all runs (for case library badges). */
  function caseListStatusRank(row) {
    if (row.status === "error") return 2;
    if (row.status !== "ok") return 0;
    const reviewStatus = row.review?.status;
    if (reviewStatus === "approved") return 6;
    if (reviewStatus === "submitted") return 5;
    if (reviewStatus === "draft") return 4;
    return 3;
  }

  function pickBetterCaseResult(a, b) {
    const rankA = caseListStatusRank(a);
    const rankB = caseListStatusRank(b);
    if (rankA !== rankB) return rankA > rankB ? a : b;
    const timeA = new Date(a.updatedAt || 0).getTime();
    const timeB = new Date(b.updatedAt || 0).getTime();
    return timeA >= timeB ? a : b;
  }

  app.get("/api/admin/crm/eval/case-status", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    try {
      const [{ data: results, error: resErr }, { data: reviews, error: reviewErr }] = await Promise.all([
        ctx.admin.from("report_eval_run_results").select("*").order("updated_at", { ascending: false }),
        ctx.admin.from("report_eval_reviews").select("*"),
      ]);
      if (resErr) throw resErr;
      if (reviewErr && !/report_eval_reviews|relation.*does not exist/i.test(reviewErr.message ?? "")) {
        throw reviewErr;
      }

      const reviewByRunCase = new Map((reviews ?? []).map((r) => [`${r.run_id}:${r.case_id}`, mapEvalReview(r)]));
      const bestByCase = new Map();
      for (const row of results ?? []) {
        const mapped = {
          ...mapEvalResult(row),
          case: null,
          score: null,
          review: reviewByRunCase.get(`${row.run_id}:${row.case_id}`) ?? null,
        };
        const existing = bestByCase.get(row.case_id);
        bestByCase.set(row.case_id, existing ? pickBetterCaseResult(existing, mapped) : mapped);
      }

      res.json({ results: [...bestByCase.values()] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/eval/runs", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    try {
      const { data, error } = await ctx.admin
        .from("report_eval_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({ runs: (data ?? []).map(mapEvalRun) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/eval/runs", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const label = String(req.body?.label ?? "").trim();
    if (!label) return res.status(400).json({ error: "eval_run_label_required" });

    const promptVersion =
      String(req.body?.promptVersion ?? req.body?.prompt_version ?? "").trim() || REPORT_PROMPT_VERSION;
    const rubricVersion =
      String(req.body?.rubricVersion ?? req.body?.rubric_version ?? "").trim() || REPORT_RUBRIC_VERSION;
    const reportTemplateVersion =
      String(req.body?.reportTemplateVersion ?? req.body?.report_template_version ?? "").trim() ||
      REPORT_TEMPLATE_VERSION;
    const caseIds = Array.isArray(req.body?.caseIds)
      ? req.body.caseIds.map((id) => String(id).trim()).filter(Boolean)
      : null;

    try {
      let casesQuery = ctx.admin.from("report_eval_cases").select("id").eq("active", true);
      if (caseIds && caseIds.length > 0) {
        casesQuery = casesQuery.in("id", caseIds);
      }
      const { data: cases, error: casesErr } = await casesQuery.order("case_key", { ascending: true });
      if (casesErr) throw casesErr;
      if (!cases?.length) return res.status(400).json({ error: "eval_no_cases" });

      const { data: run, error: runErr } = await ctx.admin
        .from("report_eval_runs")
        .insert({
          label,
          prompt_version: promptVersion,
          rubric_version: rubricVersion,
          report_template_version: reportTemplateVersion,
          status: "pending",
          case_count: cases.length,
          ok_count: 0,
          error_count: 0,
          created_by: ctx.user.email,
        })
        .select("*")
        .single();
      if (runErr) throw runErr;

      const resultRows = cases.map((c) => ({
        run_id: run.id,
        case_id: c.id,
        status: "pending",
      }));
      const { error: resultsErr } = await ctx.admin.from("report_eval_run_results").insert(resultRows);
      if (resultsErr) throw resultsErr;

      res.json({ run: mapEvalRun(run) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/eval/runs/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const runId = String(req.params.id ?? "").trim();
    if (!runId) return res.status(400).json({ error: "eval_id_required" });

    try {
      const { data: run, error: runErr } = await ctx.admin
        .from("report_eval_runs")
        .select("*")
        .eq("id", runId)
        .maybeSingle();
      if (runErr) throw runErr;
      if (!run) return res.status(404).json({ error: "eval_run_not_found" });

      const [{ data: results, error: resErr }, { data: scores, error: scoreErr }, { data: reviews, error: reviewErr }, { data: cases, error: caseErr }] =
        await Promise.all([
          ctx.admin.from("report_eval_run_results").select("*").eq("run_id", runId).order("created_at", { ascending: true }),
          ctx.admin.from("report_eval_scores").select("*").eq("run_id", runId),
          ctx.admin.from("report_eval_reviews").select("*").eq("run_id", runId),
          ctx.admin.from("report_eval_cases").select("*").order("case_key", { ascending: true }),
        ]);
      if (resErr) throw resErr;
      if (scoreErr) throw scoreErr;
      if (caseErr) throw caseErr;
      if (reviewErr && !/report_eval_reviews|relation.*does not exist/i.test(reviewErr.message ?? "")) {
        throw reviewErr;
      }

      const caseById = new Map((cases ?? []).map((c) => [c.id, mapEvalCase(c)]));
      const scoreByCaseId = new Map((scores ?? []).map((s) => [s.case_id, mapEvalScore(s)]));
      const reviewByCaseId = new Map((reviews ?? []).map((r) => [r.case_id, mapEvalReview(r)]));

      res.json({
        run: mapEvalRun(run),
        results: (results ?? []).map((row) => ({
          ...mapEvalResult(row),
          case: caseById.get(row.case_id) ?? null,
          score: scoreByCaseId.get(row.case_id) ?? null,
          review: reviewByCaseId.get(row.case_id) ?? null,
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/eval/runs/:runId/generate/:caseId", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const runId = String(req.params.runId ?? "").trim();
    const caseId = String(req.params.caseId ?? "").trim();
    if (!runId || !caseId) return res.status(400).json({ error: "eval_id_required" });

    if (!generateReportForAdmin) {
      return res.status(503).json({ error: "eval_generation_unavailable" });
    }

    try {
      const { data: run, error: runErr } = await ctx.admin
        .from("report_eval_runs")
        .select("id")
        .eq("id", runId)
        .maybeSingle();
      if (runErr) throw runErr;
      if (!run) return res.status(404).json({ error: "eval_run_not_found" });

      const { data: evalCase, error: caseErr } = await ctx.admin
        .from("report_eval_cases")
        .select("*")
        .eq("id", caseId)
        .maybeSingle();
      if (caseErr) throw caseErr;
      if (!evalCase) return res.status(404).json({ error: "eval_case_not_found" });

      await ctx.admin
        .from("report_eval_runs")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", runId);

      await ctx.admin
        .from("report_eval_run_results")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("run_id", runId)
        .eq("case_id", caseId);

      let resultPayload;
      try {
        const generated = await generateReportForAdmin({
          ...(evalCase.report_body ?? {}),
          forbiddenSchools: evalCase.forbidden_schools ?? [],
        });
        resultPayload = {
          status: "ok",
          report_payload: generated.report,
          error: null,
          llm_ms: generated.llmMs ?? null,
          provider: generated.provider ?? null,
          model: generated.model ?? null,
          updated_at: new Date().toISOString(),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        resultPayload = {
          status: "error",
          report_payload: null,
          error: msg.slice(0, 2000),
          llm_ms: null,
          provider: null,
          model: null,
          updated_at: new Date().toISOString(),
        };
      }

      const { data: resultRow, error: updateErr } = await ctx.admin
        .from("report_eval_run_results")
        .update(resultPayload)
        .eq("run_id", runId)
        .eq("case_id", caseId)
        .select("*")
        .single();
      if (updateErr) throw updateErr;

      await refreshRunCounts(ctx.admin, runId);

      const { data: updatedRun } = await ctx.admin.from("report_eval_runs").select("*").eq("id", runId).single();

      res.json({
        result: mapEvalResult(resultRow),
        run: updatedRun ? mapEvalRun(updatedRun) : null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.put("/api/admin/crm/eval/runs/:runId/scores/:caseId", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const runId = String(req.params.runId ?? "").trim();
    const caseId = String(req.params.caseId ?? "").trim();
    if (!runId || !caseId) return res.status(400).json({ error: "eval_id_required" });

    const scoreTier = parseScoreInt(req.body?.scoreTier);
    const scorePersonalization = parseScoreInt(req.body?.scorePersonalization);
    const scoreFacts = parseScoreInt(req.body?.scoreFacts);
    const scoreConsistency = parseScoreInt(req.body?.scoreConsistency);
    const scoreActionable = parseScoreInt(req.body?.scoreActionable);

    const payload = {
      run_id: runId,
      case_id: caseId,
      score_tier: scoreTier,
      score_personalization: scorePersonalization,
      score_facts: scoreFacts,
      score_consistency: scoreConsistency,
      score_actionable: scoreActionable,
      notes: String(req.body?.notes ?? "").trim() || null,
      error_tags: Array.isArray(req.body?.errorTags)
        ? req.body.errorTags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
        : [],
      scored_by: ctx.user.email,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await ctx.admin
        .from("report_eval_scores")
        .upsert(payload, { onConflict: "run_id,case_id" })
        .select("*")
        .single();
      if (error) throw error;
      res.json({ score: mapEvalScore(data) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.put("/api/admin/crm/eval/runs/:runId/reviews/:caseId", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    const runId = String(req.params.runId ?? "").trim();
    const caseId = String(req.params.caseId ?? "").trim();
    if (!runId || !caseId) return res.status(400).json({ error: "eval_id_required" });

    const normalized = normalizeReviewInput(req.body ?? {}, ctx.user.email);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    try {
      const { data, error } = await ctx.admin
        .from("report_eval_reviews")
        .upsert(
          {
            run_id: runId,
            case_id: caseId,
            rubric_version: REPORT_RUBRIC_VERSION,
            ...normalized.payload,
          },
          { onConflict: "run_id,case_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      res.json({ review: mapEvalReview(data) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/report_eval_reviews|relation.*does not exist/i.test(msg)) {
        return res.status(500).json({ error: "eval_review_table_missing" });
      }
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/eval/dashboard", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    try {
      const [{ data: reviews, error: reviewErr }, { data: runs, error: runErr }, { data: cases, error: caseErr }] =
        await Promise.all([
          ctx.admin.from("report_eval_reviews").select("*").order("updated_at", { ascending: false }),
          ctx.admin.from("report_eval_runs").select("*"),
          ctx.admin.from("report_eval_cases").select("id, active"),
        ]);
      if (reviewErr) throw reviewErr;
      if (runErr) throw runErr;
      if (caseErr) throw caseErr;

      const runsById = new Map((runs ?? []).map((r) => [r.id, r]));
      const stats = buildDashboardStats(reviews ?? [], runsById);
      res.json({
        ...stats,
        activeCaseCount: (cases ?? []).filter((c) => c.active).length,
        versions: {
          promptVersion: REPORT_PROMPT_VERSION,
          rubricVersion: REPORT_RUBRIC_VERSION,
          reportTemplateVersion: REPORT_TEMPLATE_VERSION,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/report_eval_reviews|relation.*does not exist/i.test(msg)) {
        return res.status(500).json({ error: "eval_review_table_missing" });
      }
      res.status(500).json({ error: msg });
    }
  });

  async function loadSubmittedReviewEntries(ctx) {
    const [{ data: reviews }, { data: cases }, { data: runs }, { data: results }] = await Promise.all([
      ctx.admin
        .from("report_eval_reviews")
        .select("*")
        .in("status", ["submitted", "approved"])
        .order("updated_at", { ascending: false }),
      ctx.admin.from("report_eval_cases").select("*").order("case_key", { ascending: true }),
      ctx.admin.from("report_eval_runs").select("*"),
      ctx.admin.from("report_eval_run_results").select("*"),
    ]);

    const caseById = new Map((cases ?? []).map((c) => [c.id, mapEvalCase(c)]));
    const runById = new Map((runs ?? []).map((r) => [r.id, mapEvalRun(r)]));
    const resultByKey = new Map((results ?? []).map((r) => [`${r.run_id}:${r.case_id}`, mapEvalResult(r)]));

    const entries = [];
    for (const reviewRow of reviews ?? []) {
      const evalCase = caseById.get(reviewRow.case_id);
      const run = runById.get(reviewRow.run_id);
      const result = resultByKey.get(`${reviewRow.run_id}:${reviewRow.case_id}`);
      if (!evalCase || !run || !result) continue;
      entries.push({
        case: evalCase,
        run,
        result,
        review: mapEvalReview(reviewRow),
      });
    }
    return entries;
  }

  async function loadGeneratedReportEntries(ctx) {
    const [{ data: cases }, { data: results }, { data: runs }, { data: reviews }] = await Promise.all([
      ctx.admin.from("report_eval_cases").select("*").order("case_key", { ascending: true }),
      ctx.admin.from("report_eval_run_results").select("*").order("updated_at", { ascending: false }),
      ctx.admin.from("report_eval_runs").select("*"),
      ctx.admin.from("report_eval_reviews").select("*"),
    ]);

    const caseById = new Map((cases ?? []).map((c) => [c.id, mapEvalCase(c)]));
    const runById = new Map((runs ?? []).map((r) => [r.id, mapEvalRun(r)]));
    const reviewByRunCase = new Map((reviews ?? []).map((r) => [`${r.run_id}:${r.case_id}`, mapEvalReview(r)]));

    const bestByCase = new Map();
    for (const row of results ?? []) {
      if (row.status !== "ok") continue;
      const mapped = {
        ...mapEvalResult(row),
        review: reviewByRunCase.get(`${row.run_id}:${row.case_id}`) ?? null,
      };
      const existing = bestByCase.get(row.case_id);
      bestByCase.set(row.case_id, existing ? pickBetterCaseResult(existing, mapped) : mapped);
    }

    const entries = [];
    for (const [caseId, result] of bestByCase) {
      const evalCase = caseById.get(caseId);
      const run = runById.get(result.runId);
      if (!evalCase || !run) continue;
      entries.push({
        case: evalCase,
        run,
        result,
        review: result.review ?? null,
      });
    }
    entries.sort((a, b) => String(a.case.caseKey ?? "").localeCompare(String(b.case.caseKey ?? "")));
    return entries;
  }

  app.get("/api/admin/crm/eval/export/json", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    try {
      const scope = String(req.query.scope ?? "reviewed").trim() === "generated" ? "generated" : "reviewed";
      const entries =
        scope === "generated" ? await loadGeneratedReportEntries(ctx) : await loadSubmittedReviewEntries(ctx);
      res.json({
        exportedAt: new Date().toISOString(),
        exportScope: scope,
        entryCount: entries.length,
        harnessPurpose: "prompt_rubric_evaluation_and_correction_data",
        versions: {
          promptVersion: REPORT_PROMPT_VERSION,
          rubricVersion: REPORT_RUBRIC_VERSION,
          reportTemplateVersion: REPORT_TEMPLATE_VERSION,
        },
        entries,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/eval/export/csv", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    try {
      const entries = await loadSubmittedReviewEntries(ctx);
      const rows = entries.flatMap((entry) =>
        flattenReviewToCsvRows({
          evalCase: entry.case,
          run: entry.run,
          result: entry.result,
          review: entry.review,
        }),
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(buildCorrectionCsv(rows));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/eval/export/summary", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    try {
      const entries = await loadSubmittedReviewEntries(ctx);
      const [{ data: reviews }, { data: runs }] = await Promise.all([
        ctx.admin.from("report_eval_reviews").select("*"),
        ctx.admin.from("report_eval_runs").select("*"),
      ]);
      const stats = buildDashboardStats(reviews ?? [], new Map((runs ?? []).map((r) => [r.id, r])));
      const text = buildEngineeringSummary(entries, stats);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/eval/feedback/export", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;

    try {
      const [{ data: scores, error: scoreErr }, { data: cases, error: caseErr }] = await Promise.all([
        ctx.admin.from("report_eval_scores").select("*").order("updated_at", { ascending: false }),
        ctx.admin.from("report_eval_cases").select("*").order("case_key", { ascending: true }),
      ]);
      if (scoreErr) throw scoreErr;
      if (caseErr) throw caseErr;

      const latestScoreByCaseId = new Map();
      for (const row of scores ?? []) {
        if (!latestScoreByCaseId.has(row.case_id)) {
          latestScoreByCaseId.set(row.case_id, row);
        }
      }

      if (latestScoreByCaseId.size === 0) {
        return res.json({ entries: [], caseCount: (cases ?? []).filter((c) => c.active).length });
      }

      const runIds = [...new Set([...latestScoreByCaseId.values()].map((s) => s.run_id))];
      const caseIds = [...latestScoreByCaseId.keys()];

      const [{ data: runs, error: runErr }, { data: results, error: resultErr }] = await Promise.all([
        ctx.admin.from("report_eval_runs").select("*").in("id", runIds),
        ctx.admin
          .from("report_eval_run_results")
          .select("*")
          .in("run_id", runIds)
          .in("case_id", caseIds),
      ]);
      if (runErr) throw runErr;
      if (resultErr) throw resultErr;

      const caseById = new Map((cases ?? []).map((c) => [c.id, c]));
      const runById = new Map((runs ?? []).map((r) => [r.id, r]));
      const resultByKey = new Map((results ?? []).map((r) => [`${r.run_id}:${r.case_id}`, r]));

      const entries = [];
      for (const caseRow of cases ?? []) {
        const scoreRow = latestScoreByCaseId.get(caseRow.id);
        if (!scoreRow) continue;
        const runRow = runById.get(scoreRow.run_id);
        const resultRow = resultByKey.get(`${scoreRow.run_id}:${caseRow.id}`);
        if (!runRow || !resultRow) continue;
        entries.push({
          case: mapEvalCase(caseRow),
          run: mapEvalRun(runRow),
          result: mapEvalResult(resultRow),
          score: mapEvalScore(scoreRow),
        });
      }

      res.json({
        entries,
        caseCount: (cases ?? []).filter((c) => c.active).length,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });
}
