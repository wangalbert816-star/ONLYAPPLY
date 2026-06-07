import type { FormState, TranscriptSheet } from "../types";
import { emptyTranscriptSheet } from "./transcriptSheet";

export const EMPTY_FORM_STATE: FormState = {
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

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeTranscriptSheet(raw: unknown): TranscriptSheet {
  const base = emptyTranscriptSheet();
  if (!raw || typeof raw !== "object") return base;
  const partial = raw as Partial<TranscriptSheet>;
  return {
    ...base,
    gradingScale: partial.gradingScale ?? "",
    scaleNotes: str(partial.scaleNotes),
    unweightedGpa: str(partial.unweightedGpa),
    weightedGpa: str(partial.weightedGpa),
    courses: Array.isArray(partial.courses) ? partial.courses : [],
    parseStatus: partial.parseStatus ?? "idle",
    parseError: str(partial.parseError),
    confirmedAt: str(partial.confirmedAt),
    fileName: str(partial.fileName),
    skipped: Boolean(partial.skipped),
  };
}

/** Coerce partial/legacy JSON from Supabase into a safe FormState. */
export function normalizeFormState(raw: unknown): FormState {
  const partial = raw && typeof raw === "object" ? (raw as Partial<FormState>) : {};
  return {
    intakeTerm: str(partial.intakeTerm),
    intakeOtherDetail: str(partial.intakeOtherDetail),
    applicantIdentity: partial.applicantIdentity ?? "",
    citizenship: str(partial.citizenship),
    residenceRegion: str(partial.residenceRegion),
    budget: partial.budget ?? "",
    testing: partial.testing ?? "",
    satScore: str(partial.satScore),
    actScore: str(partial.actScore),
    highSchoolSystem: str(partial.highSchoolSystem),
    currentHighSchool: str(partial.currentHighSchool),
    gpa: str(partial.gpa),
    transcriptSheet: normalizeTranscriptSheet(partial.transcriptSheet),
    gpaTrend: partial.gpaTrend ?? "",
    languageScores: str(partial.languageScores),
    academicSpecialFlags: Array.isArray(partial.academicSpecialFlags) ? partial.academicSpecialFlags : [],
    academicSpecialNotes: str(partial.academicSpecialNotes),
    majorPrimary: str(partial.majorPrimary),
    majorSecondary: str(partial.majorSecondary),
    schoolSize: partial.schoolSize ?? "",
    campusCulturePref: partial.campusCulturePref ?? "",
    geoPrefs: Array.isArray(partial.geoPrefs) ? partial.geoPrefs : [],
    activities: str(partial.activities),
    structuredActivities: Array.isArray(partial.structuredActivities) ? partial.structuredActivities : [],
    riskStyle: partial.riskStyle ?? "",
    dealbreakers: str(partial.dealbreakers),
  };
}

/** JSON for CRM bootstrap placeholder rows in Supabase SQL. */
export const PLACEHOLDER_FORM_STATE_JSON = JSON.stringify(EMPTY_FORM_STATE);
