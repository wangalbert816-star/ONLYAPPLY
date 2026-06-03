import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import type { CrmStoredFile, CrmTask, CrmTaskLinkType } from "../../lib/crm/types";
import { isTaskAction, isTaskResource } from "../../lib/crm/taskItemKind";
import { StudentTaskRow } from "./StudentTaskRow";
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
  layout?: "board" | "compact";
  maxCollapsed?: number;
  renderTask?: (task: CrmTask, ctx: { categoryLabel: string }) => ReactNode;
};

type CompletedFilter = "all" | CrmTaskLinkType;

function formatMonthGroup(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "long",
    year: "numeric",
  });
}

function groupTasksByMonth(
  tasks: CrmTask[],
  locale: string,
  dateFor: (task: CrmTask) => string,
): { label: string; tasks: CrmTask[] }[] {
  const buckets = new Map<string, CrmTask[]>();
  for (const task of tasks) {
    const label = formatMonthGroup(dateFor(task), locale);
    const list = buckets.get(label) ?? [];
    list.push(task);
    buckets.set(label, list);
  }
  return [...buckets.entries()]
    .map(([label, groupTasks]) => ({ label, tasks: groupTasks }))
    .sort((a, b) => {
      const da = new Date(dateFor(a.tasks[0]!));
      const db = new Date(dateFor(b.tasks[0]!));
      return db.getTime() - da.getTime();
    });
}

export function AccountTaskList({
  tasks,
  files = [],
  engagementId,
  allowSubmit = false,
  onSubmitted,
  onToggleTask,
  onTaskNavigate,
  layout = "board",
  maxCollapsed = 3,
  renderTask: renderTaskOverride,
}: Props) {
  const { t, locale } = useLanguage();
  const [showAll, setShowAll] = useState(layout === "board");
  const [openCollapsed, setOpenCollapsed] = useState(false);
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>("all");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() => new Set());

  const taskCategoryLabel = useMemo(
    () =>
      ({
        profile: t("crm.taskCategory.profile"),
        activities: t("crm.taskCategory.activities"),
        essay: t("crm.taskCategory.essay"),
        report: t("crm.taskCategory.report"),
        none: t("crm.taskCategory.none"),
      }) satisfies Record<CrmTaskLinkType, string>,
    [t],
  );

  const visibleTasks = showAll ? tasks : tasks.slice(0, maxCollapsed);
  const visibleIds = new Set(visibleTasks.map((task) => task.id));

  const actionTasks = tasks.filter(isTaskAction);
  const openVisible = visibleTasks.filter((task) => task.status === "open" || isTaskResource(task));
  const completedVisible = useMemo(
    () => visibleTasks.filter((task) => task.status === "done" && isTaskAction(task)),
    [visibleTasks],
  );

  const stats = useMemo(
    () => ({
      total: actionTasks.length,
      completed: actionTasks.filter((task) => task.status === "done").length,
      open: actionTasks.filter((task) => task.status === "open").length,
    }),
    [actionTasks],
  );

  const filteredCompleted = useMemo(() => {
    if (completedFilter === "all") return completedVisible;
    return completedVisible.filter((task) => task.linkType === completedFilter);
  }, [completedFilter, completedVisible]);

  const completedGroups = useMemo(
    () =>
      groupTasksByMonth(filteredCompleted, locale, (task) => task.completedAt || task.createdAt),
    [filteredCompleted, locale],
  );

  const completedGroupKey = completedGroups.map((group) => group.label).join("|");

  useEffect(() => {
    const labels = completedGroupKey ? completedGroupKey.split("|") : [];
    if (labels.length <= 1) {
      setCollapsedMonths(new Set());
      return;
    }
    setCollapsedMonths(new Set(labels.slice(1)));
  }, [completedFilter, completedGroupKey]);

  const toggleMonth = (label: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const completedFilters: { id: CompletedFilter; label: string }[] = [
    { id: "all", label: t("crm.taskBoard.filterAll") },
    { id: "essay", label: taskCategoryLabel.essay },
    { id: "profile", label: taskCategoryLabel.profile },
    { id: "none", label: taskCategoryLabel.none },
  ];

  const categoryFor = (task: CrmTask) =>
    isTaskResource(task) ? t("crm.taskItemKind.resource") : taskCategoryLabel[task.linkType];

  const renderTask = (task: CrmTask) => {
    const categoryLabel = categoryFor(task);
    if (renderTaskOverride) {
      return renderTaskOverride(task, { categoryLabel });
    }
    return (
      <StudentTaskRow
        key={task.id}
        task={task}
        files={files}
        engagementId={engagementId}
        allowSubmit={allowSubmit}
        categoryLabel={categoryLabel}
        onToggleDone={(done) => onToggleTask(task.id, done)}
        onTaskNavigate={onTaskNavigate}
        onSubmitted={onSubmitted}
      />
    );
  };

  const hasHiddenTasks = tasks.length > maxCollapsed && tasks.some((task) => !visibleIds.has(task.id));

  if (layout === "compact") {
    return (
      <div className="account-task-list account-task-list--compact">
        <p className="account-task-list__compact-label">{t("crm.openTasks", { n: stats.open })}</p>
        {visibleTasks.length === 0 ? (
          <p className="account-task-list__empty">{t("crm.noTasks")}</p>
        ) : (
          <ul className="task-list">{visibleTasks.map(renderTask)}</ul>
        )}
        {hasHiddenTasks ? (
          <button type="button" className="account-task-list__more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("crm.showLess") : t("crm.showAllTasks")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="account-task-list">
      <div className="account-task-list__shell">
        <div className="account-task-list__stats-bar" aria-label={t("crm.taskBoard.statsAria")}>
          <div className="account-task-list__stat">
            <span className="account-task-list__stat-label">{t("crm.taskBoard.total")}</span>
            <span className="account-task-list__stat-value">{stats.total}</span>
          </div>
          <div className="account-task-list__stat account-task-list__stat--completed">
            <span className="account-task-list__stat-label">{t("crm.taskBoard.completed")}</span>
            <span className="account-task-list__stat-value">{stats.completed}</span>
          </div>
          <div className="account-task-list__stat account-task-list__stat--open">
            <span className="account-task-list__stat-label">{t("crm.taskBoard.open")}</span>
            <span className="account-task-list__stat-value">{stats.open}</span>
          </div>
        </div>

        <section className="account-task-list__block">
        <button
          type="button"
          className="account-task-list__block-toggle"
          aria-expanded={!openCollapsed}
          onClick={() => setOpenCollapsed((v) => !v)}
        >
          <span className="account-task-list__block-icon account-task-list__block-icon--open" aria-hidden />
          <span className="account-task-list__block-title">{t("crm.taskBoard.sectionOpen")}</span>
          <span className="account-task-list__count">{stats.open}</span>
          <span
            className={`account-task-list__chevron${openCollapsed ? " account-task-list__chevron--collapsed" : ""}`}
            aria-hidden
          />
        </button>
        {!openCollapsed ? (
          openVisible.length === 0 ? (
            <p className="account-task-list__empty">{t("crm.taskBoard.noOpen")}</p>
          ) : (
            <ul className="task-list">{openVisible.map(renderTask)}</ul>
          )
        ) : null}
      </section>

      <section className="account-task-list__block">
        <div className="account-task-list__completed-head">
          <button
            type="button"
            className="account-task-list__block-toggle account-task-list__block-toggle--plain"
            aria-expanded={!completedCollapsed}
            onClick={() => setCompletedCollapsed((v) => !v)}
          >
            <span className="account-task-list__block-icon account-task-list__block-icon--done" aria-hidden />
            <span className="account-task-list__block-title">{t("crm.taskBoard.sectionCompleted")}</span>
            <span className="account-task-list__count">{stats.completed}</span>
          </button>
          {completedVisible.length > 0 ? (
            <div className="account-task-list__filters" role="tablist" aria-label={t("crm.taskBoard.filterAria")}>
              {completedFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={completedFilter === filter.id}
                  className={completedFilter === filter.id ? "is-active" : undefined}
                  onClick={() => setCompletedFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="account-task-list__chevron-btn"
            aria-expanded={!completedCollapsed}
            aria-label={completedCollapsed ? t("crm.taskBoard.expand") : t("crm.taskBoard.collapse")}
            onClick={() => setCompletedCollapsed((v) => !v)}
          >
            <span
              className={`account-task-list__chevron${completedCollapsed ? " account-task-list__chevron--collapsed" : ""}`}
              aria-hidden
            />
          </button>
        </div>

        {!completedCollapsed ? (
          filteredCompleted.length === 0 ? (
            <p className="account-task-list__empty">{t("crm.taskBoard.noCompleted")}</p>
          ) : (
            <div className="account-task-list__timeline">
              {completedGroups.map((group) => {
                const monthCollapsed = collapsedMonths.has(group.label);
                return (
                  <div
                    key={group.label}
                    className={`account-task-list__month${monthCollapsed ? " account-task-list__month--collapsed" : ""}`}
                  >
                    <button
                      type="button"
                      className="account-task-list__month-toggle"
                      aria-expanded={!monthCollapsed}
                      onClick={() => toggleMonth(group.label)}
                    >
                      <span
                        className={`account-task-list__chevron account-task-list__chevron--month${monthCollapsed ? " account-task-list__chevron--collapsed" : ""}`}
                        aria-hidden
                      />
                      <span className="account-task-list__month-label">{group.label.toUpperCase()}</span>
                      <span className="account-task-list__month-count">
                        {t("crm.taskBoard.taskCount", { n: group.tasks.length })}
                      </span>
                    </button>
                    {!monthCollapsed ? (
                      <ul className="task-list task-list--nested">{group.tasks.map(renderTask)}</ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </section>
      </div>

      {hasHiddenTasks ? (
        <button type="button" className="account-task-list__more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? t("crm.showLess") : t("crm.showAllTasks")}
        </button>
      ) : null}
    </div>
  );
}
