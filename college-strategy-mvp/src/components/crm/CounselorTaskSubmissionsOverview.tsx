import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import type { CrmStoredFile, CrmTask } from "../../lib/crm/types";
import { TaskAttachmentLinks } from "./TaskAttachmentLinks";
import { orphanTaskSubmissionFiles, resolveTaskSubmissions } from "../../lib/crm/taskSubmissions";

type Props = {
  tasks: CrmTask[];
  files: CrmStoredFile[];
};

export function CounselorTaskSubmissionsOverview({ tasks, files }: Props) {
  const { t, locale } = useLanguage();

  const tasksWithWork = useMemo(
    () =>
      tasks
        .map((task) => ({ task, submissions: resolveTaskSubmissions(task, files) }))
        .filter((row) => row.submissions.length > 0),
    [tasks, files],
  );

  const orphanSubmissions = useMemo(() => orphanTaskSubmissionFiles(tasks, files), [tasks, files]);

  const hasAny = tasksWithWork.length > 0 || orphanSubmissions.length > 0;

  return (
    <section className="counselor-task-submissions-overview" aria-labelledby="counselor-task-submissions-title">
      <h3 id="counselor-task-submissions-title">{t("crm.taskSubmit.counselorOverviewTitle")}</h3>
      <p className="counselor-task-submissions-overview__lead">{t("crm.taskSubmit.counselorOverviewLead")}</p>
      {!hasAny ? (
        <p className="counselor-task-submissions-overview__empty">{t("crm.taskSubmit.counselorOverviewEmpty")}</p>
      ) : (
        <ul className="counselor-task-submissions-overview__list">
          {tasksWithWork.map(({ task, submissions }) => (
            <li key={task.id}>
              <span className="counselor-task-submissions-overview__task-title">
                {localizeCrmText(task.title, locale, t)}
              </span>
              <TaskAttachmentLinks
                fileIds={submissions.map((f) => f.id)}
                files={files}
                className="task-student-submission__links"
              />
            </li>
          ))}
          {orphanSubmissions.length > 0 ? (
            <li>
              <span className="counselor-task-submissions-overview__task-title">
                {t("crm.taskSubmit.counselorOrphanTitle")}
              </span>
              <TaskAttachmentLinks
                fileIds={orphanSubmissions.map((f) => f.id)}
                files={files}
                className="task-student-submission__links"
              />
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
