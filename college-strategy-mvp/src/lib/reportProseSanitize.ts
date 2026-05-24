import type { ReportPayload } from "../types";
import { sanitizeReportTierDifferentiation } from "./tierDifferentiationSanitize";
import type { Locale } from "../i18n/strings";
import { sanitizeUnsourcedStats } from "./admitRateSanitize";
import { sanitizeUndergradSchoolMentions } from "./undergradCopySanitize";

function cleanLine(text: string, locale: Locale): string {
  return sanitizeUndergradSchoolMentions(sanitizeUnsourcedStats(text, locale), "", locale);
}

/** 报告非校名单字段：清洗 Anderson/Haas 误表述与无来源统计（旧报告展示用） */
export function sanitizeReportProse(report: ReportPayload, locale: Locale): ReportPayload {
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

  return sanitizeReportTierDifferentiation(
    {
      ...report,
      executive_summary,
      information_gaps,
      strategy_notes,
      portfolio_risks,
      improvement_plan,
    },
    locale,
  );
}
