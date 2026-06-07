import type { FormState, SchoolRow, SchoolTier, UcAnalysis } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { REPORT_CONTENT_LOCALE } from "../lib/reportContentLocale";
import { ReportCollapsibleSection } from "./ReportCollapsibleSection";
import { SchoolStrategyCard } from "./SchoolStrategyCard";
import "./UcStrategySection.css";

type Props = {
  uc: UcAnalysis;
  form: FormState;
  t: Translate;
  unlocked: boolean;
};

function tierTitle(tier: SchoolTier, t: Translate): string {
  if (tier === "reach") return t("report.uc.tierReach");
  if (tier === "match") return t("report.uc.tierMatch");
  return t("report.uc.tierSafety");
}

function UcTierBlock({
  tier,
  rows,
  form,
  t,
  unlocked,
}: {
  tier: SchoolTier;
  rows: SchoolRow[];
  form: FormState;
  t: Translate;
  unlocked: boolean;
}) {
  const locale = REPORT_CONTENT_LOCALE;
  if (!rows.length) return null;
  const visible = unlocked ? rows : rows.slice(0, 1);
  const lockedCount = unlocked ? 0 : Math.max(0, rows.length - 1);

  return (
    <ReportCollapsibleSection
      id={`uc-tier-${tier}`}
      title={
        <>
          {tierTitle(tier, t)}
          {!unlocked && lockedCount > 0 && (
            <span className="inline-hint"> {t("report.uc.tierMore", { n: lockedCount })}</span>
          )}
        </>
      }
      defaultOpen={false}
    >
      <div className="school-cards-grid">
        {visible.map((row, i) => (
          <SchoolStrategyCard key={`${row.school}-${i}`} row={row} tier={tier} locale={locale} form={form} unlocked={unlocked} />
        ))}
      </div>
    </ReportCollapsibleSection>
  );
}

export function UcStrategySection({ uc, form, t, unlocked }: Props) {
  return (
    <ReportCollapsibleSection
      id="report-uc-block"
      title={t("report.uc.title")}
      lead={uc.overview}
      defaultOpen={false}
      className="uc-strategy"
    >
      <p className="uc-strategy__eyebrow">{t("report.uc.eyebrow")}</p>

      <div className="uc-strategy-callout uc-strategy-callout--test-blind" role="note">
        <strong>{t("report.uc.testBlindLabel")}</strong>
        <p>{uc.test_blind_note}</p>
      </div>

      <p className="uc-strategy__app-note">{uc.application_note}</p>

      <UcTierBlock tier="reach" rows={uc.reach} form={form} t={t} unlocked={unlocked} />
      <UcTierBlock tier="match" rows={uc.match} form={form} t={t} unlocked={unlocked} />
      <UcTierBlock tier="safety" rows={uc.safety} form={form} t={t} unlocked={unlocked} />

      {unlocked ? (
        <>
          <ReportCollapsibleSection
            id="uc-checklist"
            title={t("report.uc.checklistTitle")}
            defaultOpen={false}
          >
            <ul>
              {uc.checklist.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </ReportCollapsibleSection>
          <ReportCollapsibleSection id="uc-piq" title={t("report.uc.piqTitle")} defaultOpen={false}>
            <ul>
              {uc.piq_directions.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </ReportCollapsibleSection>
          {uc.information_gaps.length > 0 && (
            <ReportCollapsibleSection id="uc-gaps" title={t("report.uc.gapsTitle")} defaultOpen={false}>
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
    </ReportCollapsibleSection>
  );
}
