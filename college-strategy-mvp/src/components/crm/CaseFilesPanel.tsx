import { useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import {
  isGoogleCopyUrl,
  openCaseFileExternalUrl,
  validateGoogleDocsUrl,
} from "../../lib/crm/libraryLinks";
import {
  deleteCaseFile,
  getCaseFileDownloadUrl,
  getCrmBackend,
  submitCaseFileGoogleLink,
  uploadCaseFile,
} from "../../lib/crm/store";
import type { CrmFileUploaderRole, CrmStoredFile } from "../../lib/crm/types";

const MAX_BYTES = 20 * 1024 * 1024;

function formatBytes(bytes: number | undefined) {
  if (bytes == null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string, locale: "zh" | "en") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uploadErrorMessage(code: string, t: (key: string) => string) {
  if (/bucket not found/i.test(code)) return t("crm.files.errors.bucket_missing");
  if (/row-level security|permission|403|401/i.test(code)) return t("crm.files.errors.permission_denied");
  const key = `crm.files.errors.${code}`;
  const localized = t(key);
  return localized === key ? t("crm.files.uploadFailed") : localized;
}

type Props = {
  engagementId: string;
  uploadedByRole: CrmFileUploaderRole;
  files: CrmStoredFile[];
  defaultCategory?: string;
  onChange: () => void;
};

export function CaseFilesPanel({ engagementId, uploadedByRole, files, defaultCategory, onChange }: Props) {
  const { t, locale } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(defaultCategory ?? "general");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [googleUrl, setGoogleUrl] = useState("");
  const [googleTitle, setGoogleTitle] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const isStudentView = uploadedByRole === "student";
  const canUseSupabaseFiles = getCrmBackend() === "supabase";
  const canUploadBinary = canUseSupabaseFiles;
  const linkPreview = googleUrl.trim() ? validateGoogleDocsUrl(googleUrl) : null;
  const canSubmitGoogle = canUseSupabaseFiles && linkPreview?.ok === true;

  const uploaderLabel = (role: CrmFileUploaderRole | undefined) => {
    if (role === "counselor") return t("crm.files.uploadedByCounselor");
    if (role === "student") return t("crm.files.uploadedByStudent");
    return t("crm.files.uploadedByLegacy");
  };

  const uploadSelected = async (file: File) => {
    if (busy) return;
    if (file.size > MAX_BYTES) {
      setError(t("crm.files.tooLarge"));
      setSuccess(null);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await uploadCaseFile({
        engagementId,
        file,
        category: category.trim() || "general",
        uploadedByRole,
      });
      if (inputRef.current) inputRef.current.value = "";
      setPendingFile(null);
      setSuccess(t("crm.files.uploadSuccess", { name: file.name }));
      onChange();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(uploadErrorMessage(raw, t));
    } finally {
      setBusy(false);
    }
  };

  const submitGoogleLink = async () => {
    if (busy) return;
    const validated = validateGoogleDocsUrl(googleUrl);
    if (!validated.ok) {
      setError(t("crm.files.errors.google_doc_url_invalid"));
      setSuccess(null);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const stored = await submitCaseFileGoogleLink({
        engagementId,
        url: validated.url,
        name: googleTitle.trim() || undefined,
        category: category.trim() || "general",
        uploadedByRole,
      });
      setGoogleUrl("");
      setGoogleTitle("");
      setSuccess(t("crm.files.googleLinkSuccess", { name: stored.name }));
      onChange();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(uploadErrorMessage(raw, t));
    } finally {
      setBusy(false);
    }
  };

  const externalLinkLabel = (file: CrmStoredFile) => {
    if (file.externalUrl && isGoogleCopyUrl(file.externalUrl)) return t("crm.files.openCopy");
    if (file.externalUrl) return t("crm.files.openGoogleDoc");
    return t("crm.files.download");
  };

  const canDeleteFile = (file: CrmStoredFile) => {
    if (!canUseSupabaseFiles) return false;
    if (uploadedByRole === "counselor") return true;
    return file.uploadedByRole === "student" || !file.uploadedByRole;
  };

  const removeFile = async (file: CrmStoredFile) => {
    if (busy || !canDeleteFile(file)) return;
    const name = localizeCrmText(file.name, locale, t);
    if (!window.confirm(t("crm.files.deleteConfirm", { name }))) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteCaseFile(file.id);
      setSuccess(t("crm.files.deleteSuccess", { name }));
      onChange();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        raw === "file_not_found"
          ? t("crm.files.errors.file_not_found")
          : uploadErrorMessage(raw, t) === t("crm.files.uploadFailed")
            ? t("crm.files.deleteFailed")
            : uploadErrorMessage(raw, t),
      );
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (file: CrmStoredFile) => {
    if (file.externalUrl) {
      openCaseFileExternalUrl(file.externalUrl);
      return;
    }
    if (!file.storagePath) return;
    setError(null);
    try {
      const url = await getCaseFileDownloadUrl(file.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError(t("crm.files.downloadFailed"));
    }
  };

  const fileList = (
    <ul className="signed-service-hub__files">
      {files.length === 0 ? (
        <li className="signed-service-hub__files-empty">{t("crm.files.empty")}</li>
      ) : (
        files.map((file) => (
          <li key={file.id}>
            <div className="case-files-panel__row">
              <strong>{localizeCrmText(file.name, locale, t)}</strong>
              <div className="case-files-panel__row-actions">
                {file.externalUrl || file.storagePath ? (
                  <button type="button" className="signed-service-hub__link" onClick={() => void openFile(file)}>
                    {externalLinkLabel(file)}
                  </button>
                ) : null}
                {canDeleteFile(file) ? (
                  <button
                    type="button"
                    className="case-files-panel__delete"
                    disabled={busy}
                    onClick={() => void removeFile(file)}
                  >
                    {t("crm.files.delete")}
                  </button>
                ) : null}
              </div>
            </div>
            <span>
              {file.externalUrl ? t("crm.files.kindGoogleDoc") : file.category}
              {!file.externalUrl && file.sizeBytes ? ` · ${formatBytes(file.sizeBytes)}` : ""}
              {" · "}
              {formatWhen(file.uploadedAt, locale)}
              {" · "}
              {uploaderLabel(file.uploadedByRole)}
            </span>
          </li>
        ))
      )}
    </ul>
  );

  const googleLinkForm = canUseSupabaseFiles ? (
    <form
      className={isStudentView ? "case-files-panel__submit-card" : "case-files-panel__google"}
      onSubmit={(e) => {
        e.preventDefault();
        void submitGoogleLink();
      }}
    >
      {isStudentView ? <h3 className="case-files-panel__submit-title">{t("crm.files.studentSubmitTitle")}</h3> : null}
      <p className="case-files-panel__google-lead">
        {isStudentView ? t("crm.files.studentSubmitLead") : t("crm.files.googleLinkLead")}
      </p>
      <label className="case-files-panel__field">
        <span>{isStudentView ? t("crm.files.studentStepLink") : t("crm.files.googleLinkLabel")}</span>
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
          required
        />
      </label>
      {googleUrl.trim() && linkPreview && !linkPreview.ok ? (
        <p className="case-files-panel__hint case-files-panel__hint--warn">{t("crm.files.errors.google_doc_url_invalid")}</p>
      ) : null}
      <label className="case-files-panel__field">
        <span>{isStudentView ? t("crm.files.studentStepName") : t("crm.files.googleLinkTitleLabel")}</span>
        <input
          value={googleTitle}
          onChange={(e) => setGoogleTitle(e.target.value)}
          placeholder={t("crm.files.googleLinkTitlePlaceholder")}
          disabled={busy}
        />
      </label>
      <button type="submit" className="btn btn-primary case-files-panel__submit-btn" disabled={busy || !canSubmitGoogle}>
        {isStudentView ? t("crm.files.studentSubmitButton") : t("crm.files.submitGoogleLink")}
      </button>
    </form>
  ) : null;

  const binaryUpload = canUploadBinary ? (
    isStudentView ? (
      <div className="case-files-panel__submit-card">
        <h3 className="case-files-panel__submit-title">{t("crm.files.studentUploadFileTitle")}</h3>
        <p className="case-files-panel__google-lead">{t("crm.files.studentUploadFileLead")}</p>
        <label className="case-files-panel__field case-files-panel__file-field">
          <span>{t("crm.files.studentUploadStepChoose")}</span>
          <input
            ref={inputRef}
            type="file"
            className="case-files-panel__file-input"
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setPendingFile(file);
              if (error) setError(null);
            }}
          />
        </label>
        {pendingFile ? (
          <p className="case-files-panel__picked">
            {t("crm.files.selected", {
              name: pendingFile.name,
              size: formatBytes(pendingFile.size),
            })}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary case-files-panel__submit-btn"
          disabled={busy || !pendingFile}
          onClick={() => {
            if (!pendingFile) return;
            void uploadSelected(pendingFile);
          }}
        >
          {busy ? t("crm.files.uploading") : t("crm.files.studentUploadButton")}
        </button>
      </div>
    ) : (
      <div className="signed-service-hub__upload case-files-panel__upload">
        <label className="case-files-panel__file-label">
          <span>{t("crm.files.chooseFile")}</span>
          <input
            ref={inputRef}
            type="file"
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void uploadSelected(file);
            }}
          />
        </label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t("crm.console.fileCategoryPlaceholder")}
          aria-label={t("crm.console.fileCategoryPlaceholder")}
          disabled={busy}
        />
        {busy ? <p className="case-files-panel__picked">{t("crm.files.uploading")}</p> : null}
      </div>
    )
  ) : null;

  return (
    <>
      <p className="signed-service-hub__muted">
        {isStudentView ? t("crm.files.studentFilesLead") : t("crm.signedService.filesLead")}
      </p>
      {!canUseSupabaseFiles ? <p className="signed-service-hub__muted">{t("crm.files.demoHint")}</p> : null}

      {isStudentView ? (
        <>
          {googleLinkForm}
          {binaryUpload}
          <h3 className="case-files-panel__list-title">{t("crm.files.studentSubmittedList")}</h3>
          {fileList}
        </>
      ) : (
        <>
          {fileList}
          {googleLinkForm}
          {binaryUpload}
        </>
      )}

      {success ? <p className="case-files-panel__success">{success}</p> : null}
      {error ? <p className="case-files-panel__error">{error}</p> : null}
    </>
  );
}
