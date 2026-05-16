import { useCallback, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { buildReportPdfFilename, downloadReportPdf } from "../lib/downloadReportPdf";

type Props = {
  sourceRef: React.RefObject<HTMLElement | null>;
  intakeLabel: string;
  unlocked: boolean;
};

export function ReportDownloadButton({ sourceRef, intakeLabel, unlocked }: Props) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    const el = sourceRef.current;
    if (!el) {
      setErr(t("report.downloadPdfErr"));
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await downloadReportPdf(el, buildReportPdfFilename(intakeLabel));
    } catch {
      setErr(t("report.downloadPdfErr"));
    } finally {
      setBusy(false);
    }
  }, [sourceRef, intakeLabel, t]);

  return (
    <div className="report-download">
      <button
        type="button"
        className="btn btn-secondary btn-sm report-download__btn"
        onClick={() => void handleDownload()}
        disabled={busy}
        title={!unlocked ? t("report.downloadPdfPreviewHint") : undefined}
      >
        {busy ? t("report.downloadPdfBusy") : t("report.downloadPdf")}
      </button>
      {err && (
        <p className="report-download__err" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
