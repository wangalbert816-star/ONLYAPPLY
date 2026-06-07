import type { FormState, SupplementaryNote } from "../types";
import type { Locale } from "../i18n/strings";
import { getEffectiveIntake } from "./intakeTerm";
import { REPORT_CONTENT_LOCALE } from "./reportContentLocale";

/** POST /api/report 与问卷字段一致；可选附带信息缺口补全说明；报告正文固定英文输出 */
export function buildReportApiBody(
  form: FormState,
  supplementaryNotes?: SupplementaryNote[],
  _locale: Locale = REPORT_CONTENT_LOCALE,
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
    transcriptSheet: form.transcriptSheet,
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
    locale: REPORT_CONTENT_LOCALE,
  };
  if (supplementaryNotes && supplementaryNotes.length > 0) {
    return { ...base, supplementary_notes: supplementaryNotes };
  }
  return base;
}
