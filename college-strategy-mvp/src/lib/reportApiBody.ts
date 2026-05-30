import type { FormState, SupplementaryNote } from "../types";
import type { Locale } from "../i18n/strings";
import { getEffectiveIntake } from "./intakeTerm";

/** POST /api/report 与问卷字段一致；可选附带信息缺口补全说明；locale 驱动模型输出语言 */
export function buildReportApiBody(
  form: FormState,
  supplementaryNotes?: SupplementaryNote[],
  locale: Locale = "zh",
) {
  const base = {
    intakeTerm: getEffectiveIntake(form),
    applicantIdentity: form.applicantIdentity,
    citizenship: form.citizenship,
    residenceRegion: form.residenceRegion,
    budget: form.budget,
    testing: form.testing,
    satScore: form.satScore,
    actScore: form.actScore,
    highSchoolSystem: form.highSchoolSystem,
    currentHighSchool: form.currentHighSchool,
    gpa: form.gpa,
    gpaTrend: form.gpaTrend,
    languageScores: form.languageScores,
    academicSpecialFlags: form.academicSpecialFlags ?? [],
    academicSpecialNotes: form.academicSpecialNotes,
    majorPrimary: form.majorPrimary,
    majorSecondary: form.majorSecondary,
    schoolSize: form.schoolSize,
    campusCulturePref: form.campusCulturePref,
    geoPrefs: form.geoPrefs,
    structuredActivities: form.structuredActivities ?? [],
    riskStyle: form.riskStyle,
    dealbreakers: form.dealbreakers,
    locale,
  };
  if (supplementaryNotes && supplementaryNotes.length > 0) {
    return { ...base, supplementary_notes: supplementaryNotes };
  }
  return base;
}
