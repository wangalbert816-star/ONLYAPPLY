import {
  CORRECTION_REASON_CATEGORIES,
  PROFILE_DIMENSION_KEYS,
  RUBRIC_DIMENSIONS,
  SCHOOL_REVIEW_ACTIONS,
} from "./evalConstants.mjs";

export function mapEvalReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    caseId: row.case_id,
    status: row.status,
    rubricVersion: row.rubric_version,
    rubricScores: row.rubric_scores ?? {},
    schoolReviews: row.school_reviews ?? [],
    profileDimensionReviews: row.profile_dimension_reviews ?? [],
    finalApprovedRecommendation: row.final_approved_recommendation ?? {},
    overallNotes: row.overall_notes ?? "",
    reviewedBy: row.reviewed_by,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseRubricScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function parseProfileScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n);
}

export function normalizeReviewInput(body, reviewerEmail) {
  const status = String(body?.status ?? "draft").trim();
  if (!["draft", "submitted", "approved"].includes(status)) {
    return { error: "eval_review_status_invalid" };
  }

  const rubricScores = {};
  const rawRubric = body?.rubricScores ?? body?.rubric_scores ?? {};
  if (rawRubric && typeof rawRubric === "object" && !Array.isArray(rawRubric)) {
    for (const key of RUBRIC_DIMENSIONS) {
      const entry = rawRubric[key];
      if (!entry || typeof entry !== "object") continue;
      const score = parseRubricScore(entry.score);
      const notes = String(entry.notes ?? "").trim();
      if (score != null || notes) {
        rubricScores[key] = { score, notes: notes || null };
      }
    }
  }

  const schoolReviews = [];
  const rawSchools = body?.schoolReviews ?? body?.school_reviews ?? [];
  if (Array.isArray(rawSchools)) {
    for (const item of rawSchools.slice(0, 30)) {
      if (!item || typeof item !== "object") continue;
      const school = String(item.school ?? "").trim();
      if (!school) continue;
      const aiTier = String(item.aiTier ?? item.ai_tier ?? "").trim();
      const counselorTier = String(item.counselorTier ?? item.counselor_tier ?? "").trim();
      const action = String(item.action ?? "agree").trim();
      if (!SCHOOL_REVIEW_ACTIONS.includes(action)) continue;
      schoolReviews.push({
        school,
        aiTier: ["reach", "match", "safety"].includes(aiTier) ? aiTier : null,
        counselorTier: ["reach", "match", "safety"].includes(counselorTier) ? counselorTier : null,
        action,
        reason: String(item.reason ?? "").trim() || null,
        evidence: String(item.evidence ?? "").trim() || null,
      });
    }
  }

  const profileDimensionReviews = [];
  const rawProfile = body?.profileDimensionReviews ?? body?.profile_dimension_reviews ?? [];
  if (Array.isArray(rawProfile)) {
    for (const item of rawProfile.slice(0, 10)) {
      if (!item || typeof item !== "object") continue;
      const key = String(item.key ?? "").trim();
      if (!PROFILE_DIMENSION_KEYS.includes(key)) continue;
      const reasonCategory = String(item.reasonCategory ?? item.reason_category ?? "").trim();
      profileDimensionReviews.push({
        key,
        label: String(item.label ?? key).trim(),
        aiScore: parseProfileScore(item.aiScore ?? item.ai_score),
        counselorScore: parseProfileScore(item.counselorScore ?? item.counselor_score),
        reason: String(item.reason ?? "").trim() || null,
        reasonCategory: CORRECTION_REASON_CATEGORIES.includes(reasonCategory) ? reasonCategory : null,
      });
    }
  }

  const rawFinal = body?.finalApprovedRecommendation ?? body?.final_approved_recommendation ?? {};
  const pickSchools = (value) =>
    Array.isArray(value)
      ? value.map((s) => String(s ?? "").trim()).filter(Boolean).slice(0, 5)
      : [];
  const finalApprovedRecommendation = {
    reach: pickSchools(rawFinal.reach),
    match: pickSchools(rawFinal.match),
    safety: pickSchools(rawFinal.safety),
    notes: String(rawFinal.notes ?? "").trim() || null,
  };

  const now = new Date().toISOString();
  return {
    payload: {
      status,
      rubric_scores: rubricScores,
      school_reviews: schoolReviews,
      profile_dimension_reviews: profileDimensionReviews,
      final_approved_recommendation: finalApprovedRecommendation,
      overall_notes: String(body?.overallNotes ?? body?.overall_notes ?? "").trim() || null,
      reviewed_by: reviewerEmail,
      submitted_at: status === "submitted" || status === "approved" ? now : null,
      approved_at: status === "approved" ? now : null,
      updated_at: now,
    },
  };
}

function rubricAverage(rubricScores) {
  const nums = RUBRIC_DIMENSIONS.map((key) => rubricScores?.[key]?.score).filter(
    (n) => typeof n === "number",
  );
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function buildDashboardStats(reviews, runsById) {
  const submitted = reviews.filter((r) => r.status === "submitted" || r.status === "approved");
  const dimensionTotals = Object.fromEntries(RUBRIC_DIMENSIONS.map((k) => [k, { sum: 0, count: 0 }]));
  const correctionCategoryCounts = Object.fromEntries(CORRECTION_REASON_CATEGORIES.map((k) => [k, 0]));
  const adjustedProfileCounts = Object.fromEntries(PROFILE_DIMENSION_KEYS.map((k) => [k, 0]));
  let schoolAgree = 0;
  let schoolTotal = 0;
  let overallSum = 0;
  let overallCount = 0;
  const byPromptVersion = new Map();

  for (const review of submitted) {
    const rubric = review.rubric_scores ?? {};
    for (const key of RUBRIC_DIMENSIONS) {
      const score = rubric[key]?.score;
      if (typeof score === "number") {
        dimensionTotals[key].sum += score;
        dimensionTotals[key].count += 1;
      }
    }
    const avg = rubricAverage(rubric);
    if (avg != null) {
      overallSum += avg;
      overallCount += 1;
    }

    for (const row of review.profile_dimension_reviews ?? []) {
      if (row.reasonCategory) {
        correctionCategoryCounts[row.reasonCategory] = (correctionCategoryCounts[row.reasonCategory] ?? 0) + 1;
      }
      if (
        typeof row.aiScore === "number" &&
        typeof row.counselorScore === "number" &&
        row.aiScore !== row.counselorScore
      ) {
        adjustedProfileCounts[row.key] = (adjustedProfileCounts[row.key] ?? 0) + 1;
      }
    }

    for (const row of review.school_reviews ?? []) {
      schoolTotal += 1;
      if (row.action === "agree") schoolAgree += 1;
    }

    const run = runsById.get(review.run_id);
    const promptVersion = run?.prompt_version ?? "unknown";
    const bucket = byPromptVersion.get(promptVersion) ?? { promptVersion, count: 0, scoreSum: 0, scoreCount: 0 };
    bucket.count += 1;
    if (avg != null) {
      bucket.scoreSum += avg;
      bucket.scoreCount += 1;
    }
    byPromptVersion.set(promptVersion, bucket);
  }

  return {
    reviewedCount: submitted.length,
    draftCount: reviews.filter((r) => r.status === "draft").length,
    averageReportScore: overallCount ? overallSum / overallCount : null,
    dimensionAverages: Object.fromEntries(
      RUBRIC_DIMENSIONS.map((key) => [
        key,
        dimensionTotals[key].count ? dimensionTotals[key].sum / dimensionTotals[key].count : null,
      ]),
    ),
    correctionCategoryCounts,
    adjustedProfileCounts,
    schoolTierAccuracyRate: schoolTotal ? schoolAgree / schoolTotal : null,
    schoolReviewCount: schoolTotal,
    byPromptVersion: [...byPromptVersion.values()].map((row) => ({
      promptVersion: row.promptVersion,
      reviewCount: row.count,
      averageReportScore: row.scoreCount ? row.scoreSum / row.scoreCount : null,
    })),
  };
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCorrectionCsv(rows) {
  const header = [
    "case_key",
    "case_title",
    "run_label",
    "prompt_version",
    "rubric_version",
    "report_template_version",
    "model",
    "review_status",
    "record_type",
    "dimension_or_school",
    "ai_value",
    "counselor_value",
    "action",
    "reason_category",
    "reason",
    "evidence",
  ].join(",");
  const lines = [header];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function flattenReviewToCsvRows(entry) {
  const { evalCase, run, result, review } = entry;
  const base = [
    evalCase.caseKey,
    evalCase.title,
    run.label,
    run.promptVersion ?? "",
    run.rubricVersion ?? review.rubricVersion ?? "",
    run.reportTemplateVersion ?? "",
    result.model ?? "",
    review.status,
  ];
  const rows = [];
  for (const key of RUBRIC_DIMENSIONS) {
    const item = review.rubricScores?.[key] ?? review.rubric_scores?.[key];
    if (!item) continue;
    rows.push([
      ...base,
      "rubric",
      key,
      "",
      item.score ?? "",
      "",
      "",
      item.notes ?? "",
      "",
    ]);
  }
  for (const item of review.schoolReviews ?? review.school_reviews ?? []) {
    rows.push([
      ...base,
      "school",
      item.school,
      item.aiTier ?? "",
      item.counselorTier ?? "",
      item.action,
      "",
      item.reason ?? "",
      item.evidence ?? "",
    ]);
  }
  for (const item of review.profileDimensionReviews ?? review.profile_dimension_reviews ?? []) {
    rows.push([
      ...base,
      "profile_dimension",
      item.key,
      item.aiScore ?? "",
      item.counselorScore ?? "",
      "",
      item.reasonCategory ?? "",
      item.reason ?? "",
      "",
    ]);
  }
  return rows;
}

export function buildEngineeringSummary(entries, stats) {
  const lines = [
    "OnlyApply Report Eval — Engineering Summary",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Reviewed cases: ${stats.reviewedCount}`,
    `Average rubric score (1-5): ${stats.averageReportScore != null ? stats.averageReportScore.toFixed(2) : "—"}`,
    `School tier agree rate: ${stats.schoolTierAccuracyRate != null ? `${Math.round(stats.schoolTierAccuracyRate * 100)}%` : "—"}`,
    "",
    "Top correction categories:",
  ];
  const topCategories = Object.entries(stats.correctionCategoryCounts ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (!topCategories.length) lines.push("- none yet");
  else topCategories.forEach(([k, n]) => lines.push(`- ${k}: ${n}`));

  lines.push("", "Performance by prompt version:");
  for (const row of stats.byPromptVersion ?? []) {
    lines.push(
      `- ${row.promptVersion}: ${row.reviewCount} reviews, avg ${row.averageReportScore != null ? row.averageReportScore.toFixed(2) : "—"}`,
    );
  }

  lines.push("", "Cases:");
  for (const entry of entries) {
    const avg = rubricAverage(entry.review.rubricScores ?? entry.review.rubric_scores);
    lines.push(
      `- ${entry.evalCase.title} (${entry.evalCase.caseKey}) · status=${entry.review.status} · avg=${avg != null ? avg.toFixed(2) : "—"} · prompt=${entry.run.promptVersion ?? "?"}`,
    );
  }
  lines.push("", "This is human correction data for prompt/rubric iteration — not model fine-tuning.");
  return lines.join("\n");
}
