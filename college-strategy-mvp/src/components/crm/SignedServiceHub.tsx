import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { buildApplicationInfoRows } from "../../lib/applicationInfoRows";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import {
  addMessage,
  countUnreadCounselorMessages,
  initCrmForUser,
  listDocuments,
  listFiles,
  listMeetingRecaps,
  listMessages,
  listPinnedMessages,
  listTasks,
  markMessagesReadByStudent,
  notifyCrmStoreChange,
  setTaskDone,
  subscribeCrmStore,
  toggleMessagePin,
} from "../../lib/crm/store";
import type { CrmCounselor, CrmEngagement, CrmMessageChannel, CrmTaskLinkType } from "../../lib/crm/types";
import type { FormState } from "../../types";
import { BrandLogo } from "../BrandLogo";
import { CrmUnreadBadge } from "../../lib/crm/CrmUnreadBadge";
import "../../lib/crm/crmUnreadBadge.css";
import { AccountTaskList } from "./AccountTaskList";
import { CaseFilesPanel } from "./CaseFilesPanel";
import { MeetingsTabPanel } from "./MeetingsTabPanel";
import { SignedServiceOverview } from "./SignedServiceOverview";
import { ResumeBuilder } from "../resume/ResumeBuilder";
import "./CaseFilesPanel.css";
import "./SignedServiceHub.css";

type TabId = "home" | "todos" | "documents" | "chat" | "meetings" | "files" | "resume" | "student";

type Props = {
  engagement: CrmEngagement;
  counselor: CrmCounselor;
  form: FormState;
  studentUserId: string;
  userEmail?: string | null;
  onBack: () => void;
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

export function SignedServiceHub({ engagement, counselor, form, studentUserId, userEmail, onBack }: Props) {
  const { t, locale } = useLanguage();
  const [tab, setTab] = useState<TabId>("home");
  const [chatChannel, setChatChannel] = useState<CrmMessageChannel>("direct");
  const [messageDraft, setMessageDraft] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => subscribeCrmStore(refresh), [refresh]);

  useEffect(() => {
    void initCrmForUser(studentUserId, "student").then(() => refresh());
  }, [studentUserId, refresh]);

  useEffect(() => {
    if (tab !== "chat") return;
    markMessagesReadByStudent(engagement.id);
    notifyCrmStoreChange();
    refresh();
  }, [tab, engagement.id, refresh]);

  const unreadMessages = useMemo(
    () => countUnreadCounselorMessages(engagement.id),
    [engagement.id, tick],
  );

  const tasks = useMemo(() => listTasks(engagement.id), [engagement.id, tick]);
  const documents = useMemo(() => listDocuments(engagement.id), [engagement.id, tick]);
  const files = useMemo(() => listFiles(engagement.id), [engagement.id, tick]);
  const pins = useMemo(() => listPinnedMessages(engagement.id), [engagement.id, tick]);
  const meetingRecaps = useMemo(() => listMeetingRecaps(engagement.id), [engagement.id, tick]);
  const chatMessages = useMemo(
    () => listMessages(engagement.id, chatChannel),
    [engagement.id, chatChannel, tick],
  );

  const studentDisplayName =
    engagement.studentName?.trim() || userEmail?.split("@")[0] || undefined;

  const tabs: { id: TabId; label: string }[] = [
    { id: "home", label: t("crm.signedService.tabs.home") },
    { id: "todos", label: t("crm.signedService.tabs.todos") },
    { id: "documents", label: t("crm.signedService.tabs.documents") },
    { id: "chat", label: t("crm.signedService.tabs.chat") },
    { id: "meetings", label: t("crm.signedService.tabs.meetings") },
    { id: "files", label: t("crm.signedService.tabs.files") },
    { id: "resume", label: t("crm.signedService.tabs.resume") },
    { id: "student", label: t("crm.signedService.tabs.student") },
  ];

  const studentRows = useMemo(() => buildApplicationInfoRows(form, locale, t), [form, locale, t]);

  const sendChat = () => {
    const body = messageDraft.trim();
    if (!body) return;
    addMessage({
      engagementId: engagement.id,
      authorRole: "student",
      authorLabel: userEmail?.split("@")[0] || t("crm.signedService.you"),
      body,
      channel: chatChannel,
    });
    setMessageDraft("");
    notifyCrmStoreChange();
    refresh();
  };

  const joinMeeting = () => {
    const url = engagement.meetingJoinUrl?.trim();
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const docStatusLabel = (status: string) => {
    const key = `crm.signedService.docStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  return (
    <div className="signed-service-hub">
      <header className="signed-service-hub__head">
        <div className="signed-service-hub__brand">
          <BrandLogo />
        </div>
        <div className="signed-service-hub__head-copy">
          <p className="signed-service-hub__kicker">{t("crm.serviceKicker")}</p>
          <div className="signed-service-hub__title-row">
            <h1>{localizeCrmText(engagement.applicationTitle, locale, t)}</h1>
            <span className="signed-service-hub__phase">{t(`crm.phase.${engagement.phase}`)}</span>
          </div>
          <p className="signed-service-hub__subtitle">
            {localizeCrmText(counselor.name, locale, t)} · {localizeCrmText(counselor.title, locale, t)}
          </p>
        </div>
        <button type="button" className="btn btn-secondary signed-service-hub__back" onClick={onBack}>
          {t("crm.signedService.backToAccount")}
        </button>
      </header>

      <nav className="signed-service-hub__nav" aria-label={t("crm.signedService.navAria")}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "is-active" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "chat" && unreadMessages > 0 && tab !== "chat" ? (
              <CrmUnreadBadge
                count={unreadMessages}
                className="crm-unread-badge--nav-tab"
                label={t("crm.notifications.unreadMessages", { n: unreadMessages })}
              />
            ) : null}
          </button>
        ))}
      </nav>

      <main className="signed-service-hub__main">
        {tab === "home" && (
          <SignedServiceOverview
            engagement={engagement}
            counselor={counselor}
            tasks={tasks}
            files={files}
            pins={pins}
            meetingRecaps={meetingRecaps}
            studentDisplayName={studentDisplayName}
            unreadMessages={unreadMessages}
            onTabChange={setTab}
            onToggleTask={(taskId, done) => {
              setTaskDone(taskId, done);
              notifyCrmStoreChange();
              refresh();
            }}
            onSubmitted={() => {
              notifyCrmStoreChange();
              refresh();
            }}
            onJoinMeeting={engagement.meetingJoinUrl ? joinMeeting : undefined}
            onOpenActionItems={() => setTab("todos")}
            formatWhen={(iso) => formatWhen(iso, locale)}
          />
        )}

        {tab === "todos" && (
          <section className="signed-service-hub__panel signed-service-hub__panel--todos">
            <AccountTaskList
              layout="board"
              tasks={tasks}
              files={files}
              engagementId={engagement.id}
              allowSubmit
              onSubmitted={() => {
                notifyCrmStoreChange();
                refresh();
              }}
              onToggleTask={(taskId, done) => {
                setTaskDone(taskId, done);
                notifyCrmStoreChange();
                refresh();
              }}
              onTaskNavigate={(link: CrmTaskLinkType) => {
                if (link === "profile" || link === "activities") setTab("student");
                if (link === "essay") setTab("documents");
                if (link === "report") setTab("home");
              }}
            />
          </section>
        )}

        {tab === "documents" && (
          <section className="signed-service-hub__panel">
            <h2>{t("crm.signedService.documentsTitle")}</h2>
            <p className="signed-service-hub__muted">{t("crm.signedService.documentsLead")}</p>
            <div className="signed-service-hub__table-wrap">
              <table className="signed-service-hub__table">
                <thead>
                  <tr>
                    <th>{t("crm.signedService.colName")}</th>
                    <th>{t("crm.signedService.colType")}</th>
                    <th>{t("crm.signedService.colStatus")}</th>
                    <th>{t("crm.signedService.colDue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>{localizeCrmText(doc.name, locale, t)}</td>
                      <td>{doc.docType}</td>
                      <td>
                        <span className={`signed-service-hub__status signed-service-hub__status--${doc.status}`}>
                          {docStatusLabel(doc.status)}
                        </span>
                      </td>
                      <td>{doc.dueAt || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "chat" && (
          <section className="signed-service-hub__panel">
            <div className="signed-service-hub__chat-tabs">
              <button
                type="button"
                className={chatChannel === "direct" ? "is-active" : undefined}
                onClick={() => setChatChannel("direct")}
              >
                {t("crm.signedService.directChat")}
              </button>
              <button
                type="button"
                className={chatChannel === "group" ? "is-active" : undefined}
                onClick={() => setChatChannel("group")}
              >
                {t("crm.signedService.groupChat")}
              </button>
            </div>
            <ul className="signed-service-hub__timeline">
              {[...chatMessages].reverse().map((message) => (
                <li key={message.id} className={`is-${message.authorRole}`}>
                  <div className="signed-service-hub__message-head">
                    <span>
                      {formatWhen(message.createdAt, locale)} · {localizeCrmText(message.authorLabel, locale, t)}
                    </span>
                    <button
                      type="button"
                      className="signed-service-hub__link"
                      onClick={() => {
                        toggleMessagePin(message.id);
                        notifyCrmStoreChange();
                        refresh();
                      }}
                    >
                      {message.pinned ? t("crm.signedService.unpin") : t("crm.signedService.pin")}
                    </button>
                  </div>
                  <p>{localizeCrmText(message.body, locale, t)}</p>
                </li>
              ))}
            </ul>
            <div className="signed-service-hub__compose">
              <textarea
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder={t("crm.messagePlaceholder")}
                rows={3}
              />
              <button type="button" className="btn btn-primary" onClick={sendChat} disabled={!messageDraft.trim()}>
                {t("crm.send")}
              </button>
            </div>
          </section>
        )}

        {tab === "meetings" && (
          <section className="signed-service-hub__panel">
            <h2>{t("crm.signedService.meetingsTitle")}</h2>
            <p className="signed-service-hub__muted">{t("crm.signedService.meetingsLead")}</p>
            <MeetingsTabPanel
              engagement={engagement}
              counselor={counselor}
              recaps={meetingRecaps}
              studentDisplayName={studentDisplayName}
              onJoinMeeting={engagement.meetingJoinUrl ? joinMeeting : undefined}
              onOpenActionItems={() => setTab("todos")}
            />
          </section>
        )}

        {tab === "files" && (
          <section className="signed-service-hub__panel">
            <h2>{t("crm.signedService.filesTitle")}</h2>
            <CaseFilesPanel
              engagementId={engagement.id}
              uploadedByRole="student"
              files={files}
              defaultCategory="student"
              onChange={() => {
                notifyCrmStoreChange();
                refresh();
              }}
            />
          </section>
        )}

        {tab === "resume" && (
          <section className="signed-service-hub__panel signed-service-hub__panel--resume">
            <ResumeBuilder
              key={engagement.id}
              form={form}
              userEmail={userEmail}
              displayName={studentDisplayName}
              engagementId={engagement.id}
              editorRole="student"
            />
          </section>
        )}

        {tab === "student" && (
          <section className="signed-service-hub__panel">
            <h2>{t("crm.signedService.studentTitle")}</h2>
            <p className="signed-service-hub__muted">{t("crm.signedService.studentLead")}</p>
            <dl className="signed-service-hub__info">
              {studentRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              {t("crm.signedService.editInAccount")}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
