import type { UcAnalysis } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { ReportCollapsibleSection } from "./ReportCollapsibleSection";
import { SchoolTierCards } from "./SchoolTierCards";
import "./UcStrategySection.css";

type Props = {
  uc: UcAnalysis;
  t: Translate;
  unlocked: boolean;
};

export function UcStrategySection({ uc, t, unlocked }: Props) {
  return (
    <section className="card report-block uc-strategy" aria-labelledby="uc-strategy-title">
      <p className="uc-strategy__eyebrow">{t("report.uc.eyebrow")}</p>
      <h2 id="uc-strategy-title">{t("report.uc.title")}</h2>
      <p className="uc-strategy__lead">{uc.overview}</p>

      <div className="uc-strategy-callout uc-strategy-callout--test-blind" role="note">
        <strong>{t("report.uc.testBlindLabel")}</strong>
        <p>{uc.test_blind_note}</p>
      </div>

      <p className="uc-strategy__app-note">{uc.application_note}</p>

      <ReportCollapsibleSection title={t("report.uc.tierReach")} defaultOpen>
        <SchoolTierCards tier="reach" rows={uc.reach} t={t} unlocked={unlocked} hideHeading />
      </ReportCollapsibleSection>
      <ReportCollapsibleSection title={t("report.uc.tierMatch")} defaultOpen={false}>
        <SchoolTierCards tier="match" rows={uc.match} t={t} unlocked={unlocked} hideHeading />
      </ReportCollapsibleSection>
      <ReportCollapsibleSection title={t("report.uc.tierSafety")} defaultOpen={false}>
        <SchoolTierCards tier="safety" rows={uc.safety} t={t} unlocked={unlocked} hideHeading />
      </ReportCollapsibleSection>

      {unlocked ? (
        <>
          <ReportCollapsibleSection title={t("report.uc.checklistTitle")} defaultOpen={false}>
            <ul>
              {uc.checklist.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </ReportCollapsibleSection>
          <ReportCollapsibleSection title={t("report.uc.piqTitle")} defaultOpen={false}>
            <ul>
              {uc.piq_directions.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </ReportCollapsibleSection>
          {uc.information_gaps.length > 0 && (
            <ReportCollapsibleSection title={t("report.uc.gapsTitle")} defaultOpen={false}>
              <ul>
                {uc.information_gaps.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </ReportCollapsibleSection>
          )}
        </>
      ) : (
        <p className="uc-strategy-lock uc-strategy-lock--block">
          <span className="lock-icon" aria-hidden>
            🔒
          </span>
          {t("report.uc.previewLocked")}
        </p>
      )}
    </section>
  );
}
