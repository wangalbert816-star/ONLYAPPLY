import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  deleteAdminLibraryItem,
  listAdminLibraryItems,
  patchAdminLibraryItem,
  prepareAdminLibraryUpload,
  type AdminLibraryItem,
} from "../../lib/admin/crmAdminApi";

const MAX_BYTES = 20 * 1024 * 1024;
const CATEGORIES = ["template", "worksheet", "checklist", "reference", "general"] as const;
const LOCALES = ["all", "zh", "en"] as const;

function formatBytes(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function libraryErrorMessage(code: string | undefined, t: (key: string) => string) {
  if (!code) return t("admin.errors.generic");
  if (code === "api_route_missing") return t("admin.errors.library_api_missing");
  if (/crm_library_items|relation.*does not exist/i.test(code)) return t("admin.errors.library_table_missing");
  const key = `admin.errors.${code}`;
  const msg = t(key);
  return msg === key ? t("admin.errors.generic") : msg;
}

type Props = {
  token: string;
  busy: boolean;
  onRun: (fn: () => Promise<void>) => Promise<void>;
};

export function AdminLibraryPanel({ token, busy, onRun }: Props) {
  const { t, locale } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AdminLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("template");
  const [itemLocale, setItemLocale] = useState<(typeof LOCALES)[number]>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<(typeof CATEGORIES)[number]>("general");
  const [editLocale, setEditLocale] = useState<(typeof LOCALES)[number]>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setPanelError(null);
    try {
      const { items: next } = await listAdminLibraryItems(token);
      setItems(next);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const code = (e as Error & { code?: string }).code ?? raw;
      setPanelError(libraryErrorMessage(code, t));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitUpload = async () => {
    if (uploading || busy) return;
    setPanelError(null);
    if (!title.trim()) {
      setPanelError(libraryErrorMessage("library_title_required", t));
      return;
    }
    if (!selectedFile) {
      setPanelError(libraryErrorMessage("library_file_required", t));
      return;
    }
    if (selectedFile.size > MAX_BYTES) {
      setPanelError(libraryErrorMessage("file_too_large", t));
      return;
    }

    setUploading(true);
    try {
      const { uploadUrl, item } = await prepareAdminLibraryUpload(token, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        locale: itemLocale,
        fileName: selectedFile.name,
        contentType: selectedFile.type || undefined,
        sizeBytes: selectedFile.size,
      });

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
        body: selectedFile,
      });
      if (!putRes.ok) throw new Error("library_upload_failed");

      setItems((prev) => [item, ...prev]);
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const code = (e as Error & { code?: string }).code ?? raw;
      setPanelError(libraryErrorMessage(code, t));
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (item: AdminLibraryItem) => {
    setEditId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditCategory((CATEGORIES.includes(item.category as (typeof CATEGORIES)[number]) ? item.category : "general") as (typeof CATEGORIES)[number]);
    setEditLocale(item.locale);
  };

  const saveEdit = () =>
    onRun(async () => {
      if (!editId) return;
      const { item } = await patchAdminLibraryItem(token, editId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        locale: editLocale,
      });
      setItems((prev) => prev.map((row) => (row.id === item.id ? item : row)));
      setEditId(null);
    });

  const toggleActive = (item: AdminLibraryItem) =>
    onRun(async () => {
      const { item: next } = await patchAdminLibraryItem(token, item.id, { active: !item.active });
      setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)));
    });

  const removeItem = (item: AdminLibraryItem) =>
    onRun(async () => {
      await deleteAdminLibraryItem(token, item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (editId === item.id) setEditId(null);
    });

  const categoryLabel = (value: string) => {
    const key = `admin.library.categories.${value}`;
    const label = t(key);
    return label === key ? value : label;
  };

  const localeLabel = (value: string) => {
    const key = `admin.library.locales.${value}`;
    const label = t(key);
    return label === key ? value : label;
  };

  return (
    <div className="admin-portal__library">
      <section className="admin-portal__card">
        <h2>{t("admin.library.uploadTitle")}</h2>
        <p className="admin-portal__muted">{t("admin.library.uploadLead")}</p>
        <div className="admin-portal__form-grid">
          <label>
            <span>{t("admin.library.title")}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading || busy} />
          </label>
          <label>
            <span>{t("admin.library.category")}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])} disabled={uploading || busy}>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("admin.library.locale")}</span>
            <select value={itemLocale} onChange={(e) => setItemLocale(e.target.value as (typeof LOCALES)[number])} disabled={uploading || busy}>
              {LOCALES.map((value) => (
                <option key={value} value={value}>
                  {localeLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-portal__form-span">
            <span>{t("admin.library.description")}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={uploading || busy} />
          </label>
          <label className="admin-portal__form-span admin-portal__file-label">
            <span>{t("admin.library.file")}</span>
            <input
              ref={inputRef}
              type="file"
              disabled={uploading || busy}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSelectedFile(file);
                setPanelError(null);
              }}
            />
            {selectedFile ? (
              <span className="admin-portal__muted">
                {t("admin.library.selectedFile", {
                  name: selectedFile.name,
                  size: formatBytes(selectedFile.size),
                })}
              </span>
            ) : null}
          </label>
        </div>
        <div className="admin-portal__library-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={uploading || busy || !title.trim() || !selectedFile}
            onClick={() => void submitUpload()}
          >
            {uploading ? t("admin.library.uploading") : t("admin.library.submit")}
          </button>
        </div>
        {panelError ? <p className="admin-portal__notice">{panelError}</p> : null}
      </section>

      <section className="admin-portal__card">
        <div className="admin-portal__card-head">
          <h2>{t("admin.library.listTitle")}</h2>
          <button type="button" className="btn btn-secondary" disabled={loading || busy} onClick={() => void refresh()}>
            {t("admin.refresh")}
          </button>
        </div>
        {loading ? (
          <p className="admin-portal__muted">{t("admin.loading")}</p>
        ) : items.length === 0 ? (
          <p className="admin-portal__muted">{t("admin.library.empty")}</p>
        ) : (
          <ul className="admin-portal__library-list">
            {items.map((item) => (
              <li key={item.id} className={item.active ? undefined : "is-inactive"}>
                {editId === item.id ? (
                  <div className="admin-portal__library-edit">
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label={t("admin.library.title")} />
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} aria-label={t("admin.library.description")} />
                    <div className="admin-portal__library-edit-row">
                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as (typeof CATEGORIES)[number])}>
                        {CATEGORIES.map((value) => (
                          <option key={value} value={value}>
                            {categoryLabel(value)}
                          </option>
                        ))}
                      </select>
                      <select value={editLocale} onChange={(e) => setEditLocale(e.target.value as (typeof LOCALES)[number])}>
                        {LOCALES.map((value) => (
                          <option key={value} value={value}>
                            {localeLabel(value)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-portal__library-actions">
                      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveEdit()}>
                        {t("admin.library.save")}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditId(null)}>
                        {t("admin.counselors.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-portal__library-row">
                      <strong>{item.title}</strong>
                      {!item.active ? <span className="admin-portal__badge">{t("admin.library.inactive")}</span> : null}
                    </div>
                    {item.description ? <p className="admin-portal__muted">{item.description}</p> : null}
                    <p className="admin-portal__muted">
                      {item.fileName}
                      {" · "}
                      {categoryLabel(item.category)}
                      {" · "}
                      {localeLabel(item.locale)}
                      {item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}
                      {" · "}
                      {formatWhen(item.updatedAt, locale)}
                    </p>
                    <div className="admin-portal__library-actions">
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => startEdit(item)}>
                        {t("admin.library.edit")}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void toggleActive(item)}>
                        {item.active ? t("admin.library.deactivate") : t("admin.library.activate")}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void removeItem(item)}>
                        {t("admin.library.delete")}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
