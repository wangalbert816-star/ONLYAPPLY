import type { FormState } from "../types";

export function emptyFormState(): FormState {
  return {
    intakeTerm: "",
    intakeOtherDetail: "",
    applicantIdentity: "",
    citizenship: "",
    residenceRegion: "",
    budget: "",
    testing: "",
    satScore: "",
    actScore: "",
    highSchoolSystem: "",
    currentHighSchool: "",
    gpa: "",
    gpaTrend: "",
    languageScores: "",
    academicSpecialFlags: [],
    academicSpecialNotes: "",
    majorPrimary: "",
    majorSecondary: "",
    schoolSize: "",
    campusCulturePref: "",
    geoPrefs: [],
    activities: "",
    structuredActivities: [],
    riskStyle: "",
    dealbreakers: "",
  };
}
