import type { FormState, SupplementaryNote } from "../types";

/** POST /api/report 与问卷字段一致；可选附带信息缺口补全说明 */
export function buildReportApiBody(form: FormState, supplementaryNotes?: SupplementaryNote[]) {
  const base = {
    intakeTerm: form.intakeTerm,
    applicantIdentity: form.applicantIdentity,
    budget: form.budget,
    testing: form.testing,
    satScore: form.satScore,
    actScore: form.actScore,
    highSchoolSystem: form.highSchoolSystem,
    gpa: form.gpa,
    majorPrimary: form.majorPrimary,
    majorSecondary: form.majorSecondary,
    schoolSize: form.schoolSize,
    geoPrefs: form.geoPrefs,
    activities: form.activities,
    riskStyle: form.riskStyle,
    dealbreakers: form.dealbreakers,
  };
  if (supplementaryNotes && supplementaryNotes.length > 0) {
    return { ...base, supplementary_notes: supplementaryNotes };
  }
  return base;
}
