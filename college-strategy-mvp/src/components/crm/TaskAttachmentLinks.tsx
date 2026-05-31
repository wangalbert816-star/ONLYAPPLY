import { useLanguage } from "../../i18n/LanguageContext";
import { getCaseFileDownloadUrl } from "../../lib/crm/store";
import type { CrmStoredFile } from "../../lib/crm/types";

type Props = {
  fileIds?: string[];
  files: CrmStoredFile[];
  className?: string;
};

export function TaskAttachmentLinks({ fileIds, files, className }: Props) {
  const { t } = useLanguage();
  if (!fileIds?.length) return null;

  const attached = fileIds
    .map((fileId) => files.find((file) => file.id === fileId))
    .filter((file): file is CrmStoredFile => Boolean(file?.storagePath));

  if (attached.length === 0) return null;

  const download = async (file: CrmStoredFile) => {
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
          <button type="button" className="signed-service-hub__link" onClick={() => void download(file)}>
            {t("crm.taskAttachments.download", { name: file.name })}
          </button>
        </li>
      ))}
    </ul>
  );
}
