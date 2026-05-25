import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { ExpertConsultLeadDialog } from "./ExpertConsultLeadDialog";
import "./ExpertConsultSection.css";

type Props = {
  gapCount: number;
  applicationId?: string | null;
  reportId?: string | null;
};

export function ExpertConsultSection({ gapCount, applicationId = null, reportId = null }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const riskText =
    gapCount > 0
      ? t("report.expertConsult.riskWithGaps", { n: gapCount })
      : t("report.expertConsult.riskNoGaps");

  return (
    <section className="card report-block expert-consult" aria-labelledby="expert-consult-heading" data-no-pdf>
      <h2 className="expert-consult__title" id="expert-consult-heading">
        {t("report.expertConsult.sectionLabel")}
      </h2>
      <p className="expert-consult__risk">{riskText}</p>
      <p className="expert-consult__guide">{t("report.expertConsult.guide")}</p>
      <button type="button" className="expert-consult__cta" onClick={() => setOpen(true)}>
        {t("report.expertConsult.cta")}
      </button>
      <ExpertConsultLeadDialog
        open={open}
        onClose={() => setOpen(false)}
        applicationId={applicationId}
        reportId={reportId}
      />
    </section>
  );
}
