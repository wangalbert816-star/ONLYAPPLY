import type { SchoolRow, SchoolTier } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { useLanguage } from "../i18n/LanguageContext";
import { getSampleForm, getSampleReport } from "../data/sampleReport";
import type { Locale } from "../i18n/strings";
import { SchoolStrategyCard } from "./SchoolStrategyCard";
import { UcStrategySection } from "./UcStrategySection";
import "./SampleReportShowcase.css";

type Props = {
  locale: Locale;
  t: Translate;
};

function TierBlock({
  tier,
  rows,
  form,
  t,
}: {
  tier: SchoolTier;
  rows: SchoolRow[];
  form: ReturnType<typeof getSampleForm>;
  t: Translate;
}) {
  const { locale } = useLanguage();
  if (!rows.length) return null;
  const title =
    tier === "reach" ? t("report.tierReach") : tier === "match" ? t("report.tierMatch") : t("report.tierSafety");

  return (
    <section className={`sample-tier sample-tier--${tier}`} aria-label={title}>
      <div className="sample-tier__header">
        <span className="sample-tier__pill">{title}</span>
      </div>
      <div className="sample-tier__list sample-tier__cards">
        {rows.map((row, i) => (
          <SchoolStrategyCard
            key={`${row.school}-${i}`}
            row={row}
            tier={tier}
            locale={locale}
            form={form}
            unlocked
          />
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
  const form = getSampleForm(locale);
  const uc = report.uc_analysis;
  const plan = report.improvement_plan;

  return (
    <div className="sample-report-showcase">
      <p className="sample-report-showcase__badge">{t("productIntro.sample.badge")}</p>
      <p className="sample-report-showcase__note">{t("productIntro.sample.note")}</p>

      <section className="sample-panel sample-panel--summary">
        <h3 className="sample-panel__title">{t("report.summaryTitle")}</h3>
        <SummaryBlock lines={report.executive_summary || []} />
      </section>

      <div className="sample-tiers-stack">
        <TierBlock tier="reach" rows={report.reach || []} form={form} t={t} />
        <TierBlock tier="match" rows={report.match || []} form={form} t={t} />
        <TierBlock tier="safety" rows={report.safety || []} form={form} t={t} />
      </div>

      {uc && (
        <section className="sample-panel sample-panel--uc sample-panel--uc-full">
          <UcStrategySection uc={uc} form={form} t={t} unlocked />
        </section>
      )}

      {(report.portfolio_risks?.length ?? 0) > 0 && (
        <section className="sample-panel">
          <h3 className="sample-panel__title">{t("report.risksTitle")}</h3>
          <ul className="sample-summary-list">
            {report.portfolio_risks!.map((r, i) => (
              <li key={i}>
                <strong>{r.risk_title}</strong> — {r.what_it_means_for_you}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sample-panel">
        <h3 className="sample-panel__title">{t("report.gapsTitle")}</h3>
        <SummaryBlock lines={report.information_gaps || []} />
      </section>

      <section className="sample-panel">
        <h3 className="sample-panel__title">{t("report.improveTitle")}</h3>
        {plan?.priority_frame ? <p className="sample-panel__priority">{plan.priority_frame}</p> : null}
        {(plan?.activity_build?.length ?? 0) > 0 && (
          <>
            <p className="sample-panel__subhead">{t("report.improveActivityBuildTitle")}</p>
            <SummaryBlock lines={plan!.activity_build!} />
          </>
        )}
        <p className="sample-panel__subhead">{t("report.week")}</p>
        <SummaryBlock lines={plan?.this_week || []} />
        {(plan?.this_month?.length ?? 0) > 0 && (
          <>
            <p className="sample-panel__subhead">{t("report.month")}</p>
            <SummaryBlock lines={plan!.this_month!} />
          </>
        )}
      </section>
    </div>
  );
}
