/**
 * Counselor review feedback → Decision Engine training signals.
 * Rubric, school corrections, and profile adjustments feed benchmark storage,
 * v2 scoring overrides, and LLM prompt guidance.
 */

import {
  CORRECTION_REASON_CATEGORIES,
  PROFILE_DIMENSION_KEYS,
  RUBRIC_DIMENSIONS,
} from "./evalConstants.mjs";
import { profileCompositeScore } from "./fiveDimensionScore.mjs";

const RUBRIC_LABELS = {
  en: {
    positioning_accuracy: "Positioning accuracy",
    school_tier_accuracy: "School tier accuracy",
    five_dimension_score_accuracy: "Five-dimension score accuracy",
    explanation_quality: "Explanation quality",
    school_fit_reasoning: "School fit reasoning",
    major_career_fit_reasoning: "Major/career fit reasoning",
    next_step_usefulness: "Next-step usefulness",
    tone_clarity: "Tone & clarity",
    hallucination: "Hallucination control",
  },
  zh: {
    positioning_accuracy: "定位准确度",
    school_tier_accuracy: "冲稳保档位准确度",
    five_dimension_score_accuracy: "五维评分准确度",
    explanation_quality: "解释质量",
    school_fit_reasoning: "学校匹配理由",
    major_career_fit_reasoning: "专业/职业匹配",
    next_step_usefulness: "下一步建议实用性",
    tone_clarity: "语气与清晰度",
    hallucination: "幻觉/事实错误",
  },
};

const PROFILE_LABELS = {
  en: {
    academic: "Academic",
    testing: "Testing",
    activities: "Activities",
    rigor: "Rigor",
    strategy: "Strategy",
  },
  zh: {
    academic: "学术",
    testing: "标化",
    activities: "活动",
    rigor: "课程难度",
    strategy: "策略",
  },
};

function rubricAverage(rubricScores) {
  const nums = RUBRIC_DIMENSIONS.map((key) => rubricScores?.[key]?.score).filter(
    (n) => typeof n === "number",
  );
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Normalize eval review into engine-usable training feedback.
 * @param {object|null|undefined} review
 */
export function extractReviewFeedback(review) {
  if (!review || typeof review !== "object") return null;

  const rawRubric = review.rubricScores ?? review.rubric_scores ?? {};
  const rubricScores = {};
  for (const key of RUBRIC_DIMENSIONS) {
    const entry = rawRubric[key];
    if (!entry || typeof entry !== "object") continue;
    const score = typeof entry.score === "number" ? entry.score : null;
    const notes = String(entry.notes ?? "").trim() || null;
    if (score != null || notes) rubricScores[key] = { score, notes };
  }

  const schoolCorrections = [];
  for (const item of review.schoolReviews ?? review.school_reviews ?? []) {
    if (!item || typeof item !== "object") continue;
    const school = String(item.school ?? "").trim();
    if (!school) continue;
    const action = String(item.action ?? "agree").trim();
    const reason = String(item.reason ?? "").trim() || null;
    const evidence = String(item.evidence ?? "").trim() || null;
    if (action === "agree" && !reason && !evidence) continue;
    schoolCorrections.push({
      school,
      aiTier: item.aiTier ?? item.ai_tier ?? null,
      counselorTier: item.counselorTier ?? item.counselor_tier ?? null,
      action,
      reason,
      evidence,
    });
  }

  const profileAdjustments = [];
  const profileScoreOverrides = {};
  for (const item of review.profileDimensionReviews ?? review.profile_dimension_reviews ?? []) {
    if (!item || typeof item !== "object") continue;
    const key = String(item.key ?? "").trim();
    if (!PROFILE_DIMENSION_KEYS.includes(key)) continue;
    const aiScore = typeof (item.aiScore ?? item.ai_score) === "number" ? (item.aiScore ?? item.ai_score) : null;
    const counselorScore =
      typeof (item.counselorScore ?? item.counselor_score) === "number"
        ? (item.counselorScore ?? item.counselor_score)
        : null;
    const reason = String(item.reason ?? "").trim() || null;
    const reasonCategory = String(item.reasonCategory ?? item.reason_category ?? "").trim();
    const validCategory = CORRECTION_REASON_CATEGORIES.includes(reasonCategory) ? reasonCategory : null;

    if (
      aiScore == null &&
      counselorScore == null &&
      !reason &&
      !validCategory
    ) {
      continue;
    }

    profileAdjustments.push({
      key,
      label: String(item.label ?? key).trim(),
      aiScore,
      counselorScore,
      reason,
      reasonCategory: validCategory,
    });

    if (counselorScore != null && (aiScore == null || aiScore !== counselorScore)) {
      profileScoreOverrides[key] = counselorScore;
    }
  }

  const overallNotes = String(review.overallNotes ?? review.overall_notes ?? "").trim() || null;
  const avg = rubricAverage(rubricScores);
  const weakRubric = RUBRIC_DIMENSIONS.filter((key) => {
    const score = rubricScores[key]?.score;
    return typeof score === "number" && score <= 3;
  }).map((key) => ({
    key,
    score: rubricScores[key].score,
    notes: rubricScores[key].notes ?? null,
  }));

  const hasContent =
    Object.keys(rubricScores).length > 0 ||
    schoolCorrections.length > 0 ||
    profileAdjustments.length > 0 ||
    Boolean(overallNotes);

  if (!hasContent) return null;

  return {
    rubricScores,
    rubricAverage: avg,
    weakRubricDimensions: weakRubric,
    schoolCorrections,
    profileAdjustments,
    profileScoreOverrides,
    overallNotes,
    reviewedAt: review.approvedAt ?? review.submittedAt ?? review.updatedAt ?? null,
  };
}

/** @param {Record<string, number>} computed @param {Record<string, number>} overrides */
export function applyProfileScoreOverrides(computed, overrides) {
  if (!overrides || typeof overrides !== "object") return computed;
  const out = { ...computed };
  for (const key of PROFILE_DIMENSION_KEYS) {
    if (typeof overrides[key] === "number") out[key] = overrides[key];
  }
  return out;
}

/**
 * Blend counselor-calibrated profile scores by benchmark match strength.
 * @param {Record<string, number>} computed
 * @param {Record<string, number>} overrides
 * @param {number} matchScore
 * @param {number} [strongScore=10]
 */
export function blendProfileScoreOverrides(computed, overrides, matchScore, strongScore = 10) {
  if (!overrides || !Object.keys(overrides).length || !matchScore) return computed;
  const w = Math.min(1, matchScore / strongScore);
  if (w <= 0) return computed;
  const out = { ...computed };
  for (const key of PROFILE_DIMENSION_KEYS) {
    if (typeof overrides[key] !== "number") continue;
    const base = computed[key] ?? overrides[key];
    out[key] = Math.round(base * (1 - w) + overrides[key] * w);
  }
  return out;
}

export function profileScoresWithFeedback(computed, feedback, matchScore, strongScore = 10) {
  if (!feedback?.profileScoreOverrides || !Object.keys(feedback.profileScoreOverrides).length) {
    return computed;
  }
  if (matchScore >= strongScore) {
    return applyProfileScoreOverrides(computed, feedback.profileScoreOverrides);
  }
  return blendProfileScoreOverrides(computed, feedback.profileScoreOverrides, matchScore, strongScore);
}

/**
 * Compact bullet lines for few-shot / reference blocks.
 * @param {object|null} feedback
 * @param {"en"|"zh"} locale
 */
export function buildReviewFeedbackSummaryLines(feedback, locale = "zh") {
  if (!feedback) return [];
  const isEn = locale === "en";
  const lines = [];
  const rubricLabels = RUBRIC_LABELS[isEn ? "en" : "zh"];
  const profileLabels = PROFILE_LABELS[isEn ? "en" : "zh"];

  if (feedback.weakRubricDimensions?.length) {
    for (const row of feedback.weakRubricDimensions.slice(0, 4)) {
      const label = rubricLabels[row.key] ?? row.key;
      const note = row.notes ? ` — ${row.notes}` : "";
      lines.push(
        isEn
          ? `- Rubric gap (${label}, ${row.score}/5)${note}`
          : `- 量表薄弱（${label} ${row.score}/5）${note}`,
      );
    }
  }

  for (const row of (feedback.schoolCorrections ?? []).slice(0, 5)) {
    const tierPart =
      row.counselorTier && row.aiTier && row.counselorTier !== row.aiTier
        ? isEn
          ? `${row.aiTier}→${row.counselorTier}`
          : `${row.aiTier}→${row.counselorTier}`
        : row.action !== "agree"
          ? row.action
          : "";
    const reason = row.reason ? `: ${row.reason}` : "";
    lines.push(
      isEn
        ? `- School fix: ${row.school}${tierPart ? ` (${tierPart})` : ""}${reason}`
        : `- 选校修正：${row.school}${tierPart ? `（${tierPart}）` : ""}${reason}`,
    );
  }

  for (const row of (feedback.profileAdjustments ?? []).slice(0, 5)) {
    if (row.aiScore == null && row.counselorScore == null) continue;
    const label = profileLabels[row.key] ?? row.label ?? row.key;
    const delta =
      row.aiScore != null && row.counselorScore != null && row.aiScore !== row.counselorScore
        ? isEn
          ? ` ${row.aiScore}→${row.counselorScore}`
          : ` ${row.aiScore}→${row.counselorScore}`
        : row.counselorScore != null
          ? ` →${row.counselorScore}`
          : "";
    const cat = row.reasonCategory ? ` [${row.reasonCategory}]` : "";
    const reason = row.reason ? `: ${row.reason}` : "";
    lines.push(
      isEn
        ? `- Profile calibration (${label}${delta})${cat}${reason}`
        : `- 五维校准（${label}${delta}）${cat}${reason}`,
    );
  }

  if (feedback.overallNotes) {
    lines.push(isEn ? `- Counselor note: ${feedback.overallNotes}` : `- 审阅总评：${feedback.overallNotes}`);
  }

  return lines;
}

/**
 * Full prompt block injected when a benchmark / engine decision carries counselor training.
 * @param {object|null} feedback
 * @param {"en"|"zh"} locale
 * @param {{ caseTitle?: string, matchScore?: number|null }} [opts]
 */
export function buildReviewFeedbackPromptBlock(feedback, locale = "zh", opts = {}) {
  const lines = buildReviewFeedbackSummaryLines(feedback, locale);
  if (!lines.length) return "";

  const isEn = locale === "en";
  const title = opts.caseTitle ? (isEn ? `Case "${opts.caseTitle}"` : `案例「${opts.caseTitle}」`) : "";
  const matchNote =
    typeof opts.matchScore === "number" && opts.matchScore > 0
      ? isEn
        ? ` (profile similarity ${opts.matchScore})`
        : `（档案相似度 ${opts.matchScore}）`
      : "";

  if (isEn) {
    return `

[Counselor review training — apply these corrections to tone, tier logic, and five-dimension framing${title ? ` from ${title}${matchNote}` : ""}; do NOT copy school names unless they appear in the engine 9-school list above]

${lines.join("\n")}
`;
  }

  return `

【顾问审阅培训要点 — 请据此校准语气、分档逻辑与五维表述${title ? `（来自${title}${matchNote}）` : ""}；勿照搬校名，除非已出现在上方引擎 9 校名单】

${lines.join("\n")}
`;
}

export function feedbackTrainingStats(feedback) {
  if (!feedback) {
    return {
      rubricDimensionCount: 0,
      schoolCorrectionCount: 0,
      profileAdjustmentCount: 0,
      profileOverrideCount: 0,
    };
  }
  return {
    rubricDimensionCount: Object.keys(feedback.rubricScores ?? {}).length,
    schoolCorrectionCount: feedback.schoolCorrections?.length ?? 0,
    profileAdjustmentCount: feedback.profileAdjustments?.length ?? 0,
    profileOverrideCount: Object.keys(feedback.profileScoreOverrides ?? {}).length,
  };
}

/** Recompute composite after profile override blend. */
export function compositeFromScores(scores) {
  return profileCompositeScore(scores);
}
