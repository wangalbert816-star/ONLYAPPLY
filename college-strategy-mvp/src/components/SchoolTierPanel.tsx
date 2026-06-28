import type { FormState, SchoolRow, SchoolTier } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { REPORT_CONTENT_LOCALE } from "../lib/reportContentLocale";
import { ReportCollapsibleSection } from "./ReportCollapsibleSection";
import { SchoolStrategyCard } from "./SchoolStrategyCard";
import "./SchoolTierPanel.css";

type Props = {
  tier: SchoolTier;
  rows: SchoolRow[];
  unlocked: boolean;
  highlightSchoolKeys: Set<string>;
  lockedSchoolRows: number;
  tierTitle: string;
  guide?: string;
  defaultOpen?: boolean;
  form: FormState;
  t: Translate;
};

export function SchoolTierPanel({
  tier,
  rows,
  unlocked,
  highlightSchoolKeys,
  lockedSchoolRows,
  tierTitle: _tierTitle,
  guide,
  defaultOpen = false,
  form,
  t,
}: Props) {
  const locale = REPORT_CONTENT_LOCALE;
  if (!rows.length) return null;

  const lockedCount = unlocked ? 0 : Math.max(0, rows.length - lockedSchoolRows);
  const tierUpper = tier.toUpperCase();

  return (
    <ReportCollapsibleSection
      id={`report-tier-${tier}`}
      title={
        <>
          {tierUpper} ({t("report.tierSchoolCount", { n: rows.length })})
          {!unlocked && lockedCount > 0 && (
            <span className="inline-hint"> {t("report.tierMore", { n: lockedCount })}</span>
          )}
        </>
      }
      lead={guide}
      defaultOpen={defaultOpen}
      className={`school-tier-panel school-tier-panel--${tier}`}
    >
      <div className="school-cards-grid">
        {rows.map((row, i) => (
          <SchoolStrategyCard
            key={`${row.school}-${i}`}
            row={row}
            tier={tier}
            locale={locale}
            form={form}
            unlocked={unlocked}
            highlighted={highlightSchoolKeys.has(String(row.school ?? "").trim().toLowerCase())}
            blurred={!unlocked && i >= lockedSchoolRows}
          />
        ))}
      </div>
    </ReportCollapsibleSection>
  );
}
