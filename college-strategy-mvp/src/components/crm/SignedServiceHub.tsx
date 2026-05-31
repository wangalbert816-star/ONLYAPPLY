import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { buildApplicationInfoRows } from "../../lib/applicationInfoRows";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { isCalendlyBookingEnabled, requestExpertConsult } from "../../lib/expertConsultBooking";
import {
  addMessage,
  listDocuments,
  listFiles,
  listMessages,
  listPinnedMessages,
  listTasks,
  notifyCrmStoreChange,
  setTaskDone,
  subscribeCrmStore,
  toggleMessagePin,
} from "../../lib/crm/store";
import type { CrmCounselor, CrmEngagement, CrmMessageChannel, CrmTaskLinkType } from "../../lib/crm/types";
import type { FormState } from "../../types";
import { BrandLogo } from "../BrandLogo";
import { AccountTaskList } from "./AccountTaskList";
import { CaseFilesPanel } from "./CaseFilesPanel";
import "./CaseFilesPanel.css";
import "./SignedServiceHub.css";

type TabId = "home" | "todos" | "documents" | "chat" | "meetings" | "files" | "student";

type Props = {
  engagement: CrmEngagement;
  counselor: CrmCounselor;
  form: FormState;
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

export function SignedServiceHub({ engagement, counselor, form, userEmail, onBack }: Props) {
  const { t, locale } = useLanguage();
  const [tab, setTab] = useState<TabId>("home");
  const [chatChannel, setChatChannel] = useState<CrmMessageChannel>("direct");
  const [messageDraft, setMessageDraft] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => subscribeCrmStore(refresh), [refresh]);

  const tasks = useMemo(() => listTasks(engagement.id), [engagement.id, tick]);
  const documents = useMemo(() => listDocuments(engagement.id), [engagement.id, tick]);
  const files = useMemo(() => listFiles(engagement.id), [engagement.id, tick]);
  const pins = useMemo(() => listPinnedMessages(engagement.id), [engagement.id, tick]);
  const chatMessages = useMemo(
    () => listMessages(engagement.id, chatChannel),
    [engagement.id, chatChannel, tick],
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "home", label: t("crm.signedService.tabs.home") },
    { id: "todos", label: t("crm.signedService.tabs.todos") },
    { id: "documents", label: t("crm.signedService.tabs.documents") },
    { id: "chat", label: t("crm.signedService.tabs.chat") },
    { id: "meetings", label: t("crm.signedService.tabs.meetings") },
    { id: "files", label: t("crm.signedService.tabs.files") },
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

  const bookMeeting = () => {
    requestExpertConsult({
      url: counselor.calendlyUrl ?? null,
      email: userEmail,
      source: "signed_service_hub",
      onFallback: () => setTab("chat"),
    });
  };

  const docStatusLabel = (status: string) => {
    const key = `crm.signedService.docStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  return (
    <div className="signed-service-hub">
      <header className="signed-service-hub__head">
        <BrandLogo />
        <div className="signed-service-hub__head-copy">
          <p className="signed-service-hub__kicker">{t("crm.serviceKicker")}</p>
          <h1>{localizeCrmText(engagement.applicationTitle, locale, t)}</h1>
          <p>
            {localizeCrmText(counselor.name, locale, t)} · {t(`crm.phase.${engagement.phase}`)}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
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
          </button>
        ))}
      </nav>

      <main className="signed-service-hub__main">
        {tab === "home" && (
          <div className="signed-service-hub__stack">
            <section className="signed-service-hub__panel">
              <h2>{t("crm.signedService.pinsTitle")}</h2>
              {pins.length === 0 ? (
                <p className="signed-service-hub__muted">{t("crm.signedService.pinsEmpty")}</p>
              ) : (
                <ul className="signed-service-hub__pins">
                  {pins.map((pin) => (
                    <li key={pin.id}>
                      <span className="signed-service-hub__pin-badge">{t("crm.signedService.pin")}</span>
                      <p>{localizeCrmText(pin.body, locale, t)}</p>
                      <span className="signed-service-hub__muted">
                        {formatWhen(pin.createdAt, locale)} · {localizeCrmText(pin.authorLabel, locale, t)}
                        {pin.channel === "group" ? ` · ${t("crm.signedService.groupChat")}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="signed-service-hub__panel signed-service-hub__panel--split">
              <div>
                <h2>{t("crm.myTasks")}</h2>
                <AccountTaskList
                  tasks={tasks.slice(0, 3)}
                  onToggleTask={(taskId, done) => {
                    setTaskDone(taskId, done);
                    notifyCrmStoreChange();
                    refresh();
                  }}
                  onTaskNavigate={() => setTab("student")}
                  variant="card"
                  maxCollapsed={3}
                />
                <button type="button" className="signed-service-hub__link" onClick={() => setTab("todos")}>
                  {t("crm.signedService.viewAllTodos")}
                </button>
              </div>
              <div>
                <h2>{t("crm.signedService.nextMeeting")}</h2>
                <p>
                  {engagement.nextMeetingLabel
                    ? localizeCrmText(engagement.nextMeetingLabel, locale, t)
                    : t("crm.signedService.noMeetingScheduled")}
                </p>
                <button type="button" className="btn btn-primary" onClick={bookMeeting}>
                  {isCalendlyBookingEnabled(counselor.calendlyUrl) ? t("crm.bookMeeting") : t("crm.bookMeetingFallback")}
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === "todos" && (
          <section className="signed-service-hub__panel">
            <h2>{t("crm.myTasks")}</h2>
            <AccountTaskList
              tasks={tasks}
              onToggleTask={(taskId, done) => {
                setTaskDone(taskId, done);
                notifyCrmStoreChange();
                refresh();
              }}
              onTaskNavigate={(link: CrmTaskLinkType) => {
                if (link === "profile" || link === "activities") setTab("student");
              }}
              variant="card"
              maxCollapsed={20}
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
            <div className="signed-service-hub__meeting-card">
              <p>
                <strong>{localizeCrmText(counselor.name, locale, t)}</strong> ·{" "}
                {localizeCrmText(counselor.title, locale, t)}
              </p>
              {engagement.nextMeetingLabel ? (
                <p>
                  {t("crm.nextMeeting", {
                    when: localizeCrmText(engagement.nextMeetingLabel, locale, t),
                  })}
                </p>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={bookMeeting}>
                {isCalendlyBookingEnabled(counselor.calendlyUrl) ? t("crm.bookMeeting") : t("crm.bookMeetingFallback")}
              </button>
            </div>
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
