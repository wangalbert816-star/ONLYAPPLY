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
  variant?: "full" | "compact";
  id?: string;
};

export function ExpertConsultSection({
  gapCount,
  applicationId = null,
  reportId = null,
  variant = "full",
  id,
}: Props) {
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

  const ctaLabel = showCalendlyHint ? t("report.expertConsult.ctaCalendly") : t("report.expertConsult.cta");

  const dialog = (
    <ExpertConsultLeadDialog
      open={open}
      onClose={() => setOpen(false)}
      applicationId={applicationId}
      reportId={reportId}
    />
  );

  if (variant === "compact") {
    return (
      <section
        className="expert-consult expert-consult--compact"
        aria-labelledby="expert-consult-compact-heading"
        data-no-pdf
      >
        <div className="expert-consult__compact-inner">
          <div className="expert-consult__compact-copy">
            <p className="expert-consult__kicker">{t("report.expertConsult.sectionLabel")}</p>
            <h2 className="expert-consult__compact-title" id="expert-consult-compact-heading">
              {t("report.expertConsult.compactTitle")}
            </h2>
            <p className="expert-consult__compact-lead">{t("report.expertConsult.compactLead")}</p>
          </div>
          <button type="button" className="expert-consult__cta expert-consult__cta--compact" onClick={openConsult}>
            {ctaLabel}
          </button>
        </div>
        {showCalendlyHint && <p className="expert-consult__calendly-hint">{t("report.expertConsult.calendlyHint")}</p>}
        {dialog}
      </section>
    );
  }

  const riskText =
    gapCount > 0
      ? t("report.expertConsult.riskWithGaps", { n: gapCount })
      : t("report.expertConsult.riskNoGaps");

  const benefits = [
    t("report.expertConsult.benefit1"),
    t("report.expertConsult.benefit2"),
    t("report.expertConsult.benefit3"),
  ];

  return (
    <section
      className="expert-consult expert-consult--full"
      id={id}
      aria-labelledby="expert-consult-heading"
      data-no-pdf
    >
      <p className="expert-consult__kicker">{t("report.expertConsult.sectionLabel")}</p>
      <h2 className="expert-consult__headline" id="expert-consult-heading">
        {t("report.expertConsult.headlineTitle")}
      </h2>
      <p className="expert-consult__risk">{riskText}</p>
      <ul className="expert-consult__benefits">
        {benefits.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="expert-consult__guide">{t("report.expertConsult.guide")}</p>
      <button type="button" className="expert-consult__cta" onClick={openConsult}>
        {ctaLabel}
      </button>
      {showCalendlyHint && <p className="expert-consult__calendly-hint">{t("report.expertConsult.calendlyHint")}</p>}
      {dialog}
    </section>
  );
}
