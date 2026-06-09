/** Re-exports — full intake parsing lives in engineIntakeProfile.mjs */
export {
  buildEngineIntakeProfile,
  benchmarkProfilePrefDiff,
  benchmarkReferenceWeight,
  benchmarkSimilarityScore,
  intakeProfileSummaryForPrompt,
  isUcSchoolName,
  normalizeGeoPref,
  parseEnginePreferences,
  parseGeoPrefs,
  preferencesSummaryForPrompt,
  profileSignatureFromBody,
  schoolRegionMatchesPrefs,
  wantsUcFromBody,
} from "./engineIntakeProfile.mjs";
