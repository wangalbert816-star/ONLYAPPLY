/** Alumni report reviews — Supabase primary with JSON fallback for local dev. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { isForeignKeyError } from "./apiError.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(__dirname, "..", "data", "alumni", "alumni-report-reviews.json");

function ensureDir() {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readAll() {
  ensureDir();
  if (!fs.existsSync(STORE_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  ensureDir();
  fs.writeFileSync(STORE_FILE, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

function isTableMissingError(error) {
  const msg =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : String(error ?? "");
  return /relation .* does not exist|could not find the table/i.test(msg);
}

function pickAlumniReviewPayload(payload = {}) {
  return {
    status: payload.status ?? "draft",
    rubric_scores: payload.rubric_scores ?? {},
    school_reviews: payload.school_reviews ?? [],
    profile_dimension_reviews: payload.profile_dimension_reviews ?? [],
    final_approved_recommendation: payload.final_approved_recommendation ?? {},
    overall_notes: payload.overall_notes ?? null,
    submitted_at: payload.submitted_at ?? null,
  };
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

async function upsertAlumniReviewSupabase(admin, userId, input) {
  const now = new Date().toISOString();
  const reviewId = String(input.reviewId ?? "").trim() || null;
  const reportId = isUuid(input.reportId) ? input.reportId : null;
  const applicationId = isUuid(input.applicationId) ? input.applicationId : null;
  const expectedUpdatedAt = input.expectedUpdatedAt ?? null;

  if (!reviewId && !reportId) {
    throw new Error("alumni_review_report_required");
  }

  if (reviewId && expectedUpdatedAt) {
    const current = await getAlumniReviewForUser(admin, userId, reviewId);
    if (!current) throw new Error("alumni_review_not_found");
    if (String(current.updated_at) !== String(expectedUpdatedAt)) {
      throw new Error("alumni_review_conflict");
    }
  }

  const row = {
    user_id: userId,
    application_id: applicationId,
    report_id: reportId,
    intake_term: input.intakeTerm ?? null,
    locale: input.locale ?? "zh",
    report_snapshot: input.reportSnapshot ?? {},
    form_snapshot: input.formSnapshot ?? {},
    rubric_version: input.rubricVersion,
    ...pickAlumniReviewPayload(input.payload),
    updated_at: now,
  };

  let data;
  let error;
  if (reviewId) {
    ({ data, error } = await admin
      .from("alumni_report_reviews")
      .update(row)
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select("*")
      .single());
  } else if (reportId) {
    const { data: existing, error: findErr } = await admin
      .from("alumni_report_reviews")
      .select("id")
      .eq("user_id", userId)
      .eq("report_id", reportId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing?.id) {
      ({ data, error } = await admin
        .from("alumni_report_reviews")
        .update(row)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("*")
        .single());
    } else {
      ({ data, error } = await admin.from("alumni_report_reviews").insert(row).select("*").single());
    }
  } else {
    ({ data, error } = await admin.from("alumni_report_reviews").insert(row).select("*").single());
  }
  if (error) throw error;
  return { row: data, source: "supabase" };
}

export async function listAlumniReviews(admin, userId, reportId) {
  if (admin) {
    try {
      let query = admin
        .from("alumni_report_reviews")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (reportId) query = query.eq("report_id", reportId);
      const { data, error } = await query;
      if (error) throw error;
      return { rows: data ?? [], source: "supabase" };
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  let rows = readAll().filter((r) => r.user_id === userId);
  if (reportId) rows = rows.filter((r) => r.report_id === reportId);
  rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return { rows: rows.slice(0, 20), source: "file" };
}

export async function upsertAlumniReview(admin, userId, input) {
  const now = new Date().toISOString();
  const reviewId = String(input.reviewId ?? "").trim() || null;
  const reportId = input.reportId ?? null;

  if (!reviewId && !reportId) {
    throw new Error("alumni_review_report_required");
  }

  if (admin) {
    try {
      return await upsertAlumniReviewSupabase(admin, userId, input);
    } catch (e) {
      if (isTableMissingError(e)) {
        /* fall through to file store */
      } else if (isForeignKeyError(e)) {
        throw new Error("alumni_review_report_link_invalid");
      } else {
        throw e;
      }
    }
  }

  const rows = readAll();
  let existingIdx = -1;
  if (reviewId) {
    existingIdx = rows.findIndex((r) => r.id === reviewId && r.user_id === userId);
  } else if (reportId) {
    existingIdx = rows.findIndex((r) => r.report_id === reportId && r.user_id === userId);
  }

  if (reviewId && input.expectedUpdatedAt && existingIdx >= 0) {
    if (String(rows[existingIdx].updated_at) !== String(input.expectedUpdatedAt)) {
      throw new Error("alumni_review_conflict");
    }
  }

  const nextRow = {
    id: existingIdx >= 0 ? rows[existingIdx].id : randomUUID(),
    user_id: userId,
    application_id: input.applicationId ?? null,
    report_id: reportId,
    intake_term: input.intakeTerm ?? null,
    locale: input.locale ?? "zh",
    report_snapshot: input.reportSnapshot ?? {},
    form_snapshot: input.formSnapshot ?? {},
    rubric_version: input.rubricVersion,
    ...pickAlumniReviewPayload(input.payload),
    created_at: existingIdx >= 0 ? rows[existingIdx].created_at : now,
    updated_at: now,
  };

  if (existingIdx >= 0) rows[existingIdx] = nextRow;
  else rows.push(nextRow);
  writeAll(rows);
  return { row: nextRow, source: "file" };
}

export async function listAlumniReviewsAdmin(admin, { status, limit = 50 } = {}) {
  if (!admin) return { rows: [], source: "none" };
  let query = admin
    .from("alumni_report_reviews")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return { rows: data ?? [], source: "supabase" };
}

export async function getAlumniReviewById(admin, reviewId) {
  if (!admin) return null;
  const { data, error } = await admin
    .from("alumni_report_reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getAlumniReviewForUser(admin, userId, reviewId) {
  if (admin) {
    try {
      const { data, error } = await admin
        .from("alumni_report_reviews")
        .select("*")
        .eq("id", reviewId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }
  }
  return readAll().find((r) => r.id === reviewId && r.user_id === userId) ?? null;
}

export async function updateAlumniReviewById(admin, reviewId, payload, { expectedUpdatedAt } = {}) {
  if (!admin) throw new Error("supabase_admin_missing");
  if (expectedUpdatedAt) {
    const current = await getAlumniReviewById(admin, reviewId);
    if (!current) throw new Error("alumni_review_not_found");
    if (String(current.updated_at) !== String(expectedUpdatedAt)) {
      throw new Error("alumni_review_conflict");
    }
  }
  const now = new Date().toISOString();
  const patch = {
    ...pickAlumniReviewPayload(payload),
    updated_at: now,
  };
  const { data, error } = await admin
    .from("alumni_report_reviews")
    .update(patch)
    .eq("id", reviewId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setAlumniReviewStatus(admin, reviewId, { status, approvedBy }) {
  if (!admin) throw new Error("supabase_admin_missing");
  const now = new Date().toISOString();
  const patch = { status, updated_at: now };
  if (status === "approved") {
    patch.approved_at = now;
    patch.approved_by = approvedBy ?? null;
  } else if (status === "draft") {
    patch.approved_at = null;
    patch.approved_by = null;
    patch.submitted_at = null;
  }
  const { data, error } = await admin
    .from("alumni_report_reviews")
    .update(patch)
    .eq("id", reviewId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
