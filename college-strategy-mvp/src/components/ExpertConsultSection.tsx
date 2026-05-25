import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { isCalendlyBookingEnabled, requestExpertConsult } from "../lib/expertConsultBooking";
import { ExpertConsultLeadDialog } from "./ExpertConsultLeadDialog";
import "./ExpertConsultSection.css";

type Props = {
  gapCount: number;
  applicationId?: string | null;
  reportId?: string | null;
};

export function ExpertConsultSection({ gapCount, applicationId = null, reportId = null }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const showCalendlyHint = isCalendlyBookingEnabled();

  const openConsult = () => {
    requestExpertConsult({
      email: user?.email ?? undefined,
      source: "report_advisor_support",
      onFallback: () => setOpen(true),
    });
  };

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
      <button type="button" className="expert-consult__cta" onClick={openConsult}>
        {showCalendlyHint ? t("report.expertConsult.ctaCalendly") : t("report.expertConsult.cta")}
      </button>
      {showCalendlyHint && <p className="expert-consult__calendly-hint">{t("report.expertConsult.calendlyHint")}</p>}
      <ExpertConsultLeadDialog
        open={open}
        onClose={() => setOpen(false)}
        applicationId={applicationId}
        reportId={reportId}
      />
    </section>
  );
}
