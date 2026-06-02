import { useLanguage } from "../../i18n/LanguageContext";
import type { CrmMeetingRecapDraft } from "../../lib/crm/meetingRecapFormat";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { isCalendlyBookingEnabled } from "../../lib/expertConsultBooking";
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
  onBookMeeting: () => void;
  onOpenActionItems?: () => void;
  onAddRecap?: (input: CrmMeetingRecapDraft) => Promise<void>;
  onDeleteRecap?: (recapId: string) => Promise<void>;
  meetingLabelDraft?: string;
  onMeetingLabelDraftChange?: (value: string) => void;
  onSaveMeetingLabel?: () => void;
  showMeetingLabelEditor?: boolean;
  bookButtonLabel?: string;
  bookingCalendlyUrl?: string | null;
};

export function MeetingsTabPanel({
  engagement,
  counselor,
  recaps,
  studentDisplayName,
  canEditRecaps = false,
  recapBusy = false,
  onBookMeeting,
  onOpenActionItems,
  onAddRecap,
  onDeleteRecap,
  meetingLabelDraft,
  onMeetingLabelDraftChange,
  onSaveMeetingLabel,
  showMeetingLabelEditor = false,
  bookButtonLabel,
  bookingCalendlyUrl,
}: Props) {
  const { t, locale } = useLanguage();
  const meetingLabel = engagement.nextMeetingLabel
    ? localizeCrmText(engagement.nextMeetingLabel, locale, t)
    : t("crm.signedService.noMeetingScheduled");
  const calendlyEnabled = isCalendlyBookingEnabled(bookingCalendlyUrl ?? counselor.calendlyUrl);

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
        <button type="button" className="btn btn-primary" onClick={onBookMeeting}>
          {bookButtonLabel ??
            (calendlyEnabled ? t("crm.bookMeeting") : t("crm.bookMeetingFallback"))}
        </button>
      </div>

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
