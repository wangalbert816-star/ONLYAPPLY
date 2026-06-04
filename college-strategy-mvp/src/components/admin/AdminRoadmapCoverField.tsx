import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { uploadAdminRoadmapCover } from "../../lib/admin/crmAdminApi";

type Props = {
  token: string;
  value: string | null;
  onChange: (publicUrl: string | null) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
};

export function AdminRoadmapCoverField({ token, value, onChange, disabled, onError }: Props) {
  const { t } = useLanguage();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const previewSrc = localPreview || value || null;

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const pickFile = async (file: File | undefined) => {
    if (!file || disabled || uploading) return;
    onError?.("");
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    setUploading(true);
    try {
      const publicUrl = await uploadAdminRoadmapCover(token, file);
      onChange(publicUrl);
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      const key = `admin.errors.${code}`;
      const msg = t(key);
      onError?.(msg === key ? t("admin.errors.roadmap_cover_upload_failed") : msg);
      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearCover = () => {
    if (disabled || uploading) return;
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="admin-roadmap-cover">
      <label htmlFor={inputId}>
        <span>{t("admin.roadmap.coverImage")}</span>
      </label>
      <p className="admin-portal__hint">{t("admin.roadmap.coverImageHint")}</p>
      {previewSrc ? (
        <div className="admin-roadmap-cover__preview">
          <img src={previewSrc} alt="" />
        </div>
      ) : null}
      <div className="admin-roadmap-cover__actions">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="admin-roadmap-cover__file"
          disabled={disabled || uploading}
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
        <label htmlFor={inputId} className={`btn btn-secondary${disabled || uploading ? " is-disabled" : ""}`}>
          {uploading ? t("admin.roadmap.coverUploading") : t("admin.roadmap.coverChoose")}
        </label>
        {previewSrc ? (
          <button type="button" className="btn btn-secondary" disabled={disabled || uploading} onClick={clearCover}>
            {t("admin.roadmap.coverRemove")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
