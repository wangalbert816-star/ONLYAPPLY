import type { FormState, ReportPayload, UcAnalysis } from "../types";
import type { Locale } from "../i18n/strings";
import type { Translate } from "../i18n/LanguageContext";
import { buildReportCsv, downloadCsv } from "../lib/exportReportCsv";

type Props = {
  report: ReportPayload;
  form: FormState;
  locale: Locale;
  t: Translate;
  uc: UcAnalysis | null;
  unlocked: boolean;
  intakeLabel: string;
};

export function ExportReportCsvButton({ report, form, locale, t, uc, unlocked, intakeLabel }: Props) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={() => {
        const csv = buildReportCsv(report, form, locale, uc, unlocked);
        const safe = intakeLabel.replace(/[^\w\u4e00-\u9fff-]+/g, "-").slice(0, 40) || "report";
        downloadCsv(`onlyapply-school-list-${safe}.csv`, csv);
      }}
      title={unlocked ? t("report.exportCsvHintFull") : t("report.exportCsvHintPreview")}
    >
      {t("report.exportCsv")}
    </button>
  );
}
