import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { isTaskResource } from "../../lib/crm/taskItemKind";
import { isTaskSubmissionReturned, resolveTaskSubmissions } from "../../lib/crm/taskSubmissions";
import type { CrmStoredFile, CrmTask, CrmTaskLinkType } from "../../lib/crm/types";
import { TaskAttachmentLinks } from "./TaskAttachmentLinks";
import { TaskSubmissionPanel } from "./TaskSubmissionPanel";
import "./crmTaskTypes.css";
import "./StudentTaskRow.css";

function dueTone(dueAt?: string): "overdue" | "upcoming" | "neutral" {
  if (!dueAt) return "neutral";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "neutral";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  const weekOut = new Date(today);
  weekOut.setDate(weekOut.getDate() + 14);
  if (due <= weekOut) return "upcoming";
  return "neutral";
}

function formatShortDate(value: string | undefined, locale: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const raw = value.slice(0, 10);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
  });
}

type Props = {
  task: CrmTask;
  files: CrmStoredFile[];
  engagementId?: string;
  allowSubmit?: boolean;
  categoryLabel: string;
  onToggleDone: (done: boolean) => void;
  onTaskNavigate?: (linkType: CrmTaskLinkType) => void;
  onSubmitted?: () => void;
};

export function StudentTaskRow({
  task,
  files,
  engagementId,
  allowSubmit = false,
  categoryLabel,
  onToggleDone,
  onTaskNavigate,
  onSubmitted,
}: Props) {
  const { t, locale } = useLanguage();
  const [submitOpen, setSubmitOpen] = useState(false);
  const isResource = isTaskResource(task);
  const submissions = resolveTaskSubmissions(task, files);
  const returned = isTaskSubmissionReturned(task);
  const hasMaterials = Boolean(task.attachedFileIds?.length);
  const isDone = !isResource && task.status === "done";
  const showSubmit = !isResource && allowSubmit && engagementId && task.status === "open";
  const showNav = !isResource && task.linkType !== "none" && task.status === "open" && onTaskNavigate;
  const dueVariant = dueTone(task.dueAt);

  const duePill =
    !isDone && !isResource && task.dueAt
      ? t("crm.taskBoard.dueShort", { date: formatShortDate(task.dueAt, locale) })
      : null;

  const submittedPill =
    isDone && task.completedAt
      ? t("crm.taskBoard.submittedShort", { date: formatShortDate(task.completedAt, locale) })
      : null;

  const showMeta =
    Boolean(task.description?.trim()) ||
    hasMaterials ||
    (submissions.length > 0 && !submitOpen && !isDone) ||
    (returned && task.returnNote);

  return (
    <li className={`task-row${isDone ? " task-row--done" : ""}${isResource ? " task-row--resource" : ""}`}>
      <div className="task-row__line">
        {!isResource ? (
          <label className="task-row__check">
            <input
              type="checkbox"
              checked={task.status === "done"}
              onChange={(e) => onToggleDone(e.target.checked)}
            />
            <span className="visually-hidden">{localizeCrmText(task.title, locale, t)}</span>
          </label>
        ) : (
          <span className="crm-task-resource-mark task-row__mark" aria-hidden />
        )}

        <div className="task-row__body">
          <div className="task-row__title-row">
            {showNav ? (
              <button type="button" className="task-row__title task-row__title--link" onClick={() => onTaskNavigate(task.linkType)}>
                {localizeCrmText(task.title, locale, t)}
              </button>
            ) : (
              <span className="task-row__title">{localizeCrmText(task.title, locale, t)}</span>
            )}
            {showSubmit && !submitOpen ? (
              <button type="button" className="task-row__go task-row__go--muted" onClick={() => setSubmitOpen(true)}>
                {returned || submissions.length > 0 ? t("crm.taskSubmit.addMore") : t("crm.taskSubmit.turnIn")}
              </button>
            ) : null}
          </div>
          <div className="task-row__sub">
            <span className="task-row__category">{categoryLabel}</span>
            {returned && !isDone ? (
              <span className="task-row__pill task-row__pill--returned">{t("crm.taskSubmit.returned")}</span>
            ) : null}
            {!isDone && submissions.length > 0 ? (
              <span className="task-row__pill task-row__pill--turned-in">{t("crm.taskSubmit.turnedIn")}</span>
            ) : null}
            {duePill ? (
              <span className={`task-row__pill task-row__pill--due-${dueVariant}`}>{duePill}</span>
            ) : null}
            {submittedPill ? (
              <span className="task-row__pill task-row__pill--submitted">{submittedPill}</span>
            ) : null}
          </div>
        </div>
      </div>

      {showMeta ? (
        <div className="task-row__meta">
          {task.description ? (
            <p className="task-row__detail">{localizeCrmText(task.description, locale, t)}</p>
          ) : null}
          {returned && task.returnNote ? (
            <p className="task-row__return-note">{task.returnNote}</p>
          ) : null}
          <div className="task-row__links">
            {hasMaterials ? (
              <TaskAttachmentLinks
                fileIds={task.attachedFileIds}
                files={files}
                linkVariant="link"
                className="task-row__attachments"
              />
            ) : null}
            {submissions.length > 0 && !isDone ? (
              <TaskAttachmentLinks
                fileIds={submissions.map((f) => f.id)}
                files={files}
                linkVariant="link"
                className="task-row__attachments"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {showSubmit && submitOpen && engagementId ? (
        <div className="task-row__submit">
          <TaskSubmissionPanel
            embedded
            listInline
            defaultOpen
            taskId={task.id}
            engagementId={engagementId}
            submissions={submissions}
            taskDone={task.status === "done"}
            returned={returned}
            onSubmitted={() => {
              setSubmitOpen(false);
              onSubmitted?.();
            }}
            onDismiss={() => setSubmitOpen(false)}
          />
        </div>
      ) : null}
    </li>
  );
}
