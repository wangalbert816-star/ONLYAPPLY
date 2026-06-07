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
  tierTitle,
  guide,
  defaultOpen = false,
  form,
  t,
}: Props) {
  const locale = REPORT_CONTENT_LOCALE;
  if (!rows.length) return null;

  const visible = rows.slice(0, lockedSchoolRows);
  const lockedCount = unlocked ? 0 : Math.max(0, rows.length - 1);

  return (
    <ReportCollapsibleSection
      id={`report-tier-${tier}`}
      title={
        <>
          {tierTitle}
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
        {visible.map((row, i) => (
          <SchoolStrategyCard
            key={`${row.school}-${i}`}
            row={row}
            tier={tier}
            locale={locale}
            form={form}
            unlocked={unlocked}
            highlighted={highlightSchoolKeys.has(row.school.trim().toLowerCase())}
          />
        ))}
        {!unlocked &&
          rows.slice(1).map((_, i) => (
            <div key={`lock-${i}`} className="school-card school-card--locked-row">
              <span className="lock-icon" aria-hidden>
                🔒
              </span>
              {t("report.lockRow", { n: i + 2 })}
              <span className="lock-sub">{t("report.lockRowSub")}</span>
            </div>
          ))}
      </div>
    </ReportCollapsibleSection>
  );
}
