import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import type { CrmStoredFile, CrmTask, CrmTaskLinkType } from "../../lib/crm/types";
import { isTaskAction } from "../../lib/crm/taskItemKind";
import { StudentTaskCard } from "./StudentTaskCard";
import "./AccountTaskList.css";
import "./crmTaskTypes.css";

type Props = {
  tasks: CrmTask[];
  files?: CrmStoredFile[];
  engagementId?: string;
  allowSubmit?: boolean;
  onSubmitted?: () => void;
  onToggleTask: (taskId: string, done: boolean) => void;
  onTaskNavigate: (linkType: CrmTaskLinkType) => void;
  variant?: "card" | "plain";
  maxCollapsed?: number;
};

export function AccountTaskList({
  tasks,
  files = [],
  engagementId,
  allowSubmit = false,
  onSubmitted,
  onToggleTask,
  onTaskNavigate,
  variant = "card",
  maxCollapsed = 3,
}: Props) {
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);

  const openTasks = tasks.filter((task) => task.status === "open" && isTaskAction(task));
  const visibleTasks = showAll ? tasks : tasks.slice(0, maxCollapsed);

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

  return (
    <div className={`account-task-list account-task-list--${variant}`}>
      <div className="account-task-list__head">
        <span>{t("crm.openTasks", { n: openTasks.length })}</span>
      </div>
      {visibleTasks.length === 0 ? (
        <p className="account-task-list__empty">{t("crm.noTasks")}</p>
      ) : (
        <ul className="account-task-list__items">
          {visibleTasks.map((task) => (
            <li key={task.id} className="account-task-list__item">
              <StudentTaskCard
                task={task}
                files={files}
                engagementId={engagementId}
                allowSubmit={allowSubmit}
                linkLabel={
                  task.itemKind === "resource" ? t("crm.taskItemKind.resource") : taskLinkLabel[task.linkType]
                }
                onToggleDone={(done) => onToggleTask(task.id, done)}
                onTaskNavigate={onTaskNavigate}
                onSubmitted={onSubmitted}
              />
            </li>
          ))}
        </ul>
      )}
      {tasks.length > maxCollapsed ? (
        <button type="button" className="account-task-list__more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? t("crm.showLess") : t("crm.showAllTasks")}
        </button>
      ) : null}
    </div>
  );
}
