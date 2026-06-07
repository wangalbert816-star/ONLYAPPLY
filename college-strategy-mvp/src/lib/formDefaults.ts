import type { FormState } from "../types";
import { emptyTranscriptSheet } from "./transcriptSheet";

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
    transcriptSheet: emptyTranscriptSheet(),
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
