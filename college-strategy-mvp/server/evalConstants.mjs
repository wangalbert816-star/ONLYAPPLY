/** Shared eval harness constants — prompt/rubric versioning, not model fine-tuning. */

export const REPORT_PROMPT_VERSION = String(process.env.REPORT_PROMPT_VERSION ?? "2026.06.3").trim();
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
];

export const PROFILE_DIMENSION_KEYS = ["academic", "testing", "activities", "rigor", "strategy"];

export const SCHOOL_REVIEW_ACTIONS = ["agree", "adjust", "reject"];

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
];

export const REVIEW_STATUSES = ["draft", "submitted", "approved"];
