import type { FormState, ReportPayload } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import type { Locale } from "../i18n/strings";
import type { ImprovementPlanLabels } from "../lib/intakeHorizon";
import { majorActivityHintBullets } from "../data/majorActivitySnippets";
import { ReportCollapsibleSection } from "./ReportCollapsibleSection";
import "./ReportImprovementPanel.css";

type Props = {
  report: ReportPayload;
  form: FormState;
  locale: Locale;
  unlocked: boolean;
  planLabels: ImprovementPlanLabels;
  improveLead: string | null;
  lockedWeekItems: number;
  t: Translate;
  embedded?: boolean;
};

type ActionKind = "urgent" | "ok";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ReportImprovementPanel({
  report,
  form,
  locale,
  unlocked,
  planLabels,
  improveLead,
  lockedWeekItems,
  t,
  embedded = false,
}: Props) {
  const tw = report.improvement_plan?.this_week || [];
  const tm = report.improvement_plan?.this_month || [];
  const bs = report.improvement_plan?.before_submitting || [];
  const activityBuild = report.improvement_plan?.activity_build || [];
  const priorityFrame = report.improvement_plan?.priority_frame?.trim() || "";
  const majorGuide = majorActivityHintBullets(form.majorPrimary, form.majorSecondary, locale);
  const showMajorGuide = unlocked && majorGuide.length > 0 && activityBuild.length < 2;

  if (embedded) {
    const lines: { text: string; kind: ActionKind }[] = [];
    if (tw[0]) lines.push({ text: tw[0], kind: "urgent" });
    if (tw[1]) lines.push({ text: tw[1], kind: "ok" });
    else if (activityBuild[0]) lines.push({ text: activityBuild[0], kind: "ok" });
    if (tw[2]) lines.push({ text: tw[2], kind: "ok" });
    else if (activityBuild[1]) lines.push({ text: activityBuild[1], kind: "ok" });
    else if (bs[0]) lines.push({ text: bs[0], kind: "ok" });

    const items = lines.slice(0, 3);
    if (items.length === 0) {
      return <p className="report-action-list__empty">{t("report.mockup.noActions")}</p>;
    }

    return (
      <ul className="report-action-list">
        {items.map((item, i) => (
          <li key={i} className="report-action-card">
            <span className={`report-action-card__icon report-action-card__icon--${item.kind}`} aria-hidden />
            <div className="report-action-card__body">
              <p className="report-action-card__text">{item.text}</p>
              <button type="button" className="report-action-card__link" onClick={() => scrollToId("report-step-action")}>
                {t("report.mockup.seeInSheet")}
              </button>
            </div>
          </li>
        ))}
        {!unlocked && (tw.length > lockedWeekItems || activityBuild.length > 0) ? (
          <li className="report-action-card report-action-card--locked">
            <span className="lock-icon" aria-hidden>
              🔒
            </span>
            {t("report.improvePreview")}
          </li>
        ) : null}
      </ul>
    );
  }

  return (
    <ReportCollapsibleSection
      id="report-appendix-improve"
      title={
        <>
          {t("report.improveTitle")}
          {!unlocked && <span className="inline-hint">{t("report.improvePreview")}</span>}
        </>
      }
      defaultOpen={false}
      className="report-block report-improve-panel"
    >
      {improveLead ? <p className="report-improve-lead">{improveLead}</p> : null}
      {showMajorGuide ? (
        <div className="report-major-guide">
          <p className="report-major-guide__title">{t("report.majorActivityGuideTitle")}</p>
          <ul className="report-major-guide__list">
            {majorGuide.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p className="report-major-guide__note">{t("report.majorActivityGuideNote")}</p>
        </div>
      ) : null}
      {priorityFrame && unlocked ? <p className="report-improve-priority">{priorityFrame}</p> : null}

      {activityBuild.length > 0 && (
        <>
          <h3 className="subh report-improve-panel__activity-title">{t("report.improveActivityBuildTitle")}</h3>
          {unlocked ? (
            <ul className="report-improve-activity-list">
              {activityBuild.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="block-locked">
              <span className="lock-icon" aria-hidden>
                🔒
              </span>
              {t("report.improveActivityBuildLock", { n: activityBuild.length })}
            </p>
          )}
        </>
      )}

      <h3 className="subh">{planLabels.week}</h3>
      <ul>
        {tw.slice(0, lockedWeekItems).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {!unlocked && tw.length > 1 && <p className="lock-inline">{t("report.weekMore", { n: tw.length - 1 })}</p>}

      <h3 className="subh">{planLabels.month}</h3>
      {unlocked ? (
        <ul>
          {tm.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="block-locked">
          <span className="lock-icon" aria-hidden>
            🔒
          </span>
          {t("report.monthLock", { n: tm.length })}
          <strong>{t("report.monthLockBold")}</strong>
        </p>
      )}

      <h3 className="subh">{planLabels.before}</h3>
      {unlocked ? (
        <ul>
          {bs.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="block-locked">
          <span className="lock-icon" aria-hidden>
            🔒
          </span>
          {t("report.beforeLock", { n: bs.length })}
          <strong>{t("report.beforeLockBold")}</strong>
        </p>
      )}
    </ReportCollapsibleSection>
  );
}
