import type { ReportPayload, TopReferenceSchoolRow } from "../types";
import { isUltraSelectiveSchool } from "./ultraSelectiveSchools";

/** 优先使用结构化 top_reference_schools；旧报告从主名单拆顶校 */
export function resolveTopReferenceSchools(report: ReportPayload): TopReferenceSchoolRow[] {
  const structured = (report.top_reference_schools ?? []).filter((r) => r?.school?.trim());
  if (structured.length > 0) return structured.slice(0, 2);

  const legacy: TopReferenceSchoolRow[] = [];
  const seen = new Set<string>();
  for (const tier of ["reach", "match", "safety"] as const) {
    for (const row of report[tier] ?? []) {
      if (!isUltraSelectiveSchool(row.school)) continue;
      const key = row.school.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      legacy.push({
        school: row.school,
        why_reference_for_you:
          row.why_reach_for_you || row.why_match_for_you || row.why_safety_for_you || "",
        key_fit_signals: row.key_fit_signals,
        key_risks: row.key_risks,
        verification_focus: row.verification_focus,
        campus_vibe: row.campus_vibe,
        context_note: row.context_note,
      });
    }
  }
  return legacy;
}

/** 主名单展示行：新报告直接用三档；旧报告去掉误入的顶校 */
export function resolveMainListRows(report: ReportPayload) {
  const hasStructuredTop = (report.top_reference_schools?.length ?? 0) > 0;
  const filterUltra = (rows: ReportPayload["reach"]) =>
    hasStructuredTop ? [...(rows ?? [])] : (rows ?? []).filter((r) => !isUltraSelectiveSchool(r.school));

  return {
    reach: filterUltra(report.reach),
    match: filterUltra(report.match),
    safety: filterUltra(report.safety),
  };
}
