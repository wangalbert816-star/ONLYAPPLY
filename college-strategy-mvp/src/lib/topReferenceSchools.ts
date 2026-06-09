import type { ReportPayload, TopReferenceSchoolRow } from "../types";

/** Structured top_reference_schools only (ultra-selective may also appear in main reach). */
export function resolveTopReferenceSchools(report: ReportPayload): TopReferenceSchoolRow[] {
  return (report.top_reference_schools ?? []).filter((r) => r?.school?.trim()).slice(0, 2);
}

/** Main list shows all reach/match/safety rows as returned by the engine. */
export function resolveMainListRows(report: ReportPayload) {
  return {
    reach: [...(report.reach ?? [])],
    match: [...(report.match ?? [])],
    safety: [...(report.safety ?? [])],
  };
}
