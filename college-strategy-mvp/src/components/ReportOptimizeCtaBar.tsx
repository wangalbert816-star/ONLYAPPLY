import type { Translate } from "../i18n/LanguageContext";

export function ReportOptimizeCtaBar({ t }: { t: Translate }) {
  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="report-optimize-cta" role="group" aria-label={t("report.decision.ctaGroupAria")} data-no-pdf>
      <button type="button" className="btn report-optimize-cta__primary" onClick={() => scrollToId("report-section-gaps")}>
        {t("report.decision.ctaPrimary")}
      </button>
      <button type="button" className="btn report-optimize-cta__advisor" onClick={() => scrollToId("report-advisor-support")}>
        {t("report.expertConsult.ctaNav")}
      </button>
      <button
        type="button"
        className="btn report-optimize-cta__secondary"
        onClick={() => scrollToId("profile-five-commit-anchor")}
      >
        {t("report.decision.ctaSecondary")}
      </button>
    </div>
  );
}
