/** Admin: review and approve alumni past-cycle feedback. */

import { mapEvalReview, normalizeReviewInput } from "./adminEvalReview.mjs";
import { extractErrorMessage } from "./apiError.mjs";
import { syncApprovedAlumniReview } from "./alumniReviewSync.mjs";
import {
  getAlumniReviewById,
  listAlumniReviewsAdmin,
  setAlumniReviewStatus,
  updateAlumniReviewById,
} from "./alumniReviewsStore.mjs";

function mapAlumniReviewRow(row) {
  if (!row) return null;
  const base = mapEvalReview({
    ...row,
    run_id: null,
    case_id: null,
    reviewed_by: row.user_id,
  });
  return {
    ...base,
    id: row.id,
    userId: row.user_id,
    applicationId: row.application_id,
    reportId: row.report_id,
    intakeTerm: row.intake_term,
    locale: row.locale,
    reportSnapshot: row.report_snapshot ?? {},
    formSnapshot: row.form_snapshot ?? {},
    approvedBy: row.approved_by ?? null,
  };
}

async function enrichWithUserEmail(admin, row) {
  let userEmail = null;
  try {
    const { data } = await admin.auth.admin.getUserById(row.user_id);
    userEmail = data?.user?.email ?? null;
  } catch {
    /* optional */
  }
  return { ...mapAlumniReviewRow(row), userEmail };
}

export function registerAlumniReviewsAdminRoutes(app, { requireAdmin }) {
  app.get("/api/admin/crm/alumni/reviews", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const status = String(req.query.status ?? "").trim() || null;
    try {
      const { rows } = await listAlumniReviewsAdmin(ctx.admin, { status });
      const reviews = await Promise.all(rows.map((row) => enrichWithUserEmail(ctx.admin, row)));
      res.json({ reviews });
    } catch (e) {
      res.status(500).json({ error: extractErrorMessage(e) });
    }
  });

  app.get("/api/admin/crm/alumni/reviews/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "eval_id_required" });
    try {
      const row = await getAlumniReviewById(ctx.admin, id);
      if (!row) return res.status(404).json({ error: "alumni_review_not_found" });
      const review = await enrichWithUserEmail(ctx.admin, row);
      res.json({ review });
    } catch (e) {
      res.status(500).json({ error: extractErrorMessage(e) });
    }
  });

  app.put("/api/admin/crm/alumni/reviews/:id", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "eval_id_required" });
    try {
      const row = await getAlumniReviewById(ctx.admin, id);
      if (!row) return res.status(404).json({ error: "alumni_review_not_found" });
      if (row.status === "approved") {
        return res.status(400).json({ error: "alumni_review_locked" });
      }

      const normalized = normalizeReviewInput(req.body ?? {}, ctx.user.email ?? ctx.user.id);
      if (normalized.error) return res.status(400).json({ error: normalized.error });
      if (normalized.payload.status === "approved") {
        return res.status(400).json({ error: "alumni_review_status_invalid" });
      }

      const updated = await updateAlumniReviewById(ctx.admin, id, normalized.payload);
      const review = await enrichWithUserEmail(ctx.admin, updated);
      res.json({ review });
    } catch (e) {
      res.status(500).json({ error: extractErrorMessage(e) });
    }
  });

  app.post("/api/admin/crm/alumni/reviews/:id/approve", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "eval_id_required" });
    try {
      const row = await getAlumniReviewById(ctx.admin, id);
      if (!row) return res.status(404).json({ error: "alumni_review_not_found" });
      if (row.status !== "submitted") {
        return res.status(400).json({ error: "alumni_review_not_submitted" });
      }

      const sync = await syncApprovedAlumniReview(row, ctx.user.email ?? ctx.user.id);
      if (!sync.decisionEngine?.ok || !sync.trainingCorpus?.ok) {
        const reason =
          sync.decisionEngine?.reason ?? sync.trainingCorpus?.reason ?? "alumni_sync_failed";
        return res.status(400).json({ error: reason, sync });
      }

      const updated = await setAlumniReviewStatus(ctx.admin, id, {
        status: "approved",
        approvedBy: ctx.user.email ?? ctx.user.id,
      });
      const review = await enrichWithUserEmail(ctx.admin, updated);
      res.json({ review, sync });
    } catch (e) {
      res.status(500).json({ error: extractErrorMessage(e) });
    }
  });

  app.post("/api/admin/crm/alumni/reviews/:id/reject", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "eval_id_required" });
    try {
      const row = await getAlumniReviewById(ctx.admin, id);
      if (!row) return res.status(404).json({ error: "alumni_review_not_found" });
      if (row.status !== "submitted") {
        return res.status(400).json({ error: "alumni_review_not_submitted" });
      }
      const updated = await setAlumniReviewStatus(ctx.admin, id, { status: "draft" });
      const review = await enrichWithUserEmail(ctx.admin, updated);
      res.json({ review });
    } catch (e) {
      res.status(500).json({ error: extractErrorMessage(e) });
    }
  });
}
