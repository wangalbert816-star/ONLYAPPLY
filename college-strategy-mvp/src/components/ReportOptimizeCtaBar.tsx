import type { Translate } from "../i18n/LanguageContext";

export function ReportOptimizeCtaBar({ t }: { t: Translate }) {
  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="report-optimize-cta" role="group" aria-label={t("report.decision.ctaGroupAria")}>
      <button type="button" className="btn btn-primary report-optimize-cta__primary" onClick={() => scrollToId("report-section-gaps")}>
        {t("report.decision.ctaPrimary")}
      </button>
      <button type="button" className="btn btn-secondary report-optimize-cta__secondary" onClick={() => scrollToId("profile-five-commit-anchor")}>
        {t("report.decision.ctaSecondary")}
      </button>
    </div>
  );
}
