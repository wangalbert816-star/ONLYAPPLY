import { useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { getCaseFileDownloadUrl, getCrmBackend, uploadCaseFile } from "../../lib/crm/store";
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

  const canUploadBinary = getCrmBackend() === "supabase";

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
      setSuccess(t("crm.files.uploadSuccess", { name: file.name }));
      onChange();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(uploadErrorMessage(raw, t));
    } finally {
      setBusy(false);
    }
  };

  const download = async (file: CrmStoredFile) => {
    if (!file.storagePath) return;
    setError(null);
    try {
      const url = await getCaseFileDownloadUrl(file.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError(t("crm.files.downloadFailed"));
    }
  };

  return (
    <>
      <p className="signed-service-hub__muted">{t("crm.signedService.filesLead")}</p>
      {!canUploadBinary ? <p className="signed-service-hub__muted">{t("crm.files.demoHint")}</p> : null}
      <ul className="signed-service-hub__files">
        {files.length === 0 ? (
          <li className="signed-service-hub__files-empty">{t("crm.files.empty")}</li>
        ) : (
          files.map((file) => (
            <li key={file.id}>
              <div className="case-files-panel__row">
                <strong>{localizeCrmText(file.name, locale, t)}</strong>
                {file.storagePath ? (
                  <button type="button" className="signed-service-hub__link" onClick={() => void download(file)}>
                    {t("crm.files.download")}
                  </button>
                ) : null}
              </div>
              <span>
                {file.category}
                {file.sizeBytes ? ` · ${formatBytes(file.sizeBytes)}` : ""}
                {" · "}
                {formatWhen(file.uploadedAt, locale)}
                {" · "}
                {uploaderLabel(file.uploadedByRole)}
              </span>
            </li>
          ))
        )}
      </ul>
      <div className="signed-service-hub__upload case-files-panel__upload">
        <label className="case-files-panel__file-label">
          <span>{t("crm.files.chooseFile")}</span>
          <input
            ref={inputRef}
            type="file"
            disabled={!canUploadBinary || busy}
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
      {success ? <p className="case-files-panel__success">{success}</p> : null}
      {error ? <p className="case-files-panel__error">{error}</p> : null}
    </>
  );
}
