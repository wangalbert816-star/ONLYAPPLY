import { useLanguage } from "../../i18n/LanguageContext";
import { isCalendlyBookingEnabled } from "../../lib/expertConsultBooking";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { countOpenTasks, getCounselor } from "../../lib/crm/store";
import type { CrmCounselor, CrmEngagement, CrmMeetingRecap, CrmMessage, CrmStoredFile, CrmTask } from "../../lib/crm/types";
import { CrmUnreadBadge } from "../../lib/crm/CrmUnreadBadge";
import { AccountTaskList } from "./AccountTaskList";
import { MeetingRecapsPanel } from "./MeetingRecapsPanel";

type TabId = "home" | "todos" | "documents" | "chat" | "meetings" | "files" | "resume" | "student";

type Props = {
  engagement: CrmEngagement;
  counselor: CrmCounselor;
  tasks: CrmTask[];
  files: CrmStoredFile[];
  pins: CrmMessage[];
  meetingRecaps: CrmMeetingRecap[];
  unreadMessages: number;
  onTabChange: (tab: TabId) => void;
  onToggleTask: (taskId: string, done: boolean) => void;
  onSubmitted: () => void;
  onBookMeeting: () => void;
  onOpenActionItems?: () => void;
  formatWhen: (iso: string) => string;
  studentDisplayName?: string;
};

export function SignedServiceOverview({
  engagement,
  counselor,
  tasks,
  files,
  pins,
  meetingRecaps,
  unreadMessages,
  onTabChange,
  onToggleTask,
  onSubmitted,
  onBookMeeting,
  onOpenActionItems,
  formatWhen,
  studentDisplayName,
}: Props) {
  const { t, locale } = useLanguage();
  const openTasks = countOpenTasks(engagement.id);
  const counselorNames = (engagement.counselorIds ?? [engagement.counselorId])
    .map((id) => getCounselor(id))
    .filter(Boolean)
    .map((c) => localizeCrmText((c as CrmCounselor).name, locale, t));
  const meetingLabel = engagement.nextMeetingLabel
    ? localizeCrmText(engagement.nextMeetingLabel, locale, t)
    : t("crm.signedService.noMeetingScheduled");
  const calendlyEnabled = isCalendlyBookingEnabled(counselor.calendlyUrl);

  return (
    <div className="hub-overview">
      <section className="hub-overview__hero" aria-label={t("crm.signedService.overviewHeroAria")}>
        <div className="hub-overview__counselor">
          <div className="hub-overview__avatar" aria-hidden>
            {localizeCrmText(counselor.name, locale, t).slice(0, 1)}
          </div>
          <div className="hub-overview__counselor-copy">
            <p className="hub-overview__eyebrow">{t("crm.myCounselor")}</p>
            <h2>{counselorNames.join(", ") || localizeCrmText(counselor.name, locale, t)}</h2>
            <p className="hub-overview__role">{localizeCrmText(counselor.title, locale, t)}</p>
          </div>
        </div>

        <div className="hub-overview__stats">
          <button type="button" className="hub-overview__stat" onClick={() => onTabChange("todos")}>
            <span className="hub-overview__stat-value">{openTasks}</span>
            <span className="hub-overview__stat-label">{t("crm.signedService.overviewOpenActions")}</span>
          </button>
          <button type="button" className="hub-overview__stat" onClick={() => onTabChange("chat")}>
            <span className={`hub-overview__stat-value${unreadMessages > 0 ? " hub-overview__stat-value--alert" : ""}`}>
              {unreadMessages}
            </span>
            <span className="hub-overview__stat-label">{t("crm.signedService.overviewUnread")}</span>
          </button>
        </div>
      </section>

      <div className="hub-overview__layout">
        <div className="hub-overview__main">
          <section className="hub-overview__card hub-overview__card--pins">
            <div className="hub-overview__card-head">
              <h3>{t("crm.signedService.pinsTitle")}</h3>
            </div>
            {pins.length === 0 ? (
              <p className="signed-service-hub__muted">{t("crm.signedService.pinsEmpty")}</p>
            ) : (
              <ul className="hub-overview__pins">
                {pins.map((pin) => (
                  <li key={pin.id} className="hub-overview__pin">
                    <span className="hub-overview__pin-tag">{t("crm.signedService.pin")}</span>
                    <p className="hub-overview__pin-body">{localizeCrmText(pin.body, locale, t)}</p>
                    <p className="hub-overview__pin-meta">
                      {formatWhen(pin.createdAt)} · {localizeCrmText(pin.authorLabel, locale, t)}
                      {pin.channel === "group" ? ` · ${t("crm.signedService.groupChat")}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="hub-overview__card">
            <div className="hub-overview__card-head">
              <h3>{t("crm.myTasks")}</h3>
              <button type="button" className="hub-overview__card-link" onClick={() => onTabChange("todos")}>
                {t("crm.signedService.viewAllTodos")}
              </button>
            </div>
            <AccountTaskList
              tasks={tasks}
              files={files}
              engagementId={engagement.id}
              allowSubmit
              onSubmitted={onSubmitted}
              onToggleTask={onToggleTask}
              onTaskNavigate={() => onTabChange("todos")}
              variant="plain"
              maxCollapsed={2}
            />
          </section>
        </div>

        <aside className="hub-overview__aside">
          <section className="hub-overview__card hub-overview__card--meeting">
            <p className="hub-overview__eyebrow">{t("crm.signedService.nextMeeting")}</p>
            <p className="hub-overview__meeting-when">{meetingLabel}</p>
            <button type="button" className="btn btn-primary hub-overview__meeting-btn" onClick={onBookMeeting}>
              {calendlyEnabled ? t("crm.bookMeeting") : t("crm.bookMeetingFallback")}
            </button>
          </section>

          <section className="hub-overview__card hub-overview__card--recaps">
            <div className="hub-overview__card-head">
              <h3>{t("crm.meetings.recapsTitle")}</h3>
              {meetingRecaps.length > 0 ? (
                <button type="button" className="hub-overview__card-link" onClick={() => onTabChange("meetings")}>
                  {t("crm.meetings.viewAllRecaps")}
                </button>
              ) : null}
            </div>
            <MeetingRecapsPanel
              recaps={meetingRecaps}
              studentDisplayName={studentDisplayName}
              compact
              onOpenActionItems={onOpenActionItems}
            />
          </section>

          <section className="hub-overview__card hub-overview__card--actions">
            <p className="hub-overview__eyebrow">{t("crm.signedService.overviewQuickActions")}</p>
            <div className="hub-overview__actions">
              <button type="button" className="hub-overview__action" onClick={() => onTabChange("chat")}>
                <span>{t("crm.signedService.tabs.chat")}</span>
                {unreadMessages > 0 ? <CrmUnreadBadge count={unreadMessages} label={t("crm.notifications.unreadMessages", { n: unreadMessages })} /> : null}
              </button>
              <button type="button" className="hub-overview__action" onClick={() => onTabChange("documents")}>
                {t("crm.signedService.tabs.documents")}
              </button>
              <button type="button" className="hub-overview__action" onClick={() => onTabChange("files")}>
                {t("crm.signedService.tabs.files")}
              </button>
              <button type="button" className="hub-overview__action" onClick={() => onTabChange("resume")}>
                {t("crm.signedService.tabs.resume")}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
