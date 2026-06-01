import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { isTaskSubmissionReturned, resolveTaskSubmissions } from "../../lib/crm/taskSubmissions";
import type { CrmStoredFile, CrmTask } from "../../lib/crm/types";
import { TaskAttachmentLinks } from "./TaskAttachmentLinks";
import { TaskReturnControls } from "./TaskReturnControls";
import { TaskTypeBadge, taskItemClass } from "./TaskTypeBadge";
import "./CounselorTaskCard.css";

type Props = {
  task: CrmTask;
  files: CrmStoredFile[];
  busy?: boolean;
  compact?: boolean;
  onToggleDone: (done: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReturn?: (note: string) => void | Promise<void>;
};

export function CounselorTaskCard({
  task,
  files,
  busy = false,
  compact = false,
  onToggleDone,
  onEdit,
  onDelete,
  onReturn,
}: Props) {
  const { t, locale } = useLanguage();
  const submissions = resolveTaskSubmissions(task, files);
  const returned = isTaskSubmissionReturned(task);
  const hasMaterials = Boolean(task.attachedFileIds?.length);
  const statusLabel = task.status === "done" ? t("crm.taskDone") : t("crm.console.taskOpen");

  return (
    <article
      className={`counselor-task-card ${taskItemClass(task.linkType, task.status === "done")}${compact ? " counselor-task-card--compact" : ""}`}
    >
      <header className="counselor-task-card__header">
        <label className="counselor-task-card__check">
          <input
            type="checkbox"
            checked={task.status === "done"}
            disabled={busy}
            onChange={(e) => onToggleDone(e.target.checked)}
          />
          <span className="visually-hidden">{task.title}</span>
        </label>

        <div className="counselor-task-card__head-main">
          <h4 className="counselor-task-card__title">{localizeCrmText(task.title, locale, t)}</h4>
          <div className="counselor-task-card__meta">
            <TaskTypeBadge linkType={task.linkType} label={t(`crm.taskLink.${task.linkType}`)} />
            <span className={`counselor-task-card__status counselor-task-card__status--${task.status}`}>
              {statusLabel}
            </span>
            {task.dueAt ? <span className="counselor-task-card__due">{t("crm.due", { date: task.dueAt })}</span> : null}
            {returned ? (
              <span className="counselor-task-card__returned-pill">{t("crm.taskSubmit.returned")}</span>
            ) : submissions.length > 0 ? (
              <span className="counselor-task-card__turned-in-pill">{t("crm.taskSubmit.turnedIn")}</span>
            ) : null}
          </div>
        </div>

        {!compact ? (
          <div className="counselor-task-card__toolbar">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onEdit}>
              {t("crm.console.editTask")}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onDelete}>
              {t("crm.console.deleteTask")}
            </button>
          </div>
        ) : null}
      </header>

      {task.description && !compact ? (
        <p className="counselor-task-card__detail">{localizeCrmText(task.description, locale, t)}</p>
      ) : null}

      <div className={`counselor-task-card__grid${hasMaterials ? "" : " counselor-task-card__grid--single"}`}>
        {hasMaterials ? (
          <section className="counselor-task-card__section">
            <h5 className="counselor-task-card__section-title">{t("crm.taskSubmit.counselorMaterials")}</h5>
            <TaskAttachmentLinks
              fileIds={task.attachedFileIds}
              files={files}
              linkVariant="chip"
              className="counselor-task-card__chips"
            />
          </section>
        ) : null}

        <section className="counselor-task-card__section counselor-task-card__section--submission">
          <h5 className="counselor-task-card__section-title">{t("crm.taskSubmit.counselorStudentWork")}</h5>
          {submissions.length > 0 ? (
            <TaskAttachmentLinks
              fileIds={submissions.map((f) => f.id)}
              files={files}
              linkVariant="chip"
              className="counselor-task-card__chips"
            />
          ) : (
            <p className="counselor-task-card__empty">{t("crm.taskSubmit.counselorNoSubmission")}</p>
          )}
          {onReturn ? (
            <TaskReturnControls
              task={task}
              hasSubmission={submissions.length > 0}
              busy={busy}
              onReturn={onReturn}
            />
          ) : null}
        </section>
      </div>
    </article>
  );
}
