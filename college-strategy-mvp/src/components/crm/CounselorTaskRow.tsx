import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { isTaskResource } from "../../lib/crm/taskItemKind";
import { isTaskSubmissionReturned, resolveTaskSubmissions } from "../../lib/crm/taskSubmissions";
import type { CrmStoredFile, CrmTask } from "../../lib/crm/types";
import { TaskAttachmentLinks } from "./TaskAttachmentLinks";
import { TaskReturnControls } from "./TaskReturnControls";
import "./crmTaskTypes.css";
import "./StudentTaskRow.css";
import "./CounselorTaskRow.css";

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
  categoryLabel: string;
  busy?: boolean;
  onToggleDone: (done: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReturn?: (note: string) => void | Promise<void>;
};

export function CounselorTaskRow({
  task,
  files,
  categoryLabel,
  busy = false,
  onToggleDone,
  onEdit,
  onDelete,
  onReturn,
}: Props) {
  const { t, locale } = useLanguage();
  const isResource = isTaskResource(task);
  const submissions = resolveTaskSubmissions(task, files);
  const returned = isTaskSubmissionReturned(task);
  const hasMaterials = Boolean(task.attachedFileIds?.length);
  const isDone = !isResource && task.status === "done";
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
    submissions.length > 0 ||
    Boolean(returned && task.returnNote) ||
    (!isResource && onReturn);

  return (
    <li className={`task-row${isDone ? " task-row--done" : ""}${isResource ? " task-row--resource" : ""}`}>
      <div className="task-row__line">
        {!isResource ? (
          <label className="task-row__check">
            <input
              type="checkbox"
              checked={task.status === "done"}
              disabled={busy}
              onChange={(e) => onToggleDone(e.target.checked)}
            />
            <span className="visually-hidden">{localizeCrmText(task.title, locale, t)}</span>
          </label>
        ) : (
          <span className="crm-task-resource-mark task-row__mark" aria-hidden />
        )}

        <div className="task-row__body">
          <div className="task-row__title-row">
            <span className="task-row__title">{localizeCrmText(task.title, locale, t)}</span>
            <div className="counselor-task-row__actions">
              <button type="button" className="counselor-task-row__action" disabled={busy} onClick={onEdit}>
                {t("crm.console.editTask")}
              </button>
              <button type="button" className="counselor-task-row__action counselor-task-row__action--danger" disabled={busy} onClick={onDelete}>
                {t("crm.console.deleteTask")}
              </button>
            </div>
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
          {hasMaterials ? (
            <div className="task-row__links">
              <p className="counselor-task-row__meta-label">
                {isResource ? t("crm.taskItemKind.resourceFiles") : t("crm.taskSubmit.counselorMaterials")}
              </p>
              <TaskAttachmentLinks
                fileIds={task.attachedFileIds}
                files={files}
                linkVariant="link"
                className="task-row__attachments"
              />
            </div>
          ) : null}
          {!isResource ? (
            <div className="task-row__links">
              <p className="counselor-task-row__meta-label">{t("crm.taskSubmit.counselorStudentWork")}</p>
              {submissions.length > 0 ? (
                <TaskAttachmentLinks
                  fileIds={submissions.map((file) => file.id)}
                  files={files}
                  linkVariant="link"
                  className="task-row__attachments"
                />
              ) : (
                <p className="task-row__detail">{t("crm.taskSubmit.counselorNoSubmission")}</p>
              )}
              {onReturn ? (
                <TaskReturnControls task={task} hasSubmission={submissions.length > 0} busy={busy} onReturn={onReturn} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
