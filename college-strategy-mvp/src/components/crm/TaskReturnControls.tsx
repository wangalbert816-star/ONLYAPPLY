import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { isTaskSubmissionReturned } from "../../lib/crm/taskSubmissions";
import type { CrmTask } from "../../lib/crm/types";
import "./TaskReturnControls.css";

type Props = {
  task: CrmTask;
  hasSubmission: boolean;
  busy?: boolean;
  onReturn: (note: string) => void | Promise<void>;
};

export function TaskReturnControls({ task, hasSubmission, busy = false, onReturn }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const returned = isTaskSubmissionReturned(task);

  if (!hasSubmission) return null;

  if (returned) {
    return (
      <div className="task-return__returned" role="status">
        <p className="task-return__returned-label">{t("crm.taskSubmit.returnedCounselorHint")}</p>
        {task.returnNote ? <p className="task-return__returned-note">{task.returnNote}</p> : null}
      </div>
    );
  }

  const submitReturn = async () => {
    setError(null);
    try {
      await onReturn(note);
      setNote("");
      setOpen(false);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        raw === "task_return_schema_missing"
          ? t("crm.files.errors.task_return_schema_missing")
          : t("crm.taskSubmit.returnFailed"),
      );
    }
  };

  if (!open) {
    return (
      <div className="task-return">
        <button
          type="button"
          className="btn btn-secondary btn-sm task-return__trigger"
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          {t("crm.taskSubmit.return")}
        </button>
      </div>
    );
  }

  return (
    <div className="task-return task-return--open">
      <p className="task-return__title">{t("crm.taskSubmit.returnTitle")}</p>
      <label className="task-return__field">
        <span>{t("crm.taskSubmit.returnNoteLabel")}</span>
        <textarea
          value={note}
          rows={3}
          disabled={busy}
          placeholder={t("crm.taskSubmit.returnNotePlaceholder")}
          onChange={(e) => {
            setNote(e.target.value);
            if (error) setError(null);
          }}
        />
      </label>
      <div className="task-return__actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submitReturn()}>
          {t("crm.taskSubmit.returnConfirm")}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNote("");
            setError(null);
          }}
        >
          {t("crm.taskSubmit.cancel")}
        </button>
      </div>
      {error ? <p className="task-return__error">{error}</p> : null}
    </div>
  );
}
