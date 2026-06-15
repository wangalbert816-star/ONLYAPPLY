/** Server-side mirror of client buildReportApiBody for alumni / admin sync. */

const REPORT_CONTENT_LOCALE = "en";

function getEffectiveIntake(form) {
  return String(form?.intakeTerm ?? form?.intake_term ?? "").trim() || null;
}

export function reportBodyFromFormSnapshot(form, _locale = REPORT_CONTENT_LOCALE) {
  if (!form || typeof form !== "object") return { locale: REPORT_CONTENT_LOCALE };
  return {
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
}
