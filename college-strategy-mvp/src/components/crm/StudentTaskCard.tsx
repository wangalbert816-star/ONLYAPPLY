import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { isTaskSubmissionReturned, resolveTaskSubmissions } from "../../lib/crm/taskSubmissions";
import type { CrmStoredFile, CrmTask, CrmTaskLinkType } from "../../lib/crm/types";
import { TaskAttachmentLinks } from "./TaskAttachmentLinks";
import { TaskSubmissionPanel } from "./TaskSubmissionPanel";
import { TaskTypeBadge, taskItemClass } from "./TaskTypeBadge";
import "./StudentTaskCard.css";

type Props = {
  task: CrmTask;
  files: CrmStoredFile[];
  engagementId?: string;
  allowSubmit?: boolean;
  linkLabel: string;
  onToggleDone: (done: boolean) => void;
  onTaskNavigate: (linkType: CrmTaskLinkType) => void;
  onSubmitted?: () => void;
};

export function StudentTaskCard({
  task,
  files,
  engagementId,
  allowSubmit = false,
  linkLabel,
  onToggleDone,
  onTaskNavigate,
  onSubmitted,
}: Props) {
  const { t, locale } = useLanguage();
  const submissions = resolveTaskSubmissions(task, files);
  const returned = isTaskSubmissionReturned(task);
  const hasMaterials = Boolean(task.attachedFileIds?.length);
  const showSubmissionSection = Boolean((allowSubmit && engagementId) || submissions.length > 0);
  const statusLabel = task.status === "done" ? t("crm.taskDone") : t("crm.console.taskOpen");
  const showNav = task.linkType !== "none" && task.status === "open";

  return (
    <article className={`student-task-card ${taskItemClass(task.linkType, task.status === "done")}`}>
      <header className="student-task-card__header">
        <label className="student-task-card__check">
          <input
            type="checkbox"
            checked={task.status === "done"}
            onChange={(e) => onToggleDone(e.target.checked)}
          />
          <span className="visually-hidden">{localizeCrmText(task.title, locale, t)}</span>
        </label>

        <div className="student-task-card__head-main">
          <h4 className="student-task-card__title">{localizeCrmText(task.title, locale, t)}</h4>
          <div className="student-task-card__meta">
            <TaskTypeBadge linkType={task.linkType} label={linkLabel} />
            <span className={`student-task-card__status student-task-card__status--${task.status}`}>
              {statusLabel}
            </span>
            {task.dueAt ? <span className="student-task-card__due">{t("crm.due", { date: task.dueAt })}</span> : null}
            {returned ? (
              <span className="student-task-card__returned-pill">{t("crm.taskSubmit.returned")}</span>
            ) : submissions.length > 0 ? (
              <span className="student-task-card__turned-in-pill">{t("crm.taskSubmit.turnedIn")}</span>
            ) : null}
          </div>
        </div>

        {showNav ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm student-task-card__nav"
            onClick={() => onTaskNavigate(task.linkType)}
          >
            {linkLabel}
          </button>
        ) : null}
      </header>

      {task.description ? (
        <p className="student-task-card__detail">{localizeCrmText(task.description, locale, t)}</p>
      ) : null}

      {returned ? (
        <div className="student-task-card__return-banner" role="alert">
          <p className="student-task-card__return-banner-title">{t("crm.taskSubmit.returnedBanner")}</p>
          {task.returnNote ? (
            <p className="student-task-card__return-banner-note">{task.returnNote}</p>
          ) : null}
        </div>
      ) : null}

      {hasMaterials || showSubmissionSection ? (
      <div
        className={`student-task-card__grid${
          hasMaterials && showSubmissionSection ? "" : " student-task-card__grid--single"
        }`}
      >
        {hasMaterials ? (
          <section className="student-task-card__section">
            <h5 className="student-task-card__section-title">{t("crm.taskSubmit.studentMaterials")}</h5>
            <TaskAttachmentLinks
              fileIds={task.attachedFileIds}
              files={files}
              linkVariant="chip"
              className="student-task-card__chips"
            />
          </section>
        ) : null}

        {allowSubmit && engagementId ? (
          <section className="student-task-card__section student-task-card__section--submission">
            <h5 className="student-task-card__section-title">{t("crm.taskSubmit.studentSubmission")}</h5>
            {submissions.length > 0 ? (
              <TaskAttachmentLinks
                fileIds={submissions.map((f) => f.id)}
                files={files}
                linkVariant="chip"
                className="student-task-card__chips student-task-card__chips--submitted"
              />
            ) : (
              <p className="student-task-card__empty">{t("crm.taskSubmit.studentNoSubmission")}</p>
            )}
            <TaskSubmissionPanel
              embedded
              taskId={task.id}
              engagementId={engagementId}
              submissions={submissions}
              taskDone={task.status === "done"}
              returned={returned}
              onSubmitted={() => onSubmitted?.()}
            />
          </section>
        ) : submissions.length > 0 ? (
          <section className="student-task-card__section student-task-card__section--submission">
            <h5 className="student-task-card__section-title">{t("crm.taskSubmit.studentSubmission")}</h5>
            <TaskAttachmentLinks
              fileIds={submissions.map((f) => f.id)}
              files={files}
              linkVariant="chip"
              className="student-task-card__chips"
            />
          </section>
        ) : null}
      </div>
      ) : null}
    </article>
  );
}
