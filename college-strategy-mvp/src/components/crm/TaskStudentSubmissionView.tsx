import { useLanguage } from "../../i18n/LanguageContext";
import { resolveTaskSubmissions } from "../../lib/crm/taskSubmissions";
import type { CrmStoredFile, CrmTask } from "../../lib/crm/types";
import { TaskAttachmentLinks } from "./TaskAttachmentLinks";
import "./TaskStudentSubmissionView.css";

type Props = {
  task: CrmTask;
  files: CrmStoredFile[];
  compact?: boolean;
};

export function TaskStudentSubmissionView({ task, files, compact = false }: Props) {
  const { t } = useLanguage();
  const submissions = resolveTaskSubmissions(task, files);

  if (submissions.length === 0) {
    return (
      <p className={`task-student-submission__empty${compact ? " task-student-submission__empty--compact" : ""}`}>
        {t("crm.taskSubmit.counselorNoSubmission")}
      </p>
    );
  }

  return (
    <div className={`task-student-submission${compact ? " task-student-submission--compact" : ""}`}>
      <span className="task-student-submission__badge">{t("crm.taskSubmit.counselorStudentWork")}</span>
      <TaskAttachmentLinks
        fileIds={submissions.map((f) => f.id)}
        files={files}
        className="task-student-submission__links"
      />
    </div>
  );
}
