import type { AdminEvalCase, AdminEvalRunResult } from "../../../lib/admin/crmAdminApi";
import { useLanguage, type Translate } from "../../../i18n/LanguageContext";
import { getEvalCaseTitle } from "../../../lib/admin/evalCaseDisplay";

export type CaseListStatus = "none" | "generated" | "draft" | "submitted" | "approved" | "error";

type Props = {
  cases: AdminEvalCase[];
  selectedId?: string;
  results?: AdminEvalRunResult[];
  onSelect: (caseId: string) => void;
  t: Translate;
  compact?: boolean;
};

export function resultStatusForCase(caseId: string, results?: AdminEvalRunResult[]): CaseListStatus {
  const row = results?.find((r) => r.caseId === caseId);
  if (!row) return "none";
  if (row.status === "error") return "error";
  if (row.status !== "ok") return "none";
  if (row.review?.status === "approved") return "approved";
  if (row.review?.status === "submitted") return "submitted";
  if (row.review?.status === "draft") return "draft";
  return "generated";
}

function statusLabel(status: CaseListStatus, t: Translate) {
  if (status === "generated") return t("admin.evalHarness.caseStatusGenerated");
  if (status === "draft") return t("admin.evalHarness.draftStatus");
  if (status === "submitted") return t("admin.evalHarness.submitted");
  if (status === "approved") return t("admin.evalHarness.approved");
  if (status === "error") return t("admin.eval.generateError");
  return t("admin.evalHarness.caseStatusNone");
}

function schoolSummary(c: AdminEvalCase) {
  return {
    reach: c.expectedReach.map((s) => s.school).filter(Boolean).slice(0, 3).join(", ") || "—",
    match: c.expectedMatch.map((s) => s.school).filter(Boolean).slice(0, 3).join(", ") || "—",
    safety: c.expectedSafety.map((s) => s.school).filter(Boolean).slice(0, 3).join(", ") || "—",
  };
}

export function EvalCaseList({ cases, selectedId, results, onSelect, t, compact }: Props) {
  const { locale } = useLanguage();
  if (!cases.length) return null;

  return (
    <ul className={`admin-eval-case-list${compact ? " admin-eval-case-list--compact" : ""}`}>
      {cases.map((c) => {
        const status = resultStatusForCase(c.id, results);
        const schools = schoolSummary(c);
        const active = selectedId === c.id;
        return (
          <li key={c.id}>
            <button
              type="button"
              className={`admin-eval-case-list__item${active ? " admin-eval-case-list__item--active" : ""}`}
              onClick={() => onSelect(c.id)}
            >
              <div className="admin-eval-case-list__head">
                <strong>{getEvalCaseTitle(c, locale)}</strong>
                <span className={`admin-eval-case-list__status admin-eval-case-list__status--${status}`}>
                  {statusLabel(status, t)}
                </span>
              </div>
              {!compact ? (
                <>
                  <span className="admin-eval-case-list__meta">{c.caseKey}</span>
                  <span className="admin-eval-case-list__schools">
                    {t("admin.eval.savedSchoolsHint", schools)}
                  </span>
                </>
              ) : null}
              <span className="admin-eval-case-list__enter">{t("admin.evalHarness.openCase")}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
