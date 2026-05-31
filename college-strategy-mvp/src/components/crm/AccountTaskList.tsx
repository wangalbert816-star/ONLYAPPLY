import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import type { CrmTask, CrmTaskLinkType } from "../../lib/crm/types";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import "./AccountTaskList.css";

type Props = {
  tasks: CrmTask[];
  onToggleTask: (taskId: string, done: boolean) => void;
  onTaskNavigate: (linkType: CrmTaskLinkType) => void;
  variant?: "card" | "plain";
  maxCollapsed?: number;
};

export function AccountTaskList({
  tasks,
  onToggleTask,
  onTaskNavigate,
  variant = "card",
  maxCollapsed = 3,
}: Props) {
  const { t, locale } = useLanguage();
  const [showAll, setShowAll] = useState(false);

  const openTasks = tasks.filter((task) => task.status === "open");
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
            <li key={task.id} className={task.status === "done" ? "is-done" : ""}>
              <label className="account-task-list__check">
                <input
                  type="checkbox"
                  checked={task.status === "done"}
                  onChange={(e) => onToggleTask(task.id, e.target.checked)}
                />
                <span>{localizeCrmText(task.title, locale, t)}</span>
              </label>
              <div className="account-task-list__meta">
                {task.dueAt ? <span>{t("crm.due", { date: task.dueAt })}</span> : null}
                {task.status === "done" ? <span>{t("crm.taskDone")}</span> : null}
                {task.linkType !== "none" && task.status === "open" ? (
                  <button type="button" className="account-task-list__link" onClick={() => onTaskNavigate(task.linkType)}>
                    {taskLinkLabel[task.linkType]}
                  </button>
                ) : null}
              </div>
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
