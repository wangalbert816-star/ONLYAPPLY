import { useMemo, useState } from "react";
import type { FormState, ReportPayload, SchoolRow } from "../../types";
import type { Locale } from "../../i18n/strings";
import { useLanguage } from "../../i18n/LanguageContext";
import { getEffectiveIntake } from "../../lib/intakeTerm";
import { REPORT_CONTENT_LOCALE } from "../../lib/reportContentLocale";
import { sanitizeReportProse } from "../../lib/reportProseSanitize";
import { buildFiveDimensionProfile } from "../../lib/fiveDimensionProfile";
import { resolveMainListRows } from "../../lib/topReferenceSchools";
import { ApplicationProfileRadar } from "../ApplicationProfileRadar";
import { SchoolTierPanel } from "../SchoolTierPanel";
import { AlumniReportReviewPanel } from "./AlumniReportReviewPanel";
import "../../ReportView.css";
import "../../ReportViewTheme.css";
import "./AlumniFeedbackView.css";

type Props = {
  report: ReportPayload;
  form: FormState;
  locale: Locale;
  applicationId: string | null;
  reportId: string | null;
  isAuthenticated: boolean;
  onRequestSignIn: () => void;
  onReset: () => void;
};

export function AlumniFeedbackView({
  report,
  form,
  locale,
  applicationId,
  reportId,
  isAuthenticated,
  onRequestSignIn,
  onReset,
}: Props) {
  const { t } = useLanguage();
  const reportLocale = REPORT_CONTENT_LOCALE;
  const safeReport = useMemo(() => sanitizeReportProse(report, reportLocale), [report, reportLocale]);
  const intakeLabel = useMemo(() => getEffectiveIntake(form) || t("alumni.flow.reportIntakeFallback"), [form, t]);
  const profileFive = useMemo(() => buildFiveDimensionProfile(form, reportLocale), [form, reportLocale]);
  const mainListRows = useMemo(() => resolveMainListRows(safeReport), [safeReport]);
  const [reportRefOpen, setReportRefOpen] = useState(true);

  const tierLabel = (tier: "reach" | "match" | "safety") =>
    tier === "reach" ? t("report.tierReach") : tier === "match" ? t("report.tierMatch") : t("report.tierSafety");

  return (
    <div className="app alumni-feedback-view">
      <header className="alumni-feedback-view__hero">
        <div className="alumni-feedback-view__hero-copy">
          <p className="alumni-feedback-view__eyebrow">{t("alumni.flow.eyebrow")}</p>
          <h1>{t("alumni.flow.reportTitle", { intake: intakeLabel })}</h1>
          <p className="alumni-feedback-view__lead">{t("alumni.flow.reportLead")}</p>
        </div>
        <button type="button" className="btn btn-secondary alumni-feedback-view__back" onClick={onReset}>
          {t("alumni.flow.startOver")}
        </button>
      </header>

      <section className="alumni-feedback-view__review" aria-labelledby="alumni-review-primary">
        <h2 id="alumni-review-primary" className="visually-hidden">
          {t("alumni.review.title")}
        </h2>
        <AlumniReportReviewPanel
          report={report}
          form={form}
          locale={locale}
          applicationId={applicationId}
          reportId={reportId}
          isAuthenticated={isAuthenticated}
          onRequestSignIn={onRequestSignIn}
        />
      </section>

      <section className="alumni-feedback-view__reference" aria-labelledby="alumni-report-ref-title">
        <button
          type="button"
          className="alumni-feedback-view__reference-toggle"
          aria-expanded={reportRefOpen}
          onClick={() => setReportRefOpen((open) => !open)}
        >
          <span className="alumni-feedback-view__reference-toggle-main">
            <span
              className="alumni-feedback-view__reference-chevron"
              aria-hidden
              data-open={reportRefOpen}
            />
            <span id="alumni-report-ref-title">{t("alumni.flow.reportReferenceTitle")}</span>
          </span>
          <span className="alumni-feedback-view__reference-hint">{t("alumni.flow.reportReferenceHint")}</span>
        </button>
        {reportRefOpen ? (
          <div className="alumni-feedback-view__reference-body">
            {safeReport.executive_summary?.[0] ? (
              <p className="alumni-feedback-view__summary">{safeReport.executive_summary[0]}</p>
            ) : null}
            <div className="alumni-feedback-view__profile-card">
              <h3>{t("report.nav.fiveDimension")}</h3>
              <div className="report-view alumni-feedback-view__profile-chart">
                <ApplicationProfileRadar items={profileFive} t={t} previewLocked={false} mockupLayout />
              </div>
            </div>
            <div className="alumni-feedback-view__schools">
              <h3>{t("report.nav.schoolList")}</h3>
              {(["reach", "match", "safety"] as const).map((tier) => (
                <SchoolTierPanel
                  key={tier}
                  tier={tier}
                  rows={(mainListRows[tier] as SchoolRow[]) ?? []}
                  unlocked
                  highlightSchoolKeys={new Set()}
                  lockedSchoolRows={999}
                  tierTitle={tierLabel(tier)}
                  defaultOpen={tier === "reach"}
                  form={form}
                  t={t}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
