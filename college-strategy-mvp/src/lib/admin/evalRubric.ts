/** Eval harness constants — prompt/rubric evaluation, not model fine-tuning. */

export const REPORT_PROMPT_VERSION = "2026.06.2";
export const REPORT_RUBRIC_VERSION = "1.0";
export const REPORT_TEMPLATE_VERSION = "1.0";

export const RUBRIC_DIMENSIONS = [
  "positioning_accuracy",
  "school_tier_accuracy",
  "five_dimension_score_accuracy",
  "explanation_quality",
  "school_fit_reasoning",
  "major_career_fit_reasoning",
  "next_step_usefulness",
  "tone_clarity",
  "hallucination",
] as const;

export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

export const PROFILE_DIMENSION_KEYS = ["academic", "testing", "activities", "rigor", "strategy"] as const;

export type ProfileDimensionKey = (typeof PROFILE_DIMENSION_KEYS)[number];

export const SCHOOL_REVIEW_ACTIONS = ["agree", "adjust", "reject"] as const;

export type SchoolReviewAction = (typeof SCHOOL_REVIEW_ACTIONS)[number];

export const CORRECTION_REASON_CATEGORIES = [
  "overestimated_academic_strength",
  "underestimated_academic_strength",
  "overestimated_activity_depth",
  "underestimated_activity_depth",
  "narrative_unclear",
  "major_competitiveness_underestimated",
  "school_fit_mismatch",
  "missing_student_information",
  "unsupported_claim",
  "tone_issue",
] as const;

export type CorrectionReasonCategory = (typeof CORRECTION_REASON_CATEGORIES)[number];

export type RubricScoreEntry = {
  score: number | null;
  notes: string;
};

export type SchoolReviewEntry = {
  school: string;
  aiTier: "reach" | "match" | "safety" | null;
  counselorTier: "reach" | "match" | "safety" | null;
  action: SchoolReviewAction;
  reason: string;
  evidence: string;
};

export type ProfileDimensionReviewEntry = {
  key: ProfileDimensionKey;
  label: string;
  aiScore: number | null;
  counselorScore: number | null;
  reason: string;
  reasonCategory: CorrectionReasonCategory | "";
};

export type FinalApprovedRecommendation = {
  reach: string[];
  match: string[];
  safety: string[];
  notes: string;
};

export type EvalReviewDraft = {
  status: "draft" | "submitted" | "approved";
  rubricScores: Record<RubricDimension, RubricScoreEntry>;
  schoolReviews: SchoolReviewEntry[];
  profileDimensionReviews: ProfileDimensionReviewEntry[];
  finalApprovedRecommendation: FinalApprovedRecommendation;
  overallNotes: string;
};

export type EvalReviewStatus = EvalReviewDraft["status"];

export function emptyRubricScores(): Record<RubricDimension, RubricScoreEntry> {
  return Object.fromEntries(RUBRIC_DIMENSIONS.map((key) => [key, { score: null, notes: "" }])) as Record<
    RubricDimension,
    RubricScoreEntry
  >;
}

export function rubricAverage(scores: Record<RubricDimension, RubricScoreEntry>): number | null {
  const nums = RUBRIC_DIMENSIONS.map((k) => scores[k]?.score).filter((n): n is number => typeof n === "number");
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
