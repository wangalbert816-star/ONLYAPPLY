import { useLanguage } from "../../i18n/LanguageContext";
import type { CrmMeetingRecapDraft } from "../../lib/crm/meetingRecapFormat";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import type { CrmCounselor, CrmEngagement, CrmMeetingRecap } from "../../lib/crm/types";
import { MeetingRecapsPanel } from "./MeetingRecapsPanel";
import "./MeetingsTabPanel.css";

type Props = {
  engagement: CrmEngagement;
  counselor: CrmCounselor;
  recaps: CrmMeetingRecap[];
  studentDisplayName?: string;
  canEditRecaps?: boolean;
  recapBusy?: boolean;
  onOpenActionItems?: () => void;
  onAddRecap?: (input: CrmMeetingRecapDraft) => Promise<void>;
  onDeleteRecap?: (recapId: string) => Promise<void>;
  /** Counselor console: edit next-meeting label */
  meetingLabelDraft?: string;
  onMeetingLabelDraftChange?: (value: string) => void;
  onSaveMeetingLabel?: () => void;
  showMeetingLabelEditor?: boolean;
  /** Counselor: save Google Meet link on own profile */
  showMeetingUrlEditor?: boolean;
  meetingUrlDraft?: string;
  onMeetingUrlDraftChange?: (value: string) => void;
  onSaveMeetingUrl?: () => void;
  meetingUrlSaveBusy?: boolean;
  /** Counselor: push link to this student */
  onShareMeetingLink?: () => void;
  canShareMeetingLink?: boolean;
  /** Student: open shared join link */
  onJoinMeeting?: () => void;
};

export function MeetingsTabPanel({
  engagement,
  counselor,
  recaps,
  studentDisplayName,
  canEditRecaps = false,
  recapBusy = false,
  onOpenActionItems,
  onAddRecap,
  onDeleteRecap,
  meetingLabelDraft,
  onMeetingLabelDraftChange,
  onSaveMeetingLabel,
  showMeetingLabelEditor = false,
  showMeetingUrlEditor = false,
  meetingUrlDraft,
  onMeetingUrlDraftChange,
  onSaveMeetingUrl,
  meetingUrlSaveBusy = false,
  onShareMeetingLink,
  canShareMeetingLink = false,
  onJoinMeeting,
}: Props) {
  const { t, locale } = useLanguage();
  const meetingLabel = engagement.nextMeetingLabel
    ? localizeCrmText(engagement.nextMeetingLabel, locale, t)
    : t("crm.signedService.noMeetingScheduled");
  const sharedUrl = engagement.meetingJoinUrl?.trim() || "";
  const isCounselorView = Boolean(onShareMeetingLink || showMeetingUrlEditor);

  return (
    <>
      <div className="meetings-tab__schedule signed-service-hub__meeting-card">
        <p className="meetings-tab__counselor">
          <strong>{localizeCrmText(counselor.name, locale, t)}</strong> ·{" "}
          {localizeCrmText(counselor.title, locale, t)}
        </p>
        <p className="meetings-tab__next">
          <span className="meetings-tab__next-label">{t("crm.signedService.nextMeeting")}</span>
          <span className="meetings-tab__next-value">{meetingLabel}</span>
        </p>

        {sharedUrl ? (
          <div className="meetings-tab__join">
            <p className="meetings-tab__join-label">{t("crm.meetings.sharedLinkLabel")}</p>
            <a
              className="meetings-tab__join-url"
              href={sharedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {sharedUrl}
            </a>
            {onJoinMeeting ? (
              <button type="button" className="btn btn-primary" onClick={onJoinMeeting}>
                {t("crm.meetings.joinMeeting")}
              </button>
            ) : null}
            {isCounselorView ? (
              <p className="meetings-tab__join-hint">{t("crm.console.meetingLinkSharedHint")}</p>
            ) : null}
          </div>
        ) : !isCounselorView ? (
          <p className="meetings-tab__join-empty">{t("crm.meetings.noSharedLinkYet")}</p>
        ) : null}

        {onShareMeetingLink ? (
          <button
            type="button"
            className="btn btn-primary meetings-tab__share-btn"
            onClick={onShareMeetingLink}
            disabled={!canShareMeetingLink}
          >
            {t("crm.console.sendMeetingLink")}
          </button>
        ) : null}
      </div>

      {showMeetingUrlEditor && onMeetingUrlDraftChange && onSaveMeetingUrl ? (
        <div className="counselor-console__inline-form meetings-tab__meeting-url-form">
          <p className="meetings-tab__booking-links-title">{t("crm.console.myMeetingLink")}</p>
          <label>
            <span>{t("crm.console.meetingUrl")}</span>
            <input
              value={meetingUrlDraft ?? ""}
              onChange={(e) => onMeetingUrlDraftChange(e.target.value)}
              placeholder={t("crm.console.meetingUrlPlaceholder")}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={meetingUrlSaveBusy}
            onClick={onSaveMeetingUrl}
          >
            {t("crm.console.saveMeetingUrl")}
          </button>
        </div>
      ) : null}

      {showMeetingLabelEditor && onMeetingLabelDraftChange && onSaveMeetingLabel ? (
        <div className="counselor-console__inline-form meetings-tab__label-form">
          <label>
            <span>{t("crm.console.meetingLabel")}</span>
            <input
              value={meetingLabelDraft ?? ""}
              onChange={(e) => onMeetingLabelDraftChange(e.target.value)}
              placeholder={t("crm.console.meetingLabelPlaceholder")}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={onSaveMeetingLabel}>
            {t("crm.console.saveMeeting")}
          </button>
        </div>
      ) : null}

      <MeetingRecapsPanel
        recaps={recaps}
        studentDisplayName={studentDisplayName}
        canEdit={canEditRecaps}
        busy={recapBusy}
        onOpenActionItems={onOpenActionItems}
        onAdd={onAddRecap}
        onDelete={onDeleteRecap}
      />
    </>
  );
}
