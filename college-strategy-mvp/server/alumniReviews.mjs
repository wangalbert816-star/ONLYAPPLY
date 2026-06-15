/** Past-cycle student report reviews (authenticated users). */

import { REPORT_RUBRIC_VERSION } from "./evalConstants.mjs";
import { mapEvalReview, normalizeReviewInput } from "./adminEvalReview.mjs";
import { listAlumniReviews, upsertAlumniReview } from "./alumniReviewsStore.mjs";
import { extractErrorMessage } from "./apiError.mjs";

function mapAlumniReviewRow(row) {
  if (!row) return null;
  const base = mapEvalReview({
    ...row,
    run_id: null,
    case_id: null,
    reviewed_by: row.user_id,
    approved_at: null,
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
  };
}

async function requireAuthedUser(req, res, supabaseAdmin) {
  const admin = supabaseAdmin();
  if (!admin) {
    res.status(503).json({ error: "supabase_admin_missing" });
    return null;
  }
  const token = (req.headers.authorization || "").startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : "";
  if (!token) {
    res.status(401).json({ error: "auth_required" });
    return null;
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.id) {
    res.status(401).json({ error: "invalid_session" });
    return null;
  }
  return { admin, user: data.user };
}

export function registerAlumniReviewRoutes(app, { supabaseAdmin, express }) {
  const putHandler = async (req, res) => {
    try {
      const ctx = await requireAuthedUser(req, res, supabaseAdmin);
      if (!ctx) return;

      const normalized = normalizeReviewInput(req.body ?? {}, ctx.user.email ?? ctx.user.id);
      if (normalized.error) return res.status(400).json({ error: normalized.error });

      const reportId = String(req.body?.reportId ?? "").trim() || null;
      const applicationId = String(req.body?.applicationId ?? "").trim() || null;
      let reportSnapshot = req.body?.reportSnapshot;
      let formSnapshot = req.body?.formSnapshot;
      const intakeTerm = String(req.body?.intakeTerm ?? "").trim() || null;
      const locale = req.body?.locale === "en" ? "en" : "zh";
      const reviewId = String(req.body?.id ?? "").trim() || null;

      if (reviewId) {
        const { rows } = await listAlumniReviews(ctx.admin, ctx.user.id);
        const existing = rows.find((r) => r.id === reviewId && r.user_id === ctx.user.id);
        if (!existing) return res.status(404).json({ error: "alumni_review_not_found" });
        if (!reportSnapshot || typeof reportSnapshot !== "object") {
          reportSnapshot = existing.report_snapshot ?? {};
        }
        if (!formSnapshot || typeof formSnapshot !== "object") {
          formSnapshot = existing.form_snapshot ?? {};
        }
      } else if (!reportSnapshot || typeof reportSnapshot !== "object") {
        return res.status(400).json({ error: "alumni_report_snapshot_required" });
      }

      const { row, source } = await upsertAlumniReview(ctx.admin, ctx.user.id, {
        reviewId,
        reportId,
        applicationId,
        intakeTerm,
        locale,
        reportSnapshot,
        formSnapshot,
        rubricVersion: REPORT_RUBRIC_VERSION,
        payload: normalized.payload,
      });

      if (source === "file") {
        res.setHeader("X-Alumni-Review-Store", "file");
      }
      res.json({ review: mapAlumniReviewRow(row) });
    } catch (e) {
      res.status(500).json({ error: extractErrorMessage(e) });
    }
  };

  app.put("/api/alumni/report-reviews", express.json({ limit: "4mb" }), (req, res) => {
    void putHandler(req, res);
  });

  app.get("/api/alumni/report-reviews/mine", async (req, res) => {
    const ctx = await requireAuthedUser(req, res, supabaseAdmin);
    if (!ctx) return;
    const reportId = String(req.query.reportId ?? "").trim();
    try {
      const { rows, source } = await listAlumniReviews(ctx.admin, ctx.user.id, reportId || null);
      if (source === "file") res.setHeader("X-Alumni-Review-Store", "file");
      res.json({ reviews: rows.map(mapAlumniReviewRow) });
    } catch (e) {
      res.status(500).json({ error: extractErrorMessage(e) });
    }
  });
}
