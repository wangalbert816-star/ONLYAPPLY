import { useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { validateGoogleDocsUrl } from "../../lib/crm/libraryLinks";
import { getCrmBackend, submitTaskFile, submitTaskGoogleLink } from "../../lib/crm/store";
import type { CrmStoredFile } from "../../lib/crm/types";
import { TaskAttachmentLinks } from "./TaskAttachmentLinks";
import "./TaskSubmissionPanel.css";

const MAX_BYTES = 20 * 1024 * 1024;

type Props = {
  taskId: string;
  engagementId: string;
  submissions: CrmStoredFile[];
  taskDone: boolean;
  onSubmitted: () => void;
  /** Fits inside StudentTaskCard section (no duplicate turned-in list). */
  embedded?: boolean;
  returned?: boolean;
  defaultOpen?: boolean;
  listInline?: boolean;
  onDismiss?: () => void;
};

export function TaskSubmissionPanel({
  taskId,
  engagementId,
  submissions,
  taskDone,
  onSubmitted,
  embedded = false,
  returned = false,
  defaultOpen = false,
  listInline = false,
  onDismiss,
}: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleUrl, setGoogleUrl] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const canSubmit = getCrmBackend() === "supabase";
  const linkPreview = googleUrl.trim() ? validateGoogleDocsUrl(googleUrl) : null;
  const canSubmitLink = Boolean(linkPreview?.ok);

  const resetForm = () => {
    setGoogleUrl("");
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
    setError(null);
  };

  const handleGoogleSubmit = async () => {
    if (busy || !linkPreview?.ok) return;
    setBusy(true);
    setError(null);
    try {
      await submitTaskGoogleLink({
        taskId,
        engagementId,
        url: linkPreview.url,
      });
      resetForm();
      setOpen(false);
      onSubmitted();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        raw === "google_doc_url_invalid"
          ? t("crm.files.errors.google_doc_url_invalid")
          : raw === "task_submissions_schema_missing"
            ? t("crm.files.errors.task_submissions_schema_missing")
            : t("crm.taskSubmit.failed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFileSubmit = async () => {
    if (busy || !pendingFile) return;
    if (pendingFile.size > MAX_BYTES) {
      setError(t("crm.files.tooLarge"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitTaskFile({ taskId, engagementId, file: pendingFile });
      resetForm();
      setOpen(false);
      onSubmitted();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        raw === "task_submissions_schema_missing"
          ? t("crm.files.errors.task_submissions_schema_missing")
          : t("crm.taskSubmit.failed"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canSubmit) {
    return (
      <p className={`task-submission__hint signed-service-hub__muted${embedded ? " task-submission__hint--embedded" : ""}`}>
        {t("crm.files.demoHint")}
      </p>
    );
  }

  return (
    <div
      className={`task-submission${embedded ? " task-submission--embedded" : ""}${
        listInline ? " task-submission--list-inline" : ""
      }`}
    >
      {!embedded && submissions.length > 0 ? (
        <div className="task-submission__turned-in">
          <span className="task-submission__badge">{t("crm.taskSubmit.turnedIn")}</span>
          <TaskAttachmentLinks
            fileIds={submissions.map((f) => f.id)}
            files={submissions}
            linkVariant="chip"
            className="task-submission__files"
          />
        </div>
      ) : null}

      {returned && !open ? (
        <p className="task-submission__resubmit-lead">{t("crm.taskSubmit.resubmitLead")}</p>
      ) : null}

      {!open && !defaultOpen ? (
        <button
          type="button"
          className={`btn task-submission__open${embedded ? " btn-secondary btn-sm" : " btn-primary"}`}
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          {returned || submissions.length > 0 ? t("crm.taskSubmit.addMore") : t("crm.taskSubmit.turnIn")}
        </button>
      ) : (
        <div className="task-submission__card">
          <div className="task-submission__card-head">
            <strong>{t("crm.taskSubmit.cardTitle")}</strong>
            <button
              type="button"
              className="task-submission__cancel"
              disabled={busy}
              onClick={() => {
                resetForm();
                setOpen(false);
                onDismiss?.();
              }}
            >
              {t("crm.taskSubmit.cancel")}
            </button>
          </div>
          <p className="task-submission__lead">{t("crm.taskSubmit.lead")}</p>

          <label className="task-submission__field">
            <span>{t("crm.files.studentStepLink")}</span>
            <input
              type="url"
              value={googleUrl}
              onChange={(e) => {
                setGoogleUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("crm.files.googleLinkPlaceholder")}
              disabled={busy}
              autoComplete="off"
            />
          </label>
          {googleUrl.trim() && linkPreview && !linkPreview.ok ? (
            <p className="task-submission__warn">{t("crm.files.errors.google_doc_url_invalid")}</p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !canSubmitLink}
            onClick={() => void handleGoogleSubmit()}
          >
            {t("crm.taskSubmit.submitLink")}
          </button>

          <p className="task-submission__or">{t("crm.taskSubmit.or")}</p>

          <label className="task-submission__field">
            <span>{t("crm.files.studentUploadStepChoose")}</span>
            <input
              ref={inputRef}
              type="file"
              className="task-submission__file-input"
              disabled={busy}
              onChange={(e) => {
                setPendingFile(e.target.files?.[0] ?? null);
                if (error) setError(null);
              }}
            />
          </label>
          {pendingFile ? (
            <p className="task-submission__picked">{pendingFile.name}</p>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !pendingFile}
            onClick={() => void handleFileSubmit()}
          >
            {busy ? t("crm.files.uploading") : t("crm.taskSubmit.submitFile")}
          </button>

          {taskDone ? null : (
            <p className="task-submission__note">{t("crm.taskSubmit.markDoneHint")}</p>
          )}
        </div>
      )}

      {error ? <p className="task-submission__error">{error}</p> : null}
    </div>
  );
}
