import type { SchoolRow, SchoolTier } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { getSampleReport } from "../data/sampleReport";
import type { Locale } from "../i18n/strings";
import "./SampleReportShowcase.css";

type Props = {
  locale: Locale;
  t: Translate;
};

function whyCell(row: SchoolRow, tier: SchoolTier): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function TierBlock({ tier, rows, t }: { tier: SchoolTier; rows: SchoolRow[]; t: Translate }) {
  if (!rows.length) return null;
  const title =
    tier === "reach" ? t("report.tierReach") : tier === "match" ? t("report.tierMatch") : t("report.tierSafety");

  return (
    <section className={`sample-tier sample-tier--${tier}`} aria-label={title}>
      <div className="sample-tier__header">
        <span className="sample-tier__pill">{title}</span>
      </div>
      <div className="sample-tier__list">
        {rows.map((row, i) => (
          <article key={`${row.school}-${i}`} className="sample-tier__card">
            <h4 className="sample-tier__school">{row.school}</h4>
            <div className="sample-tier__grid">
              <div className="sample-tier__cell sample-tier__cell--why">
                <span className="sample-tier__label">{t("report.thWhy")}</span>
                <p>{whyCell(row, tier)}</p>
              </div>
              <div className="sample-tier__cell sample-tier__cell--risks">
                <span className="sample-tier__label">{t("report.thRisks")}</span>
                <ul className="sample-tier__risk-list">
                  {(row.key_risks || []).map((risk, j) => (
                    <li key={j}>{risk}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryBlock({ lines }: { lines: string[] }) {
  return (
    <ul className="sample-summary-list">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

export function SampleReportShowcase({ locale, t }: Props) {
  const report = getSampleReport(locale);
  const uc = report.uc_analysis;

  return (
    <div className="sample-report-showcase">
      <p className="sample-report-showcase__badge">{t("productIntro.sample.badge")}</p>
      <p className="sample-report-showcase__note">{t("productIntro.sample.note")}</p>

      <section className="sample-panel sample-panel--summary">
        <h3 className="sample-panel__title">{t("report.summaryTitle")}</h3>
        <SummaryBlock lines={report.executive_summary || []} />
      </section>

      <div className="sample-tiers-stack">
        <TierBlock tier="reach" rows={report.reach || []} t={t} />
        <TierBlock tier="match" rows={report.match || []} t={t} />
        <TierBlock tier="safety" rows={report.safety || []} t={t} />
      </div>

      {uc && (
        <section className="sample-panel sample-panel--uc">
          <p className="sample-panel__eyebrow">{t("report.uc.eyebrow")}</p>
          <h3 className="sample-panel__title">{t("report.uc.title")}</h3>
          <p className="sample-panel__text">{uc.overview}</p>
          <div className="sample-panel__callout" role="note">
            <strong>{t("report.uc.testBlindLabel")}</strong>
            <p>{uc.test_blind_note}</p>
          </div>
        </section>
      )}

      <section className="sample-panel">
        <h3 className="sample-panel__title">{t("report.gapsTitle")}</h3>
        <SummaryBlock lines={report.information_gaps || []} />
      </section>

      <section className="sample-panel">
        <h3 className="sample-panel__title">{t("report.improveTitle")}</h3>
        <p className="sample-panel__subhead">{t("report.week")}</p>
        <SummaryBlock lines={report.improvement_plan?.this_week || []} />
      </section>
    </div>
  );
}
