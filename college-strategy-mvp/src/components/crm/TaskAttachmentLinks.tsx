import { useLanguage } from "../../i18n/LanguageContext";
import { isGoogleCopyUrl, openCaseFileExternalUrl } from "../../lib/crm/libraryLinks";
import { getCaseFileDownloadUrl } from "../../lib/crm/store";
import type { CrmStoredFile } from "../../lib/crm/types";
import "./taskFileChip.css";

type Props = {
  fileIds?: string[];
  files: CrmStoredFile[];
  className?: string;
  linkVariant?: "link" | "chip";
};

export function TaskAttachmentLinks({ fileIds, files, className, linkVariant = "link" }: Props) {
  const { t } = useLanguage();
  if (!fileIds?.length) return null;

  const attached = fileIds
    .map((fileId) => files.find((file) => file.id === fileId))
    .filter((file): file is CrmStoredFile => Boolean(file && (file.storagePath || file.externalUrl)));

  if (attached.length === 0) return null;

  const openFile = async (file: CrmStoredFile) => {
    if (file.externalUrl) {
      openCaseFileExternalUrl(file.externalUrl);
      return;
    }
    try {
      const url = await getCaseFileDownloadUrl(file.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.alert(t("crm.files.downloadFailed"));
    }
  };

  return (
    <ul className={className ?? "task-attachment-links"}>
      {attached.map((file) => (
        <li key={file.id}>
          <button
            type="button"
            className={linkVariant === "chip" ? "task-file-chip" : "signed-service-hub__link"}
            onClick={() => void openFile(file)}
            title={file.name}
          >
            {linkVariant === "chip"
              ? file.name
              : file.externalUrl
                ? isGoogleCopyUrl(file.externalUrl)
                  ? t("crm.taskAttachments.openCopy", { name: file.name })
                  : t("crm.taskAttachments.openGoogleDoc", { name: file.name })
                : t("crm.taskAttachments.download", { name: file.name })}
          </button>
        </li>
      ))}
    </ul>
  );
}
