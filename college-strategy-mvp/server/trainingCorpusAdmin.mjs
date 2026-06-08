/** Admin API for OnlyApply training corpus (gold cases). */

import {
  exportSftJsonlLines,
  getCorpusStats,
  loadGoldCases,
  upsertGoldCaseFromEval,
} from "./trainingCorpus.mjs";

export function registerTrainingCorpusRoutes(app, ctx) {
  app.get("/api/admin/crm/training-corpus", async (req, res) => {
    const admin = await ctx.requireAdmin(req, res);
    if (!admin) return;
    try {
      const stats = getCorpusStats();
      const cases = loadGoldCases().map((c) => ({
        caseKey: c.caseKey,
        title: c.title,
        tags: c.tags ?? [],
        locale: c.locale,
        reviewedAt: c.reviewedAt,
        reviewedBy: c.reviewedBy,
        reach: (c.approvedSchools?.reach ?? []).map((r) => r.school),
        promptVersion: c.promptVersion,
      }));
      res.json({ ...stats, cases });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/crm/training-corpus/sync-from-eval", async (req, res) => {
    const admin = await ctx.requireAdmin(req, res);
    if (!admin) return;
    try {
      const [{ data: reviews }, { data: cases }, { data: runs }, { data: results }] = await Promise.all([
        admin.admin
          .from("report_eval_reviews")
          .select("*")
          .in("status", ["submitted", "approved"])
          .order("updated_at", { ascending: false }),
        admin.admin.from("report_eval_cases").select("*"),
        admin.admin.from("report_eval_runs").select("*"),
        admin.admin.from("report_eval_run_results").select("*"),
      ]);

      const caseById = new Map((cases ?? []).map((c) => [c.id, c]));
      const runById = new Map((runs ?? []).map((r) => [r.id, r]));
      const resultByKey = new Map((results ?? []).map((r) => [`${r.run_id}:${r.case_id}`, r]));

      const synced = [];
      const skipped = [];

      for (const reviewRow of reviews ?? []) {
        const caseRow = caseById.get(reviewRow.case_id);
        const runRow = runById.get(reviewRow.run_id);
        const resultRow = resultByKey.get(`${reviewRow.run_id}:${reviewRow.case_id}`);
        if (!caseRow) {
          skipped.push({ caseId: reviewRow.case_id, reason: "case_missing" });
          continue;
        }

        const evalCase = {
          caseKey: caseRow.case_key,
          title: caseRow.title,
          tags: caseRow.tags ?? [],
          reportBody: caseRow.report_body,
        };
        const review = {
          status: reviewRow.status,
          finalApprovedRecommendation: reviewRow.final_approved_recommendation,
          overallNotes: reviewRow.overall_notes,
          reviewedBy: reviewRow.reviewed_by,
          submittedAt: reviewRow.submitted_at,
          approvedAt: reviewRow.approved_at,
          runId: reviewRow.run_id,
        };
        const result = resultRow
          ? { reportPayload: resultRow.report_payload ?? null }
          : null;
        const run = runRow
          ? { id: runRow.id, promptVersion: runRow.prompt_version }
          : null;

        const out = upsertGoldCaseFromEval({ evalCase, review, result, run });
        if (out.ok) synced.push(out.caseKey);
        else skipped.push({ caseKey: evalCase.caseKey, reason: out.reason });
      }

      res.json({
        syncedCount: synced.length,
        syncedCaseKeys: synced,
        skipped,
        stats: getCorpusStats(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/crm/training-corpus/export/sft-jsonl", async (req, res) => {
    const admin = await ctx.requireAdmin(req, res);
    if (!admin) return;
    try {
      if (!ctx.buildUserPayload) {
        return res.status(500).json({ error: "build_user_payload_unavailable" });
      }
      const lines = exportSftJsonlLines(ctx.buildUserPayload, ctx.systemPromptForLocale);
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="onlyapply-sft-${stamp}.jsonl"`,
      );
      res.send(lines.length ? `${lines.join("\n")}\n` : "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });
}
