import type { AdminEvalCase, AdminEvalRunResult } from "../../../lib/admin/crmAdminApi";
import type { buildEvalCaseExpectedPatch } from "../../../lib/admin/evalCaseForm";
import type { Translate } from "../../../i18n/LanguageContext";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getEvalCaseTitle } from "../../../lib/admin/evalCaseDisplay";
import { EvalCaseExpectedEditor } from "./EvalCaseExpectedEditor";
import { EvalCaseFormSummary } from "./EvalCaseFormSummary";
import { resultStatusForCase, type CaseListStatus } from "./EvalCaseList";

type Props = {
  evalCase: AdminEvalCase;
  results?: AdminEvalRunResult[];
  t: Translate;
  onBack: () => void;
  onDelete?: () => void;
  onGenerate?: () => void;
  onReview?: () => void;
  onSaveExpected?: (patch: ReturnType<typeof buildEvalCaseExpectedPatch>) => Promise<void>;
  savingExpected?: boolean;
  deleting?: boolean;
};

function statusLabel(status: CaseListStatus, t: Translate) {
  if (status === "generated") return t("admin.evalHarness.caseStatusGenerated");
  if (status === "draft") return t("admin.evalHarness.draftStatus");
  if (status === "submitted") return t("admin.evalHarness.submitted");
  if (status === "approved") return t("admin.evalHarness.approved");
  if (status === "error") return t("admin.eval.generateError");
  return t("admin.evalHarness.caseStatusNone");
}

export function EvalCaseDetail({
  evalCase,
  results,
  t,
  onBack,
  onDelete,
  onGenerate,
  onReview,
  onSaveExpected,
  savingExpected,
  deleting,
}: Props) {
  const { locale } = useLanguage();
  const status = resultStatusForCase(evalCase.id, results);
  const canReview = status === "generated" || status === "draft" || status === "submitted" || status === "approved";

  return (
    <div className="admin-eval-case-detail">
      <button type="button" className="admin-eval-case-detail__back admin-portal__btn admin-portal__btn--ghost" onClick={onBack}>
        {t("admin.evalHarness.backToList")}
      </button>
      <div className="admin-eval-case-detail__head">
        <h4>{getEvalCaseTitle(evalCase, locale)}</h4>
        <span className={`admin-eval-case-list__status admin-eval-case-list__status--${status}`}>
          {statusLabel(status, t)}
        </span>
      </div>
      <p className="admin-eval-case-detail__meta">{evalCase.caseKey}</p>
      {onSaveExpected ? (
        <EvalCaseExpectedEditor evalCase={evalCase} saving={savingExpected} onSave={onSaveExpected} />
      ) : (
        <dl className="admin-eval-case-detail__schools">
          <div>
            <dt>{t("admin.eval.reachLabel")}</dt>
            <dd>{evalCase.expectedReach.map((s) => s.school).filter(Boolean).join("、") || "—"}</dd>
          </div>
          <div>
            <dt>{t("admin.eval.matchLabel")}</dt>
            <dd>{evalCase.expectedMatch.map((s) => s.school).filter(Boolean).join("、") || "—"}</dd>
          </div>
          <div>
            <dt>{t("admin.eval.safetyLabel")}</dt>
            <dd>{evalCase.expectedSafety.map((s) => s.school).filter(Boolean).join("、") || "—"}</dd>
          </div>
        </dl>
      )}
      <EvalCaseFormSummary evalCase={evalCase} />
      <div className="admin-eval-case-detail__actions">
        {onGenerate ? (
          <button type="button" className="admin-portal__btn admin-portal__btn--primary admin-portal__btn--lg" onClick={onGenerate}>
            {t("admin.evalHarness.generateForCase")}
          </button>
        ) : null}
        {canReview && onReview ? (
          <button type="button" className="admin-portal__btn admin-portal__btn--submit admin-portal__btn--lg" onClick={onReview}>
            {t("admin.evalHarness.reviewForCase")}
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" className="admin-portal__btn admin-portal__btn--ghost" disabled={deleting} onClick={onDelete}>
            {t("admin.eval.delete")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
