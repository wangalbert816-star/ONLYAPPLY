import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { normalizeMeetingUrl } from "../../lib/crm/meetingBooking";
import { buildApplicationInfoRows } from "../../lib/applicationInfoRows";
import { fetchApplicationFormById } from "../../lib/supabase/accounts";
import {
  addDocument,
  addMeetingRecap,
  addMessage,
  assignTask,
  deleteMeetingRecap,
  deleteTask,
  getActingCounselorForEngagement,
  getEngagementById,
  shareMeetingLinkWithStudent,
  updateOwnCounselorMeetingUrl,
  listDocuments,
  listEngagements,
  listFiles,
  listLibraryItems,
  listMeetingRecaps,
  listMessages,
  listPinnedMessages,
  listTasks,
  notifyCrmStoreChange,
  refreshCrmCache,
  returnTaskSubmission,
  setTaskDone,
  subscribeCrmStore,
  toggleFollowUp,
  toggleMessagePin,
  updateDocumentStatus,
  updateInternalNotes,
  updateNextMeetingLabel,
  updateTask,
} from "../../lib/crm/store";
import type { CrmApplicationDocument, CrmEngagement, CrmMessageChannel, CrmTaskItemKind, CrmTaskLinkType } from "../../lib/crm/types";
import type { CrmMeetingRecapDraft } from "../../lib/crm/meetingRecapFormat";
import type { FormState } from "../../types";
import { BrandLogo } from "../BrandLogo";
import { ResumeBuilder } from "../resume/ResumeBuilder";
import { CaseFilesPanel } from "./CaseFilesPanel";
import { CounselorDocumentLibrary } from "./CounselorDocumentLibrary";
import { LibraryItemPicker } from "./LibraryItemPicker";
import { CounselorTaskSubmissionsOverview } from "./CounselorTaskSubmissionsOverview";
import { CounselorTaskCard } from "./CounselorTaskCard";
import { MeetingsTabPanel } from "./MeetingsTabPanel";
import "./CaseFilesPanel.css";
import "./crmTaskTypes.css";
import "./CounselorConsole.css";
import "./SignedServiceHub.css";

type Props = {
  onBack: () => void;
  onOpenStudentReport?: (engagement: CrmEngagement) => void;
};

type TabId = "home" | "todos" | "documents" | "chat" | "meetings" | "files" | "resume" | "student";

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
  const [taskItemKind, setTaskItemKind] = useState<CrmTaskItemKind>("action");
  const [taskLibraryIds, setTaskLibraryIds] = useState<string[]>([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDetail, setEditTaskDetail] = useState("");
  const [editTaskDue, setEditTaskDue] = useState("");
  const [editTaskLink, setEditTaskLink] = useState<CrmTaskLinkType>("none");
  const [editTaskItemKind, setEditTaskItemKind] = useState<CrmTaskItemKind>("action");
  const [taskActionBusy, setTaskActionBusy] = useState(false);
  const [docNameDraft, setDocNameDraft] = useState("");
  const [docTypeDraft, setDocTypeDraft] = useState("essay");
  const [docDueDraft, setDocDueDraft] = useState("");
  const [meetingLabelDraft, setMeetingLabelDraft] = useState("");
  const [recapBusy, setRecapBusy] = useState(false);
  const [meetingUrlSaveBusy, setMeetingUrlSaveBusy] = useState(false);
  const [meetingUrlDraft, setMeetingUrlDraft] = useState("");
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

  useEffect(() => {
    if (!selectedId) return;
    if (tab !== "todos" && tab !== "files" && tab !== "home") return;
    void refreshCrmCache().then(() => refresh());
  }, [selectedId, tab, refresh]);

  const selected = selectedId ? getEngagementById(selectedId) : null;
  const counselor = selected ? getActingCounselorForEngagement(selected) : null;
  const resolvedMeetingUrl = normalizeMeetingUrl(meetingUrlDraft || counselor?.meetingUrl);
  const canShareMeetingLink = Boolean(resolvedMeetingUrl);

  const tasks = useMemo(() => (selected ? listTasks(selected.id) : []), [selected?.id, tick]);
  const documents = useMemo(() => (selected ? listDocuments(selected.id) : []), [selected?.id, tick]);
  const files = useMemo(() => (selected ? listFiles(selected.id) : []), [selected?.id, tick]);
  const pins = useMemo(() => (selected ? listPinnedMessages(selected.id) : []), [selected?.id, tick]);
  const meetingRecaps = useMemo(
    () => (selected ? listMeetingRecaps(selected.id) : []),
    [selected?.id, tick],
  );
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
    if (!counselor) return;
    setMeetingUrlDraft(counselor.meetingUrl ?? "");
  }, [counselor?.id, counselor?.meetingUrl]);

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
    { id: "resume", label: t("crm.signedService.tabs.resume") },
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
    attachmentNames: string[],
  ) => {
    const lines = [t("crm.console.taskAssigned", { title })];
    if (detail) lines.push(detail);
    if (dueAt) lines.push(t("crm.console.taskAssignedDue", { date: dueAt }));
    if (linkType !== "none") {
      lines.push(t("crm.console.taskAssignedLink", { link: t(`crm.taskLink.${linkType}`) }));
    }
    if (attachmentNames.length) {
      lines.push(t("crm.console.taskAssignedFiles", { files: attachmentNames.join(", ") }));
    }
    return lines.join("\n\n");
  };

  const submitTask = async () => {
    if (!selected || !counselor || taskSubmitting) return;
    const title = taskTitle.trim();
    if (!title) return;
    const detail = taskDetail.trim();
    setTaskSubmitting(true);
    try {
      let attachmentNames: string[] = [];
      if (taskLibraryIds.length) {
        const libraryItems = await listLibraryItems();
        attachmentNames = libraryItems.filter((item) => taskLibraryIds.includes(item.id)).map((item) => item.title);
      }
      await assignTask({
        engagementId: selected.id,
        title,
        description: detail || undefined,
        dueAt: taskItemKind === "resource" ? undefined : taskDue || undefined,
        linkType: taskLink,
        itemKind: taskItemKind,
        libraryItemIds: taskLibraryIds.length ? taskLibraryIds : undefined,
        message: {
          authorLabel: counselor.name,
          body: buildTaskAssignedMessage(title, detail, taskDue, taskLink, attachmentNames),
        },
      });
      setTaskTitle("");
      setTaskDetail("");
      setTaskDue("");
      setTaskLink("none");
      setTaskItemKind("action");
      setTaskLibraryIds([]);
      notifyCrmStoreChange();
      refresh();
    } finally {
      setTaskSubmitting(false);
    }
  };

  const startEditTask = (task: (typeof tasks)[number]) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDetail(task.description ?? "");
    setEditTaskDue(task.dueAt ?? "");
    setEditTaskLink(task.linkType);
    setEditTaskItemKind(task.itemKind === "resource" ? "resource" : "action");
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskTitle("");
    setEditTaskDetail("");
    setEditTaskDue("");
    setEditTaskLink("none");
    setEditTaskItemKind("action");
  };

  const saveEditTask = async () => {
    if (!editingTaskId || taskActionBusy) return;
    const title = editTaskTitle.trim();
    if (!title) return;
    setTaskActionBusy(true);
    try {
      await updateTask(editingTaskId, {
        title,
        description: editTaskDetail.trim(),
        dueAt: editTaskItemKind === "resource" ? null : editTaskDue || null,
        linkType: editTaskLink,
        itemKind: editTaskItemKind,
      });
      cancelEditTask();
      notifyCrmStoreChange();
      refresh();
    } finally {
      setTaskActionBusy(false);
    }
  };

  const removeTask = async (taskId: string) => {
    if (taskActionBusy) return;
    if (!window.confirm(t("crm.console.deleteTaskConfirm"))) return;
    setTaskActionBusy(true);
    try {
      await deleteTask(taskId);
      if (editingTaskId === taskId) cancelEditTask();
      notifyCrmStoreChange();
      refresh();
    } finally {
      setTaskActionBusy(false);
    }
  };

  const handleReturnTask = async (taskId: string, note: string) => {
    if (taskActionBusy) return;
    setTaskActionBusy(true);
    try {
      await returnTaskSubmission(taskId, note);
      notifyCrmStoreChange();
      refresh();
    } finally {
      setTaskActionBusy(false);
    }
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

  const shareMeetingLink = () => {
    if (!selected || !counselor) return;
    const url = normalizeMeetingUrl(meetingUrlDraft || counselor.meetingUrl);
    if (!url) {
      window.alert(t("crm.console.noMeetingUrl"));
      return;
    }
    shareMeetingLinkWithStudent(selected.id, url);
    addMessage({
      engagementId: selected.id,
      authorRole: "counselor",
      authorLabel: counselor.name,
      body: t("crm.console.meetingLinkBody", { url }),
      readByStudent: false,
    });
    notifyCrmStoreChange();
    refresh();
  };

  const saveMeetingUrl = () => {
    setMeetingUrlSaveBusy(true);
    void updateOwnCounselorMeetingUrl(meetingUrlDraft, selected?.id)
      .then(() => {
        notifyCrmStoreChange();
        refresh();
      })
      .catch(() => window.alert(t("crm.console.saveMeetingUrlFailed")))
      .finally(() => setMeetingUrlSaveBusy(false));
  };

  const saveMeetingLabel = () => {
    if (!selected) return;
    updateNextMeetingLabel(selected.id, meetingLabelDraft);
    notifyCrmStoreChange();
    refresh();
  };

  const addRecap = async (input: CrmMeetingRecapDraft) => {
    if (!selected) return;
    setRecapBusy(true);
    try {
      await addMeetingRecap({ engagementId: selected.id, ...input });
      notifyCrmStoreChange();
      refresh();
    } finally {
      setRecapBusy(false);
    }
  };

  const removeRecap = async (recapId: string) => {
    setRecapBusy(true);
    try {
      await deleteMeetingRecap(recapId);
      notifyCrmStoreChange();
      refresh();
    } finally {
      setRecapBusy(false);
    }
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
                              <li key={task.id} className="counselor-console__task-list-item">
                                <CounselorTaskCard
                                  task={task}
                                  files={files}
                                  compact
                                  onToggleDone={(done) => {
                                    setTaskDone(task.id, done);
                                    notifyCrmStoreChange();
                                    refresh();
                                  }}
                                  onEdit={() => setTab("todos")}
                                  onDelete={() => void removeTask(task.id)}
                                />
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
                        <li key={task.id} className="counselor-console__task-list-item">
                          {editingTaskId === task.id ? (
                            <div className="counselor-console__task-edit">
                              <label>
                                <span>{t("crm.console.taskTitle")}</span>
                                <input
                                  value={editTaskTitle}
                                  onChange={(e) => setEditTaskTitle(e.target.value)}
                                  disabled={taskActionBusy}
                                />
                              </label>
                              <label>
                                <span>{t("crm.console.taskDetail")}</span>
                                <textarea
                                  value={editTaskDetail}
                                  onChange={(e) => setEditTaskDetail(e.target.value)}
                                  rows={3}
                                  disabled={taskActionBusy}
                                />
                              </label>
                              <label>
                                <span>{t("crm.taskItemKind.label")}</span>
                                <select
                                  value={editTaskItemKind}
                                  onChange={(e) => setEditTaskItemKind(e.target.value as CrmTaskItemKind)}
                                  disabled={taskActionBusy}
                                >
                                  <option value="action">{t("crm.taskItemKind.action")}</option>
                                  <option value="resource">{t("crm.taskItemKind.resource")}</option>
                                </select>
                              </label>
                              {editTaskItemKind === "action" ? (
                              <>
                              <label>
                                <span>{t("crm.dueLabel")}</span>
                                <input
                                  type="date"
                                  value={editTaskDue}
                                  onChange={(e) => setEditTaskDue(e.target.value)}
                                  disabled={taskActionBusy}
                                />
                              </label>
                              <label>
                                <span>{t("crm.console.taskLink")}</span>
                                <select
                                  value={editTaskLink}
                                  onChange={(e) => setEditTaskLink(e.target.value as CrmTaskLinkType)}
                                  disabled={taskActionBusy}
                                >
                                  <option value="none">{t("crm.taskLink.none")}</option>
                                  <option value="profile">{t("crm.taskLink.profile")}</option>
                                  <option value="activities">{t("crm.taskLink.activities")}</option>
                                  <option value="essay">{t("crm.taskLink.essay")}</option>
                                  <option value="report">{t("crm.taskLink.report")}</option>
                                </select>
                              </label>
                              </>
                              ) : (
                                <p className="counselor-console__field-hint">{t("crm.taskItemKind.resourceHint")}</p>
                              )}
                              <div className="counselor-console__task-actions">
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={taskActionBusy || !editTaskTitle.trim()}
                                  onClick={() => void saveEditTask()}
                                >
                                  {taskActionBusy ? t("crm.console.savingTask") : t("crm.console.saveTask")}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  disabled={taskActionBusy}
                                  onClick={cancelEditTask}
                                >
                                  {t("crm.console.cancel")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <CounselorTaskCard
                              task={task}
                              files={files}
                              busy={taskActionBusy}
                              onToggleDone={(done) => {
                                setTaskDone(task.id, done);
                                notifyCrmStoreChange();
                                refresh();
                              }}
                              onEdit={() => startEditTask(task)}
                              onDelete={() => void removeTask(task.id)}
                              onReturn={(note) => handleReturnTask(task.id, note)}
                            />
                          )}
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
                        <span>{t("crm.taskItemKind.label")}</span>
                        <select
                          value={taskItemKind}
                          onChange={(e) => setTaskItemKind(e.target.value as CrmTaskItemKind)}
                          disabled={taskSubmitting}
                        >
                          <option value="action">{t("crm.taskItemKind.action")}</option>
                          <option value="resource">{t("crm.taskItemKind.resource")}</option>
                        </select>
                      </label>
                      {taskItemKind === "action" ? (
                      <>
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
                      </>
                      ) : (
                        <p className="counselor-console__field-hint">{t("crm.taskItemKind.resourceHint")}</p>
                      )}
                      <LibraryItemPicker
                        mode="select"
                        showHeading
                        selectedIds={taskLibraryIds}
                        onSelectionChange={setTaskLibraryIds}
                        disabled={taskSubmitting}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void submitTask()}
                        disabled={!taskTitle.trim() || taskSubmitting}
                      >
                        {taskSubmitting ? t("crm.console.assigningTask") : t("crm.console.assignTask")}
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

                {tab === "meetings" && selected && counselor ? (
                  <section className="signed-service-hub__panel">
                    <h2>{t("crm.signedService.meetingsTitle")}</h2>
                    <p className="signed-service-hub__muted">{t("crm.signedService.meetingsLead")}</p>
                    <MeetingsTabPanel
                      engagement={selected}
                      counselor={counselor}
                      recaps={meetingRecaps}
                      studentDisplayName={selected.studentName || selected.studentEmail.split("@")[0]}
                      canEditRecaps
                      recapBusy={recapBusy}
                      onShareMeetingLink={shareMeetingLink}
                      canShareMeetingLink={canShareMeetingLink}
                      onOpenActionItems={() => setTab("todos")}
                      onAddRecap={addRecap}
                      onDeleteRecap={removeRecap}
                      meetingLabelDraft={meetingLabelDraft}
                      onMeetingLabelDraftChange={setMeetingLabelDraft}
                      onSaveMeetingLabel={saveMeetingLabel}
                      showMeetingLabelEditor
                      showMeetingUrlEditor
                      meetingUrlDraft={meetingUrlDraft}
                      onMeetingUrlDraftChange={setMeetingUrlDraft}
                      onSaveMeetingUrl={saveMeetingUrl}
                      meetingUrlSaveBusy={meetingUrlSaveBusy}
                    />
                  </section>
                ) : null}

                {tab === "files" && selected ? (
                  <section className="signed-service-hub__panel">
                    <h2>{t("crm.signedService.filesTitle")}</h2>
                    <CounselorTaskSubmissionsOverview tasks={tasks} files={files} />
                    <CounselorDocumentLibrary
                      engagementId={selected.id}
                      onAttached={() => {
                        notifyCrmStoreChange();
                        refresh();
                      }}
                    />
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

                {tab === "resume" && selected ? (
                  <section className="signed-service-hub__panel signed-service-hub__panel--resume">
                    {studentFormLoading ? (
                      <p className="signed-service-hub__muted">{t("crm.signedService.studentLoading")}</p>
                    ) : (
                      <ResumeBuilder
                        form={
                          studentForm ?? {
                            intakeTerm: "",
                            intakeOtherDetail: "",
                            applicantIdentity: "",
                            citizenship: "",
                            residenceRegion: "",
                            budget: "",
                            testing: "",
                            satScore: "",
                            actScore: "",
                            highSchoolSystem: "",
                            currentHighSchool: "",
                            gpa: "",
                            gpaTrend: "",
                            languageScores: "",
                            academicSpecialFlags: [],
                            academicSpecialNotes: "",
                            majorPrimary: "",
                            majorSecondary: "",
                            schoolSize: "",
                            campusCulturePref: "",
                            geoPrefs: [],
                            activities: "",
                            structuredActivities: [],
                            riskStyle: "",
                            dealbreakers: "",
                          }
                        }
                        userEmail={selected.studentEmail}
                        displayName={selected.studentName}
                        engagementId={selected.id}
                        editorRole="counselor"
                      />
                    )}
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
