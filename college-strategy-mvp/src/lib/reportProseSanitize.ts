import type { ReportPayload, SchoolRow, TopReferenceSchoolRow, UcAnalysis } from "../types";
import { sanitizeReportTierDifferentiation } from "./tierDifferentiationSanitize";
import type { Locale } from "../i18n/strings";
import { sanitizeUnsourcedStats } from "./admitRateSanitize";
import { sanitizeUndergradSchoolMentions } from "./undergradCopySanitize";

function cleanLine(text: string, locale: Locale): string {
  let line = text;
  if (locale === "zh") line = line.replace(/[「」]/g, "");
  return sanitizeUndergradSchoolMentions(sanitizeUnsourcedStats(line, locale), "", locale);
}

function cleanSchoolRow(row: SchoolRow, locale: Locale): SchoolRow {
  return {
    ...row,
    school: cleanLine(row.school, locale),
    why_reach_for_you: row.why_reach_for_you ? cleanLine(row.why_reach_for_you, locale) : row.why_reach_for_you,
    why_match_for_you: row.why_match_for_you ? cleanLine(row.why_match_for_you, locale) : row.why_match_for_you,
    why_safety_for_you: row.why_safety_for_you ? cleanLine(row.why_safety_for_you, locale) : row.why_safety_for_you,
    campus_vibe: row.campus_vibe ? cleanLine(row.campus_vibe, locale) : row.campus_vibe,
    differentiation: row.differentiation ? cleanLine(row.differentiation, locale) : row.differentiation,
    context_note: row.context_note ? cleanLine(row.context_note, locale) : row.context_note,
    key_fit_signals: row.key_fit_signals.map((x) => cleanLine(x, locale)),
    key_risks: row.key_risks.map((x) => cleanLine(x, locale)),
    verification_focus: row.verification_focus.map((x) => cleanLine(x, locale)),
  };
}

function cleanTopReferenceRow(row: TopReferenceSchoolRow, locale: Locale): TopReferenceSchoolRow {
  return {
    ...row,
    school: cleanLine(row.school, locale),
    why_reference_for_you: row.why_reference_for_you ? cleanLine(row.why_reference_for_you, locale) : row.why_reference_for_you,
    campus_vibe: row.campus_vibe ? cleanLine(row.campus_vibe, locale) : row.campus_vibe,
    context_note: row.context_note ? cleanLine(row.context_note, locale) : row.context_note,
    key_fit_signals: row.key_fit_signals?.map((x) => cleanLine(x, locale)),
    key_risks: row.key_risks?.map((x) => cleanLine(x, locale)),
    verification_focus: row.verification_focus?.map((x) => cleanLine(x, locale)),
  };
}

function cleanSchoolRows(rows: SchoolRow[] | undefined, locale: Locale): SchoolRow[] {
  return (rows ?? []).map((row) => cleanSchoolRow(row, locale));
}

/** 报告非校名单字段：清洗 Anderson/Haas 误表述与无来源统计（旧报告展示用） */
export function sanitizeReportProse(report: ReportPayload, locale: Locale): ReportPayload {
  try {
    const executive_summary = (report.executive_summary ?? []).map((x) => cleanLine(x, locale));
    const information_gaps = (report.information_gaps ?? []).map((x) => cleanLine(x, locale));
    const strategy_notes = (report.strategy_notes ?? []).map((x) => cleanLine(x, locale));
    const portfolio_risks = (report.portfolio_risks ?? []).map((r) => ({
      ...r,
      risk_title: cleanLine(r.risk_title, locale),
      what_it_means_for_you: cleanLine(r.what_it_means_for_you, locale),
      mitigation: cleanLine(r.mitigation, locale),
    }));

    let improvement_plan = report.improvement_plan;
    if (improvement_plan) {
      const mapArr = (arr?: string[]) => (arr ?? []).map((x) => cleanLine(x, locale));
      improvement_plan = {
        ...improvement_plan,
        this_week: mapArr(improvement_plan.this_week),
        this_month: mapArr(improvement_plan.this_month),
        before_submitting: mapArr(improvement_plan.before_submitting),
        activity_build: mapArr(improvement_plan.activity_build),
        priority_frame: improvement_plan.priority_frame
          ? cleanLine(improvement_plan.priority_frame, locale)
          : improvement_plan.priority_frame,
      };
    }

    const reach = cleanSchoolRows(report.reach, locale);
    const match = cleanSchoolRows(report.match, locale);
    const safety = cleanSchoolRows(report.safety, locale);
    const top_reference_schools = (report.top_reference_schools ?? []).map((row) => cleanTopReferenceRow(row, locale));

    let uc_analysis: UcAnalysis | null | undefined = report.uc_analysis;
    if (uc_analysis) {
      uc_analysis = {
        ...uc_analysis,
        overview: cleanLine(uc_analysis.overview, locale),
        test_blind_note: cleanLine(uc_analysis.test_blind_note, locale),
        application_note: cleanLine(uc_analysis.application_note, locale),
        reach: cleanSchoolRows(uc_analysis.reach, locale),
        match: cleanSchoolRows(uc_analysis.match, locale),
        safety: cleanSchoolRows(uc_analysis.safety, locale),
        checklist: (uc_analysis.checklist ?? []).map((x) => cleanLine(x, locale)),
        piq_directions: (uc_analysis.piq_directions ?? []).map((x) => cleanLine(x, locale)),
        information_gaps: (uc_analysis.information_gaps ?? []).map((x) => cleanLine(x, locale)),
      };
    }

    return sanitizeReportTierDifferentiation(
      {
        ...report,
        executive_summary,
        information_gaps,
        strategy_notes,
        portfolio_risks,
        improvement_plan,
        reach,
        match,
        safety,
        top_reference_schools,
        uc_analysis,
      },
      locale,
    );
  } catch {
    return report;
  }
}
