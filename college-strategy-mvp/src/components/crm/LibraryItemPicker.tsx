import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { attachLibraryItemToCase, getCrmBackend, listLibraryItems } from "../../lib/crm/store";
import { openGoogleLibraryLink } from "../../lib/crm/libraryLinks";
import type { CrmLibraryItem } from "../../lib/crm/types";

function formatBytes(bytes: number | undefined) {
  if (bytes == null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SelectProps = {
  mode: "select";
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
  showHeading?: boolean;
};

type AttachProps = {
  mode: "attach";
  engagementId: string;
  onAttached: () => void;
  showHeading?: boolean;
};

type Props = SelectProps | AttachProps;

function categoryLabel(value: string, t: (key: string) => string) {
  const key = `crm.library.categories.${value}`;
  const label = t(key);
  return label === key ? value : label;
}

function shouldShowDescription(item: CrmLibraryItem) {
  const description = item.description?.trim();
  if (!description) return false;
  if (description === item.title.trim()) return false;
  if (item.fileName && description === item.fileName.trim()) return false;
  if (item.externalUrl && description === item.externalUrl.trim()) return false;
  return true;
}

function itemMetaLine(item: CrmLibraryItem, t: (key: string) => string) {
  if (item.itemKind === "link") {
    return [t("crm.library.kindLink"), categoryLabel(item.category, t)].join(" · ");
  }
  const parts = [item.fileName, categoryLabel(item.category, t)];
  if (item.sizeBytes) parts.push(formatBytes(item.sizeBytes));
  return parts.join(" · ");
}

export function LibraryItemPicker(props: Props) {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<CrmLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const showHeading = props.showHeading ?? true;

  const canUse = getCrmBackend() === "supabase";

  useEffect(() => {
    if (!canUse) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await listLibraryItems();
        if (!cancelled) setItems(next);
      } catch {
        if (!cancelled) setError(t("crm.library.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canUse, t]);

  const visibleItems = useMemo(
    () => items.filter((item) => item.locale === "all" || item.locale === locale),
    [items, locale],
  );

  const hasLinkItems = useMemo(
    () => visibleItems.some((item) => item.itemKind === "link" && item.externalUrl),
    [visibleItems],
  );

  const toggleSelect = (itemId: string) => {
    if (props.mode !== "select" || props.disabled) return;
    const next = props.selectedIds.includes(itemId)
      ? props.selectedIds.filter((id) => id !== itemId)
      : [...props.selectedIds, itemId];
    props.onSelectionChange(next);
  };

  const attach = async (item: CrmLibraryItem) => {
    if (props.mode !== "attach" || busyId) return;
    setBusyId(item.id);
    setError(null);
    setSuccess(null);
    try {
      await attachLibraryItemToCase({
        engagementId: props.engagementId,
        libraryItemId: item.id,
        uploadedByRole: "counselor",
      });
      setSuccess(t("crm.library.attachSuccess", { name: item.title }));
      props.onAttached();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const key = `crm.library.errors.${raw}`;
      const localized = t(key);
      setError(localized === key ? t("crm.library.attachFailed") : localized);
    } finally {
      setBusyId(null);
    }
  };

  if (!canUse) return null;

  const pickerClass =
    props.mode === "select" ? "library-item-picker library-item-picker--compact" : "library-item-picker";

  return (
    <section className={pickerClass}>
      {showHeading ? (
        <>
          <h3>{props.mode === "select" ? t("crm.library.taskAttachTitle") : t("crm.library.title")}</h3>
          <p className="signed-service-hub__muted">
            {props.mode === "select" ? t("crm.library.taskAttachLead") : t("crm.library.lead")}
          </p>
          {props.mode === "attach" && hasLinkItems ? (
            <p className="signed-service-hub__muted">{t("crm.library.copyLead")}</p>
          ) : null}
        </>
      ) : null}
      {loading ? <p className="signed-service-hub__muted">{t("crm.library.loading")}</p> : null}
      {!loading && visibleItems.length === 0 ? (
        <p className="signed-service-hub__muted">{t("crm.library.empty")}</p>
      ) : null}
      {!loading && visibleItems.length > 0 ? (
        <ul className="library-item-picker__list">
          {visibleItems.map((item) => (
            <li key={item.id}>
              {props.mode === "select" ? (
                <label className="library-item-picker__select">
                  <input
                    type="checkbox"
                    checked={props.selectedIds.includes(item.id)}
                    disabled={props.disabled}
                    onChange={() => toggleSelect(item.id)}
                  />
                  <span className="library-item-picker__body">
                    <span className="library-item-picker__title">{item.title}</span>
                    {shouldShowDescription(item) ? (
                      <span className="library-item-picker__desc">{item.description}</span>
                    ) : null}
                    <span className="library-item-picker__meta">{itemMetaLine(item, t)}</span>
                  </span>
                </label>
              ) : (
                  <div className="library-item-picker__row">
                  <div className="library-item-picker__body">
                    <span className="library-item-picker__title">{item.title}</span>
                    {shouldShowDescription(item) ? (
                      <span className="library-item-picker__desc">{item.description}</span>
                    ) : null}
                    <span className="library-item-picker__meta">{itemMetaLine(item, t)}</span>
                  </div>
                  <div className="library-item-picker__actions">
                    {item.itemKind === "link" && item.externalUrl ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openGoogleLibraryLink(item.externalUrl!)}
                      >
                        {t("crm.library.makeCopy")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busyId === item.id}
                      onClick={() => void attach(item)}
                    >
                      {busyId === item.id ? t("crm.library.attaching") : t("crm.library.attach")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {success ? <p className="case-files-panel__success">{success}</p> : null}
      {error ? <p className="case-files-panel__error">{error}</p> : null}
    </section>
  );
}
