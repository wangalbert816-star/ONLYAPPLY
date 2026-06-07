import type { FormState, ReportPayload } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { downloadReportCsv } from "../lib/exportReportCsv";
import { REPORT_CONTENT_LOCALE } from "../lib/reportContentLocale";

type Props = {
  report: ReportPayload;
  form: FormState;
  unlocked: boolean;
};

export function ReportExportCsvButton({ report, form, unlocked }: Props) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => downloadReportCsv(report, form, REPORT_CONTENT_LOCALE, unlocked)}
      title={unlocked ? undefined : t("report.exportCsvPreviewHint")}
    >
      {t("report.exportCsv")}
    </button>
  );
}
