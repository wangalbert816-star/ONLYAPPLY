import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import type { CrmCounselor, CrmEngagement, CrmMessage, CrmTask, CrmTaskLinkType } from "../../lib/crm/types";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { isTaskAction, isTaskResource } from "../../lib/crm/taskItemKind";
import { CrmUnreadBadge } from "../../lib/crm/CrmUnreadBadge";
import { getCounselor } from "../../lib/crm/store";
import "../../lib/crm/crmUnreadBadge.css";
import { TaskTypeBadge, taskItemClass } from "./TaskTypeBadge";
import "./AccountServicePanel.css";
import "./crmTaskTypes.css";

type Props = {
  engagement: CrmEngagement;
  counselor: CrmCounselor;
  messages: CrmMessage[];
  tasks: CrmTask[];
  userEmail?: string | null;
  onSendMessage: (body: string) => void;
  onToggleTask: (taskId: string, done: boolean) => void;
  onTaskNavigate: (linkType: CrmTaskLinkType) => void;
  onFocusMessages?: () => void;
  onOpenSignedServiceHub?: () => void;
};

function formatWhen(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function phaseLabel(phase: CrmEngagement["phase"], t: (k: string) => string) {
  return t(`crm.phase.${phase}`);
}

export function AccountServicePanel({
  engagement,
  counselor,
  messages,
  tasks,
  onSendMessage,
  onToggleTask,
  onTaskNavigate,
  onFocusMessages,
  onOpenSignedServiceHub,
}: Props) {
  const { t, locale } = useLanguage();
  const [draft, setDraft] = useState("");
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showAllUpdates, setShowAllUpdates] = useState(false);

  const openTasks = tasks.filter((task) => task.status === "open" && isTaskAction(task));
  const visibleTasks = showAllTasks ? tasks : tasks.slice(0, 3);
  const visibleMessages = showAllUpdates ? messages : messages.slice(0, 3);
  const unread = messages.filter((m) => m.authorRole === "counselor" && !m.readByStudent).length;
  const meetingJoinUrl = engagement.meetingJoinUrl?.trim() || "";
  const counselorNames = (engagement.counselorIds ?? [engagement.counselorId])
    .map((id) => getCounselor(id))
    .filter(Boolean)
    .map((c) => localizeCrmText((c as CrmCounselor).name, locale, t));

  const taskLinkLabel = useMemo(
    () =>
      ({
        profile: t("crm.taskLink.profile"),
        activities: t("crm.taskLink.activities"),
        essay: t("crm.taskLink.essay"),
        report: t("crm.taskLink.report"),
        none: t("crm.taskLink.none"),
      }) satisfies Record<CrmTaskLinkType, string>,
    [t],
  );

  const joinMeeting = () => {
    if (!meetingJoinUrl) return;
    window.open(meetingJoinUrl, "_blank", "noopener,noreferrer");
  };

  const submitMessage = () => {
    const body = draft.trim();
    if (!body) return;
    onSendMessage(body);
    setDraft("");
  };

  return (
    <section className="account-service" aria-labelledby="account-service-title">
      <div className="account-service__head">
        <div>
          <p className="account-service__kicker">{t("crm.serviceKicker")}</p>
          <h2 id="account-service-title">{t("crm.serviceTitle")}</h2>
        </div>
        <div className="account-service__head-actions">
          {onOpenSignedServiceHub ? (
            <button type="button" className="btn btn-primary account-service__hub-btn" onClick={onOpenSignedServiceHub}>
              {t("crm.signedService.openHub")}
              {unread > 0 ? (
                <CrmUnreadBadge count={unread} className="crm-unread-badge--menu" label={t("crm.notifications.unreadMessages", { n: unread })} />
              ) : null}
            </button>
          ) : null}
          <span className="account-service__phase">{phaseLabel(engagement.phase, t)}</span>
        </div>
      </div>

      <div className="account-service__grid">
        <article className="account-service__counselor">
          <div className="account-service__avatar" aria-hidden>
            {counselor.name.slice(0, 1)}
          </div>
          <p className="account-service__label">{t("crm.myCounselor")}</p>
          <h3>{counselorNames.join(", ") || localizeCrmText(counselor.name, locale, t)}</h3>
          <p className="account-service__role">{localizeCrmText(counselor.title, locale, t)}</p>
          {engagement.nextMeetingLabel && (
            <p className="account-service__meta">
              {t("crm.nextMeeting", { when: localizeCrmText(engagement.nextMeetingLabel, locale, t) })}
            </p>
          )}
          {engagement.planLabel && (
            <p className="account-service__meta">{localizeCrmText(engagement.planLabel, locale, t)}</p>
          )}
          <div className="account-service__actions">
            <button type="button" className="btn btn-secondary" onClick={() => onFocusMessages?.()}>
              {t("crm.sendMessage")}
              {unread > 0 ? <span className="account-service__badge">{unread}</span> : null}
            </button>
            {meetingJoinUrl ? (
              <button type="button" className="btn btn-primary" onClick={joinMeeting}>
                {t("crm.meetings.joinMeeting")}
              </button>
            ) : null}
          </div>
        </article>

        <article className="account-service__tasks">
          <div className="account-service__block-head">
            <h3>{t("crm.myTasks")}</h3>
            <span>{t("crm.openTasks", { n: openTasks.length })}</span>
          </div>
          {visibleTasks.length === 0 ? (
            <p className="account-service__empty">{t("crm.noTasks")}</p>
          ) : (
            <ul className="account-service__task-list">
              {visibleTasks.map((task) => {
                const isResource = isTaskResource(task);
                return (
                <li key={task.id} className={taskItemClass(task)}>
                  {isResource ? (
                    <div className="account-service__task-resource">
                      <span className="crm-task-resource-mark" aria-hidden />
                      <div className="account-service__task-title">{localizeCrmText(task.title, locale, t)}</div>
                    </div>
                  ) : (
                  <label className="account-service__task-check">
                    <input
                      type="checkbox"
                      checked={task.status === "done"}
                      onChange={(e) => onToggleTask(task.id, e.target.checked)}
                    />
                    <span>{localizeCrmText(task.title, locale, t)}</span>
                  </label>
                  )}
                  <div className="account-service__task-meta">
                    <TaskTypeBadge
                      linkType={task.linkType}
                      itemKind={task.itemKind}
                      label={taskLinkLabel[task.linkType]}
                      resourceLabel={t("crm.taskItemKind.resource")}
                    />
                    {!isResource && task.dueAt ? <span>{t("crm.due", { date: task.dueAt })}</span> : null}
                    {!isResource && task.status === "done" ? <span>{t("crm.taskDone")}</span> : null}
                    {!isResource && task.linkType !== "none" && task.status === "open" ? (
                      <button type="button" className="account-service__task-link" onClick={() => onTaskNavigate(task.linkType)}>
                        {taskLinkLabel[task.linkType]}
                      </button>
                    ) : null}
                  </div>
                </li>
              );})}
            </ul>
          )}
          {tasks.length > 3 ? (
            <button type="button" className="account-service__more" onClick={() => setShowAllTasks((v) => !v)}>
              {showAllTasks ? t("crm.showLess") : t("crm.showAllTasks")}
            </button>
          ) : null}
        </article>
      </div>

      <article className="account-service__updates" id="account-service-updates">
        <div className="account-service__block-head">
          <h3>{t("crm.updates")}</h3>
        </div>
        {visibleMessages.length === 0 ? (
          <p className="account-service__empty">{t("crm.noUpdates")}</p>
        ) : (
          <ul className="account-service__timeline">
            {visibleMessages.map((message) => (
              <li key={message.id} className={`account-service__event account-service__event--${message.authorRole}`}>
                <p className="account-service__event-meta">
                  {formatWhen(message.createdAt, locale)} · {localizeCrmText(message.authorLabel, locale, t)}
                </p>
                <p>{localizeCrmText(message.body, locale, t)}</p>
              </li>
            ))}
          </ul>
        )}
        {messages.length > 3 ? (
          <button type="button" className="account-service__more" onClick={() => setShowAllUpdates((v) => !v)}>
            {showAllUpdates ? t("crm.showLess") : t("crm.showAllUpdates")}
          </button>
        ) : null}
        <div className="account-service__compose">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("crm.messagePlaceholder")}
            rows={2}
          />
          <button type="button" className="btn btn-primary" onClick={submitMessage} disabled={!draft.trim()}>
            {t("crm.send")}
          </button>
        </div>
      </article>
    </section>
  );
}
