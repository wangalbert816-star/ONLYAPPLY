import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { isCalendlyBookingEnabled } from "../../lib/expertConsultBooking";
import { buildApplicationInfoRows } from "../../lib/applicationInfoRows";
import { fetchApplicationFormById } from "../../lib/supabase/accounts";
import {
  addDocument,
  addMessage,
  assignTask,
  getCounselor,
  getEngagementById,
  listDocuments,
  listEngagements,
  listFiles,
  listMessages,
  listPinnedMessages,
  listTasks,
  notifyCrmStoreChange,
  setTaskDone,
  subscribeCrmStore,
  toggleFollowUp,
  toggleMessagePin,
  updateDocumentStatus,
  updateInternalNotes,
  updateNextMeetingLabel,
} from "../../lib/crm/store";
import type { CrmApplicationDocument, CrmEngagement, CrmMessageChannel, CrmTaskLinkType } from "../../lib/crm/types";
import type { FormState } from "../../types";
import { BrandLogo } from "../BrandLogo";
import { CaseFilesPanel } from "./CaseFilesPanel";
import "./CaseFilesPanel.css";
import "./CounselorConsole.css";
import "./SignedServiceHub.css";

type Props = {
  onBack: () => void;
  onOpenStudentReport?: (engagement: CrmEngagement) => void;
};

type TabId = "home" | "todos" | "documents" | "chat" | "meetings" | "files" | "student";

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

export function CounselorConsole({ onBack, onOpenStudentReport }: Props) {
  const { t, locale } = useLanguage();
  const [engagements, setEngagements] = useState(() => listEngagements());
  const [selectedId, setSelectedId] = useState<string | null>(() => listEngagements()[0]?.id ?? null);
  const [tab, setTab] = useState<TabId>("home");
  const [tick, setTick] = useState(0);
  const [chatChannel, setChatChannel] = useState<CrmMessageChannel>("direct");
  const [messageDraft, setMessageDraft] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDetail, setTaskDetail] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskLink, setTaskLink] = useState<CrmTaskLinkType>("none");
  const [docNameDraft, setDocNameDraft] = useState("");
  const [docTypeDraft, setDocTypeDraft] = useState("essay");
  const [docDueDraft, setDocDueDraft] = useState("");
  const [meetingLabelDraft, setMeetingLabelDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [studentForm, setStudentForm] = useState<FormState | null>(null);
  const [studentFormLoading, setStudentFormLoading] = useState(false);

  const refreshEngagements = useCallback(() => {
    const next = listEngagements();
    setEngagements(next);
    setSelectedId((current) => {
      if (current && next.some((e) => e.id === current)) return current;
      return next[0]?.id ?? null;
    });
  }, []);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
    refreshEngagements();
  }, [refreshEngagements]);

  useEffect(() => subscribeCrmStore(refresh), [refresh]);

  const selected = selectedId ? getEngagementById(selectedId) : null;
  const counselor = selected ? getCounselor(selected.counselorId) : null;

  const tasks = useMemo(() => (selected ? listTasks(selected.id) : []), [selected?.id, tick]);
  const documents = useMemo(() => (selected ? listDocuments(selected.id) : []), [selected?.id, tick]);
  const files = useMemo(() => (selected ? listFiles(selected.id) : []), [selected?.id, tick]);
  const pins = useMemo(() => (selected ? listPinnedMessages(selected.id) : []), [selected?.id, tick]);
  const chatMessages = useMemo(
    () => (selected ? listMessages(selected.id, chatChannel) : []),
    [selected?.id, chatChannel, tick],
  );

  useEffect(() => {
    setNotesDraft(selected?.internalNotes ?? "");
    setMeetingLabelDraft(selected?.nextMeetingLabel ?? "");
  }, [selected?.id, selected?.internalNotes, selected?.nextMeetingLabel]);

  useEffect(() => {
    setTab("home");
  }, [selectedId]);

  useEffect(() => {
    if (!selected) {
      setStudentForm(null);
      setStudentFormLoading(false);
      return;
    }
    let cancelled = false;
    setStudentFormLoading(true);
    void fetchApplicationFormById(selected.applicationId)
      .then((form) => {
        if (cancelled) return;
        setStudentForm(form);
      })
      .catch(() => {
        if (!cancelled) setStudentForm(null);
      })
      .finally(() => {
        if (!cancelled) setStudentFormLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.applicationId]);

  const followUpCount = useMemo(() => engagements.filter((e) => e.needsFollowUp).length, [engagements]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "home", label: t("crm.signedService.tabs.home") },
    { id: "todos", label: t("crm.signedService.tabs.todos") },
    { id: "documents", label: t("crm.signedService.tabs.documents") },
    { id: "chat", label: t("crm.signedService.tabs.chat") },
    { id: "meetings", label: t("crm.signedService.tabs.meetings") },
    { id: "files", label: t("crm.signedService.tabs.files") },
    { id: "student", label: t("crm.signedService.tabs.student") },
  ];

  const studentRows = useMemo(() => {
    if (!studentForm) return [];
    return buildApplicationInfoRows(studentForm, locale, t);
  }, [studentForm, locale, t]);

  const docStatusLabel = (status: string) => {
    const key = `crm.signedService.docStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  const sendChat = () => {
    if (!selected || !counselor) return;
    const body = messageDraft.trim();
    if (!body) return;
    addMessage({
      engagementId: selected.id,
      authorRole: "counselor",
      authorLabel: counselor.name,
      body,
      channel: chatChannel,
      readByStudent: false,
    });
    setMessageDraft("");
    notifyCrmStoreChange();
    refresh();
  };

  const buildTaskAssignedMessage = (
    title: string,
    detail: string,
    dueAt: string,
    linkType: CrmTaskLinkType,
  ) => {
    const lines = [t("crm.console.taskAssigned", { title })];
    if (detail) lines.push(detail);
    if (dueAt) lines.push(t("crm.console.taskAssignedDue", { date: dueAt }));
    if (linkType !== "none") {
      lines.push(t("crm.console.taskAssignedLink", { link: t(`crm.taskLink.${linkType}`) }));
    }
    return lines.join("\n\n");
  };

  const submitTask = () => {
    if (!selected || !counselor) return;
    const title = taskTitle.trim();
    if (!title) return;
    const detail = taskDetail.trim();
    assignTask({
      engagementId: selected.id,
      title,
      description: detail || undefined,
      dueAt: taskDue || undefined,
      linkType: taskLink,
      message: {
        authorLabel: counselor.name,
        body: buildTaskAssignedMessage(title, detail, taskDue, taskLink),
      },
    });
    setTaskTitle("");
    setTaskDetail("");
    setTaskDue("");
    setTaskLink("none");
    notifyCrmStoreChange();
    refresh();
  };

  const submitDocument = () => {
    if (!selected) return;
    const name = docNameDraft.trim();
    if (!name) return;
    addDocument({
      engagementId: selected.id,
      name,
      docType: docTypeDraft.trim() || "general",
      dueAt: docDueDraft || undefined,
    });
    setDocNameDraft("");
    setDocDueDraft("");
    notifyCrmStoreChange();
    refresh();
  };

  const openMeeting = () => {
    if (!counselor?.calendlyUrl) {
      window.alert(t("crm.console.noCalendly"));
      return;
    }
    window.open(counselor.calendlyUrl, "_blank", "noopener,noreferrer");
    if (selected) {
      addMessage({
        engagementId: selected.id,
        authorRole: "system",
        authorLabel: t("crm.console.systemLabel"),
        body: t("crm.console.meetingLinkSent"),
        readByStudent: false,
      });
      notifyCrmStoreChange();
      refresh();
    }
  };

  const saveMeetingLabel = () => {
    if (!selected) return;
    updateNextMeetingLabel(selected.id, meetingLabelDraft);
    notifyCrmStoreChange();
    refresh();
  };

  const saveNotes = () => {
    if (!selected) return;
    updateInternalNotes(selected.id, notesDraft);
    notifyCrmStoreChange();
    refresh();
  };

  const handleFollowUp = () => {
    if (!selected) return;
    toggleFollowUp(selected.id);
    notifyCrmStoreChange();
    refresh();
  };

  return (
    <div className="counselor-console">
      <header className="counselor-console__head">
        <BrandLogo />
        <div className="counselor-console__head-actions">
          <span className="counselor-console__demo">{t("crm.console.demoBadge")}</span>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            {t("crm.console.back")}
          </button>
        </div>
      </header>

      <div className="counselor-console__layout">
        <aside className="counselor-console__list">
          <div className="counselor-console__list-head">
            <h1>{t("crm.console.title")}</h1>
            <p>{t("crm.console.lead")}</p>
            {followUpCount > 0 ? (
              <p className="counselor-console__follow-summary">{t("crm.console.followCount", { n: followUpCount })}</p>
            ) : null}
          </div>
          {engagements.length === 0 ? (
            <p className="counselor-console__empty">{t("crm.console.noStudents")}</p>
          ) : (
            <ul>
              {engagements.map((engagement) => (
                <li key={engagement.id}>
                  <button
                    type="button"
                    className={`counselor-console__student${selectedId === engagement.id ? " is-active" : ""}${
                      engagement.needsFollowUp ? " needs-follow-up" : ""
                    }`}
                    onClick={() => setSelectedId(engagement.id)}
                  >
                    <strong>{engagement.studentName || engagement.studentEmail}</strong>
                    <span>{engagement.applicationTitle}</span>
                    <span>{t(`crm.phase.${engagement.phase}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="counselor-console__case">
          {!selected || !counselor ? (
            <div className="counselor-console__empty-case">{t("crm.console.pickStudent")}</div>
          ) : (
            <>
              <div className="counselor-console__case-head">
                <div>
                  <p className="counselor-console__case-kicker">{t("crm.console.caseKicker")}</p>
                  <h2>{selected.studentName || selected.studentEmail}</h2>
                  <p>
                    {selected.applicationTitle} · {selected.studentEmail}
                  </p>
                </div>
                <label className="counselor-console__phase">
                  <span>{t("crm.console.phase")}</span>
                  <strong>{t(`crm.phase.${selected.phase}`)}</strong>
                </label>
              </div>

              <nav className="signed-service-hub__nav counselor-console__tabs" aria-label={t("crm.console.navAria")}>
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

              <div className="counselor-console__tab-main">
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
                              <p>{pin.body}</p>
                              <span className="signed-service-hub__muted">
                                {formatWhen(pin.createdAt, locale)} · {pin.authorLabel}
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
                        {tasks.length === 0 ? (
                          <p className="signed-service-hub__muted">{t("crm.noTasks")}</p>
                        ) : (
                          <ul className="counselor-console__task-list">
                            {tasks.slice(0, 3).map((task) => (
                              <li key={task.id} className={task.status === "done" ? "is-done" : ""}>
                                <strong>{task.title}</strong>
                                <span>
                                  {task.status === "done" ? t("crm.taskDone") : t("crm.console.taskOpen")}
                                  {task.dueAt ? ` · ${task.dueAt}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button type="button" className="signed-service-hub__link" onClick={() => setTab("todos")}>
                          {t("crm.signedService.viewAllTodos")}
                        </button>
                      </div>
                      <div>
                        <h2>{t("crm.signedService.nextMeeting")}</h2>
                        <p>{selected.nextMeetingLabel || t("crm.signedService.noMeetingScheduled")}</p>
                        <button type="button" className="btn btn-primary" onClick={() => setTab("meetings")}>
                          {t("crm.console.manageMeeting")}
                        </button>
                      </div>
                    </section>
                  </div>
                )}

                {tab === "todos" && (
                  <section className="signed-service-hub__panel">
                    <h2>{t("crm.console.studentTasks")}</h2>
                    <ul className="counselor-console__task-list">
                      {tasks.map((task) => (
                        <li key={task.id} className={task.status === "done" ? "is-done" : ""}>
                          <label className="counselor-console__task-check">
                            <input
                              type="checkbox"
                              checked={task.status === "done"}
                              onChange={(e) => {
                                setTaskDone(task.id, e.target.checked);
                                notifyCrmStoreChange();
                                refresh();
                              }}
                            />
                            <strong>{task.title}</strong>
                            {task.description ? <p className="counselor-console__task-detail">{task.description}</p> : null}
                          </label>
                          <span>
                            {task.status === "done" ? t("crm.taskDone") : t("crm.console.taskOpen")}
                            {task.dueAt ? ` · ${t("crm.due", { date: task.dueAt })}` : ""}
                            {task.linkType !== "none" ? ` · ${t(`crm.taskLink.${task.linkType}`)}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="counselor-console__inline-form">
                      <h3>{t("crm.console.btnTask")}</h3>
                      <label>
                        <span>{t("crm.console.taskTitle")}</span>
                        <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                      </label>
                      <label>
                        <span>{t("crm.console.taskDetail")}</span>
                        <textarea
                          value={taskDetail}
                          onChange={(e) => setTaskDetail(e.target.value)}
                          placeholder={t("crm.console.taskDetailPlaceholder")}
                          rows={3}
                        />
                      </label>
                      <label>
                        <span>{t("crm.dueLabel")}</span>
                        <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                      </label>
                      <label>
                        <span>{t("crm.console.taskLink")}</span>
                        <select value={taskLink} onChange={(e) => setTaskLink(e.target.value as CrmTaskLinkType)}>
                          <option value="none">{t("crm.taskLink.none")}</option>
                          <option value="profile">{t("crm.taskLink.profile")}</option>
                          <option value="activities">{t("crm.taskLink.activities")}</option>
                          <option value="essay">{t("crm.taskLink.essay")}</option>
                          <option value="report">{t("crm.taskLink.report")}</option>
                        </select>
                      </label>
                      <button type="button" className="btn btn-primary" onClick={submitTask} disabled={!taskTitle.trim()}>
                        {t("crm.console.assignTask")}
                      </button>
                    </div>
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
                              <td>{doc.name}</td>
                              <td>{doc.docType}</td>
                              <td>
                                <select
                                  className={`counselor-console__status-select counselor-console__status-select--${doc.status}`}
                                  value={doc.status}
                                  onChange={(e) => {
                                    updateDocumentStatus(doc.id, e.target.value as CrmApplicationDocument["status"]);
                                    notifyCrmStoreChange();
                                    refresh();
                                  }}
                                >
                                  {(["needed", "draft", "submitted", "done"] as const).map((status) => (
                                    <option key={status} value={status}>
                                      {docStatusLabel(status)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>{doc.dueAt || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="counselor-console__inline-form">
                      <h3>{t("crm.console.addDocument")}</h3>
                      <label>
                        <span>{t("crm.signedService.colName")}</span>
                        <input value={docNameDraft} onChange={(e) => setDocNameDraft(e.target.value)} />
                      </label>
                      <label>
                        <span>{t("crm.signedService.colType")}</span>
                        <input value={docTypeDraft} onChange={(e) => setDocTypeDraft(e.target.value)} />
                      </label>
                      <label>
                        <span>{t("crm.signedService.colDue")}</span>
                        <input type="date" value={docDueDraft} onChange={(e) => setDocDueDraft(e.target.value)} />
                      </label>
                      <button type="button" className="btn btn-primary" onClick={submitDocument} disabled={!docNameDraft.trim()}>
                        {t("crm.console.addDocument")}
                      </button>
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
                              {formatWhen(message.createdAt, locale)} · {message.authorLabel}
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
                          <p>{message.body}</p>
                        </li>
                      ))}
                    </ul>
                    <div className="signed-service-hub__compose">
                      <textarea
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        placeholder={t("crm.console.messagePlaceholder")}
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
                        <strong>{counselor.name}</strong> · {counselor.title}
                      </p>
                      {selected.nextMeetingLabel ? (
                        <p>{t("crm.nextMeeting", { when: selected.nextMeetingLabel })}</p>
                      ) : null}
                      <button type="button" className="btn btn-primary" onClick={openMeeting}>
                        {isCalendlyBookingEnabled(counselor.calendlyUrl)
                          ? t("crm.console.sendCalendly")
                          : t("crm.console.noCalendly")}
                      </button>
                    </div>
                    <div className="counselor-console__inline-form">
                      <label>
                        <span>{t("crm.console.meetingLabel")}</span>
                        <input
                          value={meetingLabelDraft}
                          onChange={(e) => setMeetingLabelDraft(e.target.value)}
                          placeholder={t("crm.console.meetingLabelPlaceholder")}
                        />
                      </label>
                      <button type="button" className="btn btn-secondary" onClick={saveMeetingLabel}>
                        {t("crm.console.saveMeeting")}
                      </button>
                    </div>
                  </section>
                )}

                {tab === "files" && selected ? (
                  <section className="signed-service-hub__panel">
                    <h2>{t("crm.signedService.filesTitle")}</h2>
                    <CaseFilesPanel
                      engagementId={selected.id}
                      uploadedByRole="counselor"
                      files={files}
                      defaultCategory="counselor"
                      onChange={() => {
                        notifyCrmStoreChange();
                        refresh();
                      }}
                    />
                  </section>
                ) : null}

                {tab === "student" && (
                  <section className="signed-service-hub__panel">
                    <h2>{t("crm.signedService.studentTitle")}</h2>
                    <p className="signed-service-hub__muted">{t("crm.console.studentLead")}</p>
                    {studentFormLoading ? (
                      <p className="signed-service-hub__muted">{t("crm.signedService.studentLoading")}</p>
                    ) : studentRows.length > 0 ? (
                      <dl className="signed-service-hub__info">
                        {studentRows.map((row) => (
                          <div key={row.label}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="signed-service-hub__muted">{t("crm.console.studentProfileMissing")}</p>
                    )}
                    <div className="counselor-console__student-actions">
                      <button type="button" className="btn btn-primary" onClick={() => onOpenStudentReport?.(selected)}>
                        {t("crm.console.btnReport")}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-secondary${selected.needsFollowUp ? " is-flagged" : ""}`}
                        onClick={handleFollowUp}
                      >
                        {selected.needsFollowUp ? t("crm.console.btnFollowClear") : t("crm.console.btnFollow")}
                      </button>
                    </div>
                    <label className="counselor-console__notes">
                      <span>{t("crm.console.internalNotes")}</span>
                      <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={4} />
                      <button type="button" className="btn btn-secondary" onClick={saveNotes}>
                        {t("crm.console.saveNotes")}
                      </button>
                    </label>
                  </section>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
