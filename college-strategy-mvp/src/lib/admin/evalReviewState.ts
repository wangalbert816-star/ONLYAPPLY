import type { Locale } from "../../i18n/strings";
import type { ReportPayload } from "../../types";
import { buildFiveDimensionProfile, type ProfileDimensionKey } from "../fiveDimensionProfile";
import { reportBodyToFormState } from "./evalCaseForm";
import type {
  AdminEvalCase,
  AdminEvalReview,
  AdminEvalRunResult,
} from "./crmAdminApi";
import {
  CORRECTION_REASON_CATEGORIES,
  emptyRubricScores,
  PROFILE_DIMENSION_KEYS,
  type EvalReviewDraft,
  type FinalApprovedRecommendation,
  type ProfileDimensionReviewEntry,
  type RubricDimension,
  type SchoolReviewEntry,
} from "./evalRubric";

function schoolsFromReport(report: ReportPayload | null | undefined) {
  const rows: SchoolReviewEntry[] = [];
  if (!report) return rows;
  const tiers = [
    ["reach", report.reach] as const,
    ["match", report.match] as const,
    ["safety", report.safety] as const,
  ];
  for (const [tier, list] of tiers) {
    for (const row of list ?? []) {
      const school = String(row.school ?? "").trim();
      if (!school) continue;
      rows.push({
        school,
        aiTier: tier,
        counselorTier: tier,
        action: "agree",
        reason: "",
        evidence: "",
      });
    }
  }
  return rows;
}

function profileReviewsFromReport(
  reportBody: Record<string, unknown>,
  labelForKey: (key: ProfileDimensionKey) => string,
): ProfileDimensionReviewEntry[] {
  const form = reportBodyToFormState(reportBody);
  const locale = (reportBody.locale === "zh" ? "zh" : "en") as Locale;
  const profile = buildFiveDimensionProfile(form, locale);
  return PROFILE_DIMENSION_KEYS.map((key) => {
    const dim = profile.find((d) => d.key === key);
    const score = dim?.score ?? null;
    return {
      key,
      label: labelForKey(key),
      aiScore: score,
      counselorScore: score,
      reason: "",
      reasonCategory: "",
    };
  });
}

function finalFromCase(c: AdminEvalCase): FinalApprovedRecommendation {
  return {
    reach: c.expectedReach.map((s) => s.school),
    match: c.expectedMatch.map((s) => s.school),
    safety: c.expectedSafety.map((s) => s.school),
    notes: c.notes ?? "",
  };
}

export function buildInitialReviewDraft(
  evalCase: AdminEvalCase,
  result: AdminEvalRunResult,
  labelForKey: (key: ProfileDimensionKey) => string,
): EvalReviewDraft {
  const report = (result.reportPayload ?? null) as ReportPayload | null;
  return {
    status: "draft",
    rubricScores: emptyRubricScores(),
    schoolReviews: schoolsFromReport(report),
    profileDimensionReviews: profileReviewsFromReport(evalCase.reportBody, labelForKey),
    finalApprovedRecommendation: finalFromCase(evalCase),
    overallNotes: "",
  };
}

export function reviewToDraft(review: AdminEvalReview, fallback: EvalReviewDraft): EvalReviewDraft {
  const rubricScores = emptyRubricScores();
  for (const key of Object.keys(rubricScores) as RubricDimension[]) {
    const entry = review.rubricScores[key];
    rubricScores[key] = {
      score: typeof entry?.score === "number" ? entry.score : null,
      notes: entry?.notes ?? "",
    };
  }
  return {
    status: review.status,
    rubricScores,
    schoolReviews: review.schoolReviews.length
      ? review.schoolReviews.map((row) => ({
          school: row.school,
          aiTier: row.aiTier,
          counselorTier: row.counselorTier,
          action: row.action,
          reason: row.reason ?? "",
          evidence: row.evidence ?? "",
        }))
      : fallback.schoolReviews,
    profileDimensionReviews: review.profileDimensionReviews.length
      ? review.profileDimensionReviews.map((row) => ({
          key: row.key as ProfileDimensionKey,
          label: row.label,
          aiScore: row.aiScore,
          counselorScore: row.counselorScore,
          reason: row.reason ?? "",
          reasonCategory: (row.reasonCategory ?? "") as ProfileDimensionReviewEntry["reasonCategory"],
        }))
      : fallback.profileDimensionReviews,
    finalApprovedRecommendation: {
      reach: review.finalApprovedRecommendation.reach ?? fallback.finalApprovedRecommendation.reach,
      match: review.finalApprovedRecommendation.match ?? fallback.finalApprovedRecommendation.match,
      safety: review.finalApprovedRecommendation.safety ?? fallback.finalApprovedRecommendation.safety,
      notes: review.finalApprovedRecommendation.notes ?? fallback.finalApprovedRecommendation.notes,
    },
    overallNotes: review.overallNotes ?? "",
  };
}

export function draftToReviewPayload(draft: EvalReviewDraft) {
  return {
    status: draft.status,
    rubricScores: Object.fromEntries(
      Object.entries(draft.rubricScores).map(([key, value]) => [
        key,
        { score: value.score, notes: value.notes.trim() || null },
      ]),
    ),
    schoolReviews: draft.schoolReviews.map((row) => ({
      school: row.school,
      aiTier: row.aiTier,
      counselorTier: row.counselorTier,
      action: row.action,
      reason: row.reason.trim() || null,
      evidence: row.evidence.trim() || null,
    })),
    profileDimensionReviews: draft.profileDimensionReviews.map((row) => ({
      key: row.key,
      label: row.label,
      aiScore: row.aiScore,
      counselorScore: row.counselorScore,
      reason: row.reason.trim() || null,
      reasonCategory: CORRECTION_REASON_CATEGORIES.includes(row.reasonCategory as never)
        ? row.reasonCategory
        : null,
    })),
    finalApprovedRecommendation: {
      reach: draft.finalApprovedRecommendation.reach,
      match: draft.finalApprovedRecommendation.match,
      safety: draft.finalApprovedRecommendation.safety,
      notes: draft.finalApprovedRecommendation.notes.trim() || null,
    },
    overallNotes: draft.overallNotes.trim() || null,
  };
}

export function countSchoolCorrections(draft: EvalReviewDraft) {
  return draft.schoolReviews.filter((s) => s.action !== "agree").length;
}

export function countProfileAdjustments(draft: EvalReviewDraft) {
  return draft.profileDimensionReviews.filter(
    (d) => d.aiScore != null && d.counselorScore != null && d.aiScore !== d.counselorScore,
  ).length;
}
