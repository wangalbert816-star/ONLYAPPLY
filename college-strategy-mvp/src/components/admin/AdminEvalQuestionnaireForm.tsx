import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import type { Locale } from "../../i18n/strings";
import type { FormState } from "../../types";
import type { EvalCaseDraft } from "../../lib/admin/evalCaseForm";
import {
  GuidedStep1Flow,
  getStep1Screens,
  validateStep1Screen,
  type Step1ScreenId,
} from "../GuidedStep1Flow";
import {
  GuidedStep2Flow,
  getStep2Screens,
  validateStep2Screen,
  type Step2ScreenId,
} from "../GuidedStep2Flow";
import {
  GuidedStep3Flow,
  getStep3Screens,
  validateStep3Screen,
  type Step3ScreenId,
} from "../GuidedStep3Flow";
import { FormLiveSummary, type GuideTouch } from "../GuidedQuestionnaire";
import { GuidedFormProgress } from "../guidedStepShared";
import "../GuidedQuestionnaire.css";
import "../FormLiveSummary.css";

type Props = {
  draft: EvalCaseDraft;
  onChange: (draft: EvalCaseDraft) => void;
  onSave: () => void;
  saving: boolean;
  disabled?: boolean;
};

export function AdminEvalQuestionnaireForm({ draft, onChange, onSave, saving, disabled }: Props) {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [step1Screen, setStep1Screen] = useState(0);
  const [step2Screen, setStep2Screen] = useState(0);
  const [step3Screen, setStep3Screen] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [guideTouch, setGuideTouch] = useState<GuideTouch>({});

  const form = draft.form;
  const step1Screens = useMemo(() => getStep1Screens(form), [form]);
  const step2Screens = useMemo(() => getStep2Screens(form), [form]);
  const step3Screens = useMemo(() => getStep3Screens(), []);

  const step1ScreenSafe = Math.min(step1Screen, Math.max(0, step1Screens.length - 1));
  const step1ScreenId = step1Screens[step1ScreenSafe] ?? "intake";
  const step1IsLastScreen = step === 1 && step1ScreenSafe >= step1Screens.length - 1;

  const step2ScreenSafe = Math.min(step2Screen, Math.max(0, step2Screens.length - 1));
  const step2ScreenId = step2Screens[step2ScreenSafe] ?? "gpa";
  const step2IsLastScreen = step === 2 && step2ScreenSafe >= step2Screens.length - 1;

  const step3ScreenSafe = Math.min(step3Screen, Math.max(0, step3Screens.length - 1));
  const step3ScreenId = step3Screens[step3ScreenSafe] ?? "activities";
  const step3IsLastScreen = step === 3 && step3ScreenSafe >= step3Screens.length - 1;

  const updateMeta = <K extends keyof Omit<EvalCaseDraft, "form">>(key: K, value: EvalCaseDraft[K]) => {
    onChange({ ...draft, [key]: value });
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    onChange({ ...draft, form: { ...draft.form, [key]: value } });
  };

  const markGuideTouch = (key: keyof GuideTouch) => {
    setGuideTouch((prev) => ({ ...prev, [key]: true }));
  };

  function touchOnStep2Leave(screenId: Step2ScreenId) {
    if (screenId === "gpa") markGuideTouch("s2_gpa");
    if (screenId === "major") markGuideTouch("s2_major");
    if (screenId === "major2") markGuideTouch("s2_major2");
  }

  function touchOnStep3Leave(screenId: Step3ScreenId) {
    if (screenId === "activities") markGuideTouch("s3_actv");
    if (screenId === "deal") markGuideTouch("s3_deal");
  }

  function next() {
    if (step === 1) {
      const screenId = step1Screens[step1ScreenSafe] as Step1ScreenId | undefined;
      if (!screenId) return;
      const e = validateStep1Screen(screenId, form, t);
      setErr(e);
      if (e) return;
      if (step1ScreenSafe < step1Screens.length - 1) {
        setStep1Screen((i) => i + 1);
        return;
      }
      setStep1Screen(0);
      setStep2Screen(0);
      setStep(2);
      return;
    }
    if (step === 2) {
      const screenId = step2Screens[step2ScreenSafe] as Step2ScreenId | undefined;
      if (!screenId) return;
      const e = validateStep2Screen(screenId, form, t);
      setErr(e);
      if (e) return;
      touchOnStep2Leave(screenId);
      if (step2ScreenSafe < step2Screens.length - 1) {
        setStep2Screen((i) => i + 1);
        return;
      }
      setStep2Screen(0);
      setStep3Screen(0);
      setStep(3);
      return;
    }
    if (step === 3) {
      const screenId = step3Screens[step3ScreenSafe] as Step3ScreenId | undefined;
      if (!screenId) return;
      const e = validateStep3Screen(screenId, form, t);
      setErr(e);
      if (e) return;
      touchOnStep3Leave(screenId);
      if (step3ScreenSafe < step3Screens.length - 1) {
        setStep3Screen((i) => i + 1);
        return;
      }
      setStep(4);
    }
  }

  function prev() {
    setErr(null);
    if (step === 4) {
      setStep(3);
      setStep3Screen(Math.max(0, step3Screens.length - 1));
      return;
    }
    if (step === 1 && step1Screen > 0) {
      setStep1Screen((i) => i - 1);
      return;
    }
    if (step === 2 && step2Screen > 0) {
      setStep2Screen((i) => i - 1);
      return;
    }
    if (step === 3 && step3Screen > 0) {
      setStep3Screen((i) => i - 1);
      return;
    }
    if (step === 2) {
      setStep(1);
      setStep1Screen(Math.max(0, step1Screens.length - 1));
      return;
    }
    if (step === 3) {
      setStep(2);
      setStep2Screen(Math.max(0, step2Screens.length - 1));
    }
  }

  return (
    <div className="admin-eval-questionnaire app--flow">
      <div className="admin-eval__meta-grid">
        <label>
          {t("admin.eval.caseName")}
          <input
            value={draft.title}
            onChange={(e) => updateMeta("title", e.target.value)}
            placeholder={t("admin.eval.caseNamePlaceholder")}
            disabled={disabled || saving}
          />
        </label>
        <label>
          {t("admin.eval.reportLanguage")}
          <select
            value={draft.locale}
            onChange={(e) => updateMeta("locale", e.target.value as Locale)}
            disabled={disabled || saving}
          >
            <option value="zh">{t("admin.eval.langZh")}</option>
            <option value="en">{t("admin.eval.langEn")}</option>
          </select>
        </label>
      </div>

      <p className="admin-eval__questionnaire-note">{t("admin.eval.questionnaireNote")}</p>

      <p className="steps-caption" aria-live="polite">
        {step <= 3 ? t("app.steps.caption", { step }) : t("admin.eval.expectedStepCaption")}
        {step === 3 ? t("app.steps.captionFinal") : step < 3 ? t("app.steps.captionMid") : ""}
      </p>

      <div className="steps" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`step-dot ${step >= n ? "on" : ""}`} />
        ))}
      </div>

      {step === 1 ? (
        <div className="card card--guided admin-eval-questionnaire__card">
          <GuidedFormProgress
            step={1}
            step1Screens={step1Screens}
            step2Screens={step2Screens}
            step3Screens={step3Screens}
            step1ScreenSafe={step1ScreenSafe}
            step2ScreenSafe={step2ScreenSafe}
            step3ScreenSafe={step3ScreenSafe}
            t={t}
          />
          <GuidedStep1Flow screen={step1ScreenId} form={form} update={update} t={t} />
          <div className="flow-step-foot">
            {err ? <div className="error">{err}</div> : null}
            <div className="actions actions--guided actions--above-snapshot">
              {step1ScreenSafe > 0 ? (
                <button type="button" className="btn btn-secondary" onClick={prev} disabled={saving || disabled}>
                  {t("app.actions.prev")}
                </button>
              ) : null}
              <button type="button" className="btn btn-primary btn-primary--guided" onClick={next} disabled={saving || disabled}>
                {step1IsLastScreen ? t("app.actions.step1Finish") : t("app.actions.step1Next")}
              </button>
            </div>
            <FormLiveSummary form={form} t={t} step={1} step1ScreenId={step1ScreenId} />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="card card--guided admin-eval-questionnaire__card">
          <GuidedFormProgress
            step={2}
            step1Screens={step1Screens}
            step2Screens={step2Screens}
            step3Screens={step3Screens}
            step1ScreenSafe={step1ScreenSafe}
            step2ScreenSafe={step2ScreenSafe}
            step3ScreenSafe={step3ScreenSafe}
            t={t}
          />
          <GuidedStep2Flow
            screen={step2ScreenId}
            form={form}
            update={update}
            t={t}
            guideTouch={guideTouch}
            markTouch={markGuideTouch}
            onSkipAdvance={() => {
              setErr(null);
              next();
            }}
          />
          <div className="flow-step-foot">
            {err ? <div className="error">{err}</div> : null}
            <div className="actions actions--guided actions--above-snapshot">
              <button type="button" className="btn btn-secondary" onClick={prev} disabled={saving || disabled}>
                {t("app.actions.prev")}
              </button>
              <button type="button" className="btn btn-primary btn-primary--guided" onClick={next} disabled={saving || disabled}>
                {step2IsLastScreen ? t("app.actions.step2Finish") : t("app.actions.step2Next")}
              </button>
            </div>
            <FormLiveSummary form={form} t={t} step={2} step2ScreenId={step2ScreenId} />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="card card--guided admin-eval-questionnaire__card">
          <GuidedFormProgress
            step={3}
            step1Screens={step1Screens}
            step2Screens={step2Screens}
            step3Screens={step3Screens}
            step1ScreenSafe={step1ScreenSafe}
            step2ScreenSafe={step2ScreenSafe}
            step3ScreenSafe={step3ScreenSafe}
            t={t}
          />
          <GuidedStep3Flow
            screen={step3ScreenId}
            form={form}
            update={update}
            t={t}
            guideTouch={guideTouch}
            markTouch={markGuideTouch}
            onSkipAdvance={() => {
              setErr(null);
              next();
            }}
          />
          <div className="flow-step-foot">
            {err ? <div className="error">{err}</div> : null}
            <div className="actions actions--guided actions--above-snapshot">
              <button type="button" className="btn btn-secondary" onClick={prev} disabled={saving || disabled}>
                {t("app.actions.prev")}
              </button>
              <button type="button" className="btn btn-primary btn-primary--guided" onClick={next} disabled={saving || disabled}>
                {step3IsLastScreen ? t("admin.eval.expectedStepNext") : t("app.actions.step3Next")}
              </button>
            </div>
            <FormLiveSummary form={form} t={t} step={3} step3ScreenId={step3ScreenId} />
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="card card--guided admin-eval-questionnaire__card admin-eval-questionnaire__expected">
          <h3 className="admin-eval__heading">{t("admin.eval.expectedStepTitle")}</h3>
          <p className="admin-eval__sub">{t("admin.eval.expectedStepLead")}</p>
          <div className="admin-eval__form-grid">
            <label className="admin-eval__span2">
              {t("admin.eval.reachSchools")}
              <textarea
                rows={2}
                value={draft.reachSchools}
                onChange={(e) => updateMeta("reachSchools", e.target.value)}
                placeholder={t("admin.eval.schoolsPlaceholder")}
                disabled={disabled || saving}
              />
            </label>
            <label className="admin-eval__span2">
              {t("admin.eval.matchSchools")}
              <textarea
                rows={2}
                value={draft.matchSchools}
                onChange={(e) => updateMeta("matchSchools", e.target.value)}
                placeholder={t("admin.eval.schoolsPlaceholder")}
                disabled={disabled || saving}
              />
            </label>
            <label className="admin-eval__span2">
              {t("admin.eval.safetySchools")}
              <textarea
                rows={2}
                value={draft.safetySchools}
                onChange={(e) => updateMeta("safetySchools", e.target.value)}
                placeholder={t("admin.eval.schoolsPlaceholder")}
                disabled={disabled || saving}
              />
            </label>
            <label className="admin-eval__span2">
              {t("admin.eval.forbiddenSchools")}
              <input
                value={draft.forbiddenSchools}
                onChange={(e) => updateMeta("forbiddenSchools", e.target.value)}
                placeholder={t("admin.eval.forbiddenPlaceholder")}
                disabled={disabled || saving}
              />
            </label>
            <label className="admin-eval__span2">
              {t("admin.eval.caseNotes")}
              <textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => updateMeta("notes", e.target.value)}
                disabled={disabled || saving}
              />
            </label>
          </div>
          {err ? <div className="error">{err}</div> : null}
          <div className="actions actions--guided">
            <button type="button" className="btn btn-secondary" onClick={prev} disabled={saving || disabled}>
              {t("app.actions.prev")}
            </button>
            <button
              type="button"
              className="admin-portal__btn admin-portal__btn--primary"
              disabled={saving || disabled}
              onClick={() => {
                if (!draft.title.trim()) {
                  setErr(t("admin.errors.eval_title_required"));
                  return;
                }
                setErr(null);
                onSave();
              }}
            >
              {saving ? t("admin.eval.savingCase") : t("admin.eval.saveCase")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
