import type { FormState, ReportPayload } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { downloadReportCsv } from "../lib/exportReportCsv";

type Props = {
  report: ReportPayload;
  form: FormState;
  unlocked: boolean;
};

export function ReportExportCsvButton({ report, form, unlocked }: Props) {
  const { t, locale } = useLanguage();

  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => downloadReportCsv(report, form, locale, unlocked)}
      title={unlocked ? undefined : t("report.exportCsvPreviewHint")}
    >
      {t("report.exportCsv")}
    </button>
  );
}
