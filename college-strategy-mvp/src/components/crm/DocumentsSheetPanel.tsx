import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import type { CrmApplicationDocument } from "../../lib/crm/types";
import "./DocumentsSheetPanel.css";

type DocTypeKey = "recommendation" | "transcript" | "essay" | "general";

function resolveDocType(docType: string): DocTypeKey {
  const value = docType.trim().toLowerCase();
  if (value.includes("rec")) return "recommendation";
  if (value.includes("trans")) return "transcript";
  if (value.includes("essay")) return "essay";
  return "general";
}

function formatDueDate(value: string | undefined, locale: string): string {
  if (!value) return "—";
  const parsed = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dueVariant(dueAt?: string): "none" | "plain" | "soon" | "urgent" {
  if (!dueAt) return "none";
  const due = new Date(dueAt.length <= 10 ? `${dueAt}T12:00:00` : dueAt);
  if (Number.isNaN(due.getTime())) return "plain";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = (due.getTime() - today.getTime()) / 86_400_000;
  if (diffDays <= 1) return "urgent";
  if (diffDays <= 3) return "soon";
  return "plain";
}

type Props = {
  documents: CrmApplicationDocument[];
};

export function DocumentsSheetPanel({ documents }: Props) {
  const { t, locale } = useLanguage();

  const stats = useMemo(
    () => ({
      submitted: documents.filter((doc) => doc.status === "submitted" || doc.status === "done").length,
      needed: documents.filter((doc) => doc.status === "needed" || doc.status === "draft").length,
      total: documents.length,
    }),
    [documents],
  );

  const docTypeLabel = (docType: string) => {
    const key = resolveDocType(docType);
    return t(`crm.signedService.docType.${key}`);
  };

  const statusLabel = (status: CrmApplicationDocument["status"]) => {
    const label = t(`crm.signedService.docStatus.${status}`);
    return label;
  };

  const statusClass = (status: CrmApplicationDocument["status"]) => {
    if (status === "submitted" || status === "done") return "submitted";
    if (status === "draft") return "draft";
    return "needed";
  };

  return (
    <section className="doc-sheet" aria-labelledby="doc-sheet-title">
      <header className="doc-sheet__head">
        <div className="doc-sheet__intro">
          <h2 id="doc-sheet-title">{t("crm.signedService.documentsTitle")}</h2>
          <p>{t("crm.signedService.documentsLead")}</p>
        </div>
        <div className="doc-sheet__stats" aria-label={t("crm.signedService.docSheet.statsAria")}>
          <div className="doc-sheet__stat">
            <span className="doc-sheet__stat-value doc-sheet__stat-value--submitted">{stats.submitted}</span>
            <span className="doc-sheet__stat-label">{t("crm.signedService.docSheet.submitted")}</span>
          </div>
          <div className="doc-sheet__stat">
            <span className="doc-sheet__stat-value doc-sheet__stat-value--needed">{stats.needed}</span>
            <span className="doc-sheet__stat-label">{t("crm.signedService.docSheet.needed")}</span>
          </div>
          <div className="doc-sheet__stat">
            <span className="doc-sheet__stat-value doc-sheet__stat-value--total">{stats.total}</span>
            <span className="doc-sheet__stat-label">{t("crm.signedService.docSheet.total")}</span>
          </div>
        </div>
      </header>

      <div className="doc-sheet__table-wrap">
        <table className="doc-sheet__table">
          <thead>
            <tr>
              <th scope="col">{t("crm.signedService.colName")}</th>
              <th scope="col">{t("crm.signedService.colType")}</th>
              <th scope="col">{t("crm.signedService.colStatus")}</th>
              <th scope="col">{t("crm.signedService.colDue")}</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={4} className="doc-sheet__empty">
                  {t("crm.signedService.docSheet.empty")}
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const typeKey = resolveDocType(doc.docType);
                const statusKey = statusClass(doc.status);
                const due = dueVariant(doc.dueAt);
                return (
                  <tr key={doc.id}>
                    <td className="doc-sheet__name">{localizeCrmText(doc.name, locale, t)}</td>
                    <td>
                      <span className={`doc-sheet__type doc-sheet__type--${typeKey}`}>{docTypeLabel(doc.docType)}</span>
                    </td>
                    <td>
                      <span className={`doc-sheet__status doc-sheet__status--${statusKey}`}>
                        <span className={`doc-sheet__status-icon doc-sheet__status-icon--${statusKey}`} aria-hidden />
                        {statusLabel(doc.status)}
                      </span>
                    </td>
                    <td>
                      {due === "none" ? (
                        <span className="doc-sheet__due doc-sheet__due--none">—</span>
                      ) : (
                        <span className={`doc-sheet__due doc-sheet__due--${due}`}>
                          {due === "soon" || due === "urgent" ? (
                            <span className="doc-sheet__due-clock" aria-hidden />
                          ) : null}
                          {formatDueDate(doc.dueAt, locale)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
