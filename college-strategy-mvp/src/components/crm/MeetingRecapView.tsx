import { useLanguage } from "../../i18n/LanguageContext";
import {
  actionItemsToLines,
  parseMeetingRecapBody,
} from "../../lib/crm/meetingRecapFormat";
import "./MeetingRecapView.css";

type Props = {
  body: string;
  studentDisplayName?: string;
  onOpenActionItems?: () => void;
};

export function MeetingRecapView({ body, studentDisplayName, onOpenActionItems }: Props) {
  const { t } = useLanguage();
  const structured = parseMeetingRecapBody(body);
  const studentName = studentDisplayName?.trim() || t("crm.meetings.recapStudentFallback");

  if (!structured) {
    if (!body.trim()) return null;
    return <p className="meeting-recap-view__legacy">{body}</p>;
  }

  const actionLines = actionItemsToLines(structured.actionItems);
  const recordingUrl = structured.recordingUrl?.trim();

  return (
    <article className="meeting-recap-view">
      <p className="meeting-recap-view__intro">
        {t("crm.meetings.recapIntro", { student: studentName })}
      </p>

      {actionLines.length > 0 ? (
        <section className="meeting-recap-view__section">
          <h5 className="meeting-recap-view__section-title">{t("crm.meetings.recapSectionActionItems")}</h5>
          <ul className="meeting-recap-view__list">
            {actionLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {structured.resources.trim() ? (
        <section className="meeting-recap-view__section">
          <h5 className="meeting-recap-view__section-title">{t("crm.meetings.recapSectionResources")}</h5>
          <p className="meeting-recap-view__paragraph">{structured.resources}</p>
          {onOpenActionItems ? (
            <button type="button" className="meeting-recap-view__action-link" onClick={onOpenActionItems}>
              {t("crm.meetings.recapOpenActionItems")}
            </button>
          ) : null}
        </section>
      ) : null}

      {structured.summary.trim() ? (
        <section className="meeting-recap-view__section">
          <h5 className="meeting-recap-view__section-title">{t("crm.meetings.recapSectionSummary")}</h5>
          <p className="meeting-recap-view__paragraph">{structured.summary}</p>
        </section>
      ) : null}

      {recordingUrl ? (
        <section className="meeting-recap-view__section">
          <h5 className="meeting-recap-view__section-title">{t("crm.meetings.recapSectionRecording")}</h5>
          <p className="meeting-recap-view__paragraph">
            {t("crm.meetings.recapRecordingLead")}{" "}
            <a href={recordingUrl} target="_blank" rel="noopener noreferrer" className="meeting-recap-view__recording-link">
              {recordingUrl}
            </a>
          </p>
        </section>
      ) : null}
    </article>
  );
}
