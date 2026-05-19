/** 距目标 Fall 入学季申请窗口的时间远近，用于 improvement_plan 口径 */
export type IntakeHorizon = "urgent" | "mid" | "long" | "unknown";

const FALL_APP_SEASON_START_MONTH = 8; // September (year before enrollment)

/** 从「2027 Fall」或自定义说明中提取入学年份 */
export function parseIntakeEnrollmentYear(intake: string): number | null {
  const m = String(intake || "").match(/\b(20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 2020 && y <= 2040 ? y : null;
}

/** 距离主申请季（约入学年前一年的 9 月）还有多久 */
export function monthsUntilApplicationSeason(intake: string, now = new Date()): number | null {
  const enrollYear = parseIntakeEnrollmentYear(intake);
  if (!enrollYear) return null;
  const seasonStart = new Date(enrollYear - 1, FALL_APP_SEASON_START_MONTH, 1);
  return (
    (seasonStart.getFullYear() - now.getFullYear()) * 12 + (seasonStart.getMonth() - now.getMonth())
  );
}

export function getIntakeHorizon(intake: string, now = new Date()): IntakeHorizon {
  const months = monthsUntilApplicationSeason(intake, now);
  if (months === null) return "unknown";
  if (months <= 12) return "urgent";
  if (months <= 30) return "mid";
  return "long";
}

export type ImprovementPlanLabels = {
  week: string;
  month: string;
  before: string;
};

/** UI 三段标题（与 JSON 字段 this_week / this_month / before_submitting 对应） */
export function getImprovementPlanLabels(
  horizon: IntakeHorizon,
  locale: "zh" | "en",
): ImprovementPlanLabels {
  const zh: Record<IntakeHorizon, ImprovementPlanLabels> = {
    urgent: { week: "本周", month: "本月", before: "提交前" },
    mid: { week: "近 4–8 周", month: "本学期 / 本学年", before: "申请季前一年" },
    long: { week: "近期（3–6 个月）", month: "1–2 年内", before: "申请年重点" },
    unknown: { week: "近期", month: "中期准备", before: "申请提交前" },
  };
  const en: Record<IntakeHorizon, ImprovementPlanLabels> = {
    urgent: { week: "This week", month: "This month", before: "Before submitting" },
    mid: { week: "Next 4–8 weeks", month: "This term / school year", before: "Year before application season" },
    long: { week: "Near term (3–6 months)", month: "Within 1–2 years", before: "Application-year focus" },
    unknown: { week: "Near term", month: "Mid-term prep", before: "Before you apply" },
  };
  return (locale === "en" ? en : zh)[horizon];
}
