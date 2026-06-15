/** Admin API: engine standards (write from review, trial-run, publish). */

import {
  ensureBenchmarksLoaded,
  getEngineStandardsStats,
  listDraftBenchmarks,
  publishEngineStandardsDraft,
  trialRunEngineStandards,
  upsertBenchmarkToLiveFromReview,
} from "./engineStandards.mjs";
import { mapEvalReview } from "./adminEvalReview.mjs";

function mapEvalCaseRow(row) {
  return {
    caseKey: row.case_key,
    title: row.title,
    tags: row.tags ?? [],
    reportBody: row.report_body,
    expectedReach: row.expected_reach ?? [],
    expectedMatch: row.expected_match ?? [],
    expectedSafety: row.expected_safety ?? [],
  };
}

async function loadEvalTrialEntries(adminClient) {
  const [{ data: cases }, { data: reviews }] = await Promise.all([
    adminClient.from("report_eval_cases").select("*").eq("active", true).order("case_key", { ascending: true }),
    adminClient
      .from("report_eval_reviews")
      .select("*")
      .in("status", ["submitted", "approved"])
      .order("updated_at", { ascending: false }),
  ]);

  const reviewByCase = new Map();
  for (const row of reviews ?? []) {
    if (!reviewByCase.has(row.case_id)) reviewByCase.set(row.case_id, mapEvalReview(row));
  }

  return (cases ?? []).map((row) => ({
    case: mapEvalCaseRow(row),
    review: reviewByCase.get(row.id) ?? null,
  }));
}

export function registerEngineStandardsRoutes(app, ctx) {
  app.get("/api/admin/crm/engine/standards", async (req, res) => {
    const admin = await ctx.requireAdmin(req, res);
    if (!admin) return;
    try {
      await ensureBenchmarksLoaded();
      res.json({
        ...getEngineStandardsStats(),
        draftEntries: listDraftBenchmarks().map((e) => ({
          sourceCaseKey: e.sourceCaseKey,
          title: e.title,
          updatedAt: e.updatedAt,
          tags: e.profile?.tags ?? [],
          major: e.profile?.major ?? "",
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/engine/standards/from-review", async (req, res) => {
    const admin = await ctx.requireAdmin(req, res);
    if (!admin) return;

    const runId = String(req.body?.runId ?? "").trim();
    const caseId = String(req.body?.caseId ?? "").trim();
    if (!runId || !caseId) return res.status(400).json({ error: "eval_id_required" });

    try {
      const [{ data: caseRow }, { data: reviewRow }] = await Promise.all([
        admin.admin.from("report_eval_cases").select("*").eq("id", caseId).single(),
        admin.admin.from("report_eval_reviews").select("*").eq("run_id", runId).eq("case_id", caseId).maybeSingle(),
      ]);

      if (!caseRow) return res.status(404).json({ error: "eval_case_not_found" });
      if (!reviewRow) return res.status(404).json({ error: "eval_review_not_found" });

      const review = mapEvalReview(reviewRow);
      const result = await upsertBenchmarkToLiveFromReview({
        evalCase: mapEvalCaseRow(caseRow),
        review,
        reviewerEmail: admin.user.email,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json({ ...result, stats: getEngineStandardsStats() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/engine/standards/from-draft", async (req, res) => {
    const admin = await ctx.requireAdmin(req, res);
    if (!admin) return;

    const evalCase = req.body?.evalCase;
    const review = req.body?.review;
    if (!evalCase?.caseKey) return res.status(400).json({ error: "eval_case_required" });

    try {
      const result = await upsertBenchmarkToLiveFromReview({
        evalCase,
        review: review ?? { status: "submitted", finalApprovedRecommendation: req.body?.finalApprovedRecommendation },
        reviewerEmail: admin.user.email,
      });
      if (!result.ok) return res.status(400).json(result);
      res.json({ ...result, stats: getEngineStandardsStats() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/engine/standards/trial-run", async (req, res) => {
    const admin = await ctx.requireAdmin(req, res);
    if (!admin) return;
    try {
      await ensureBenchmarksLoaded();
      const entries = await loadEvalTrialEntries(admin.admin);
      const report = trialRunEngineStandards(entries);
      res.json(report);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/engine/standards/publish", async (req, res) => {
    const admin = await ctx.requireAdmin(req, res);
    if (!admin) return;
    try {
      const result = await publishEngineStandardsDraft(admin.user.email);
      if (!result.ok) return res.status(400).json(result);
      res.json({ ...result, stats: getEngineStandardsStats() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });
}
