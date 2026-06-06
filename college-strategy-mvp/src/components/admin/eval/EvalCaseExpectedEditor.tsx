import { useEffect, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import {
  buildEvalCaseExpectedPatch,
  evalCaseToExpectedDraft,
  type EvalCaseExpectedDraft,
} from "../../../lib/admin/evalCaseForm";
import type { AdminEvalCase } from "../../../lib/admin/crmAdminApi";

type Props = {
  evalCase: AdminEvalCase;
  saving?: boolean;
  onSave: (patch: ReturnType<typeof buildEvalCaseExpectedPatch>) => Promise<void>;
};

export function EvalCaseExpectedEditor({ evalCase, saving, onSave }: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<EvalCaseExpectedDraft>(() => evalCaseToExpectedDraft(evalCase));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(evalCaseToExpectedDraft(evalCase));
    setDirty(false);
    setError(null);
  }, [evalCase]);

  function update<K extends keyof EvalCaseExpectedDraft>(key: K, value: EvalCaseExpectedDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    try {
      await onSave(buildEvalCaseExpectedPatch(draft));
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="admin-eval-case-expected" aria-label={t("admin.evalHarness.expectedAnswerTitle")}>
      <div className="admin-eval-case-expected__head">
        <div>
          <h5 className="admin-eval-case-expected__title">{t("admin.evalHarness.expectedAnswerTitle")}</h5>
          <p className="admin-eval-case-expected__lead">{t("admin.evalHarness.expectedAnswerLead")}</p>
        </div>
        <button
          type="button"
          className="admin-portal__btn admin-portal__btn--primary"
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
        >
          {saving ? t("admin.evalHarness.savingExpected") : t("admin.evalHarness.saveExpected")}
        </button>
      </div>
      <div className="admin-eval__form-grid admin-eval-case-expected__grid">
        <label className="admin-eval__span2">
          {t("admin.eval.reachSchools")}
          <textarea
            rows={2}
            value={draft.reachSchools}
            onChange={(e) => update("reachSchools", e.target.value)}
            placeholder={t("admin.eval.schoolsPlaceholder")}
            disabled={saving}
          />
        </label>
        <label className="admin-eval__span2">
          {t("admin.eval.matchSchools")}
          <textarea
            rows={2}
            value={draft.matchSchools}
            onChange={(e) => update("matchSchools", e.target.value)}
            placeholder={t("admin.eval.schoolsPlaceholder")}
            disabled={saving}
          />
        </label>
        <label className="admin-eval__span2">
          {t("admin.eval.safetySchools")}
          <textarea
            rows={2}
            value={draft.safetySchools}
            onChange={(e) => update("safetySchools", e.target.value)}
            placeholder={t("admin.eval.schoolsPlaceholder")}
            disabled={saving}
          />
        </label>
        <label className="admin-eval__span2">
          {t("admin.eval.forbiddenSchools")}
          <input
            value={draft.forbiddenSchools}
            onChange={(e) => update("forbiddenSchools", e.target.value)}
            placeholder={t("admin.eval.forbiddenPlaceholder")}
            disabled={saving}
          />
        </label>
        <label className="admin-eval__span2">
          {t("admin.eval.caseNotes")}
          <textarea
            rows={2}
            value={draft.notes}
            onChange={(e) => update("notes", e.target.value)}
            disabled={saving}
          />
        </label>
      </div>
      {error ? <p className="admin-portal__notice admin-eval-case-expected__error">{error}</p> : null}
    </section>
  );
}
