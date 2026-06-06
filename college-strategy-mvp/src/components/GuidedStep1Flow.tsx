import type { ReactNode } from "react";
import type { FormState } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { getEffectiveIntake, INTAKE_OTHER_VALUE, INTAKE_PRESETS } from "../lib/intakeTerm";
import { GuidedFieldPicker } from "./guidedStepShared";

export type Step1ScreenId = "intake" | "identity" | "environment" | "budget";

type Updater = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

export function getStep1Screens(_form: FormState): Step1ScreenId[] {
  return ["intake", "identity", "environment", "budget"];
}

export function validateStep1Screen(screen: Step1ScreenId, f: FormState, tr: (path: string) => string): string | null {
  switch (screen) {
    case "intake":
      if (!getEffectiveIntake(f).trim()) return tr("validation.intake");
      return null;
    case "identity":
      if (!f.applicantIdentity) return tr("validation.identity");
      return null;
    case "environment":
      return null;
    case "budget":
      if (!f.budget) return tr("validation.budget");
      return null;
    default:
      return null;
  }
}

function ScreenShell({
  screenId,
  children,
  t,
}: {
  screenId: Step1ScreenId;
  children: ReactNode;
  t: Translate;
}) {
  return (
    <div className="guided-screen" key={screenId}>
      <p className="guided-screen__eyebrow">{t(`wizard.s1.screens.${screenId}.title`)}</p>
      {children}
    </div>
  );
}

function ContextLine({ screenId, t }: { screenId: Step1ScreenId; t: Translate }) {
  return <p className="guided-screen__context">{t(`wizard.s1.screens.${screenId}.context`)}</p>;
}

export function GuidedStep1Flow({
  screen,
  form,
  update,
  patchForm,
  t,
  useButtonPickers = false,
}: {
  screen: Step1ScreenId;
  form: FormState;
  update: Updater;
  patchForm?: (patch: Partial<FormState>) => void;
  t: Translate;
  useButtonPickers?: boolean;
}) {
  const choose = t("form.opt.choose");
  const intakeValue = (INTAKE_PRESETS as readonly string[]).includes(form.intakeTerm)
    ? form.intakeTerm
    : form.intakeTerm === INTAKE_OTHER_VALUE
      ? INTAKE_OTHER_VALUE
      : "";

  function setIntakeTerm(v: string) {
    if (patchForm) {
      if (v === INTAKE_OTHER_VALUE) patchForm({ intakeTerm: INTAKE_OTHER_VALUE });
      else patchForm({ intakeTerm: v, intakeOtherDetail: "" });
      return;
    }
    if (v === INTAKE_OTHER_VALUE) {
      update("intakeTerm", INTAKE_OTHER_VALUE);
    } else {
      update("intakeTerm", v);
      update("intakeOtherDetail", "");
    }
  }

  switch (screen) {
    case "intake":
      return (
        <ScreenShell screenId="intake" t={t}>
          <h2 className="guided-screen__question" id="gq-s1-intake">
            {t("wizard.s1.intake.q")}
          </h2>
          <ContextLine screenId="intake" t={t} />
          <GuidedFieldPicker
            id="intakeTerm"
            labelledBy="gq-s1-intake"
            value={intakeValue}
            placeholder={choose}
            useButtonPickers={useButtonPickers}
            options={[
              ...INTAKE_PRESETS.map((term) => ({ value: term, label: term })),
              { value: INTAKE_OTHER_VALUE, label: t("form.opt.intakeOther") },
            ]}
            onChange={setIntakeTerm}
          />
          {form.intakeTerm === INTAKE_OTHER_VALUE && (
            <div className="guided-screen__followup">
              <label className="field-sub-label" htmlFor="intakeOtherDetail">
                {t("form.intakeOtherLabel")}
              </label>
              <input
                id="intakeOtherDetail"
                className="input-modern input-modern--action"
                type="text"
                autoComplete="off"
                placeholder={t("form.placeholder.intakeOther")}
                value={form.intakeOtherDetail}
                onChange={(e) => update("intakeOtherDetail", e.target.value)}
              />
            </div>
          )}
        </ScreenShell>
      );

    case "identity":
      return (
        <ScreenShell screenId="identity" t={t}>
          <h2 className="guided-screen__question" id="gq-s1-id">
            {t("wizard.s1.identity.q")}
          </h2>
          <ContextLine screenId="identity" t={t} />
          <GuidedFieldPicker
            labelledBy="gq-s1-id"
            value={form.applicantIdentity}
            placeholder={choose}
            useButtonPickers={useButtonPickers}
            options={[
              { value: "intl", label: t("form.opt.idIntl") },
              { value: "us_citizen", label: t("form.opt.idUs") },
              { value: "other", label: t("form.opt.idOther") },
            ]}
            onChange={(v) => update("applicantIdentity", v)}
          />
        </ScreenShell>
      );

    case "environment":
      return (
        <ScreenShell screenId="environment" t={t}>
          <h2 className="guided-screen__question" id="gq-s1-env">
            {t("wizard.s1.environment.q")}
          </h2>
          <ContextLine screenId="environment" t={t} />
          <div className="guided-screen__field-stack">
            <div>
              <label className="field-sub-label" htmlFor="citizenship">
                {t("form.citizenship")}
              </label>
              <input
                id="citizenship"
                className="input-modern input-modern--action"
                type="text"
                autoComplete="country-name"
                placeholder={t("form.placeholder.citizenship")}
                value={form.citizenship ?? ""}
                onChange={(e) => update("citizenship", e.target.value)}
              />
            </div>
            <div>
              <label className="field-sub-label" htmlFor="residenceRegion">
                {t("form.residenceRegion")}
              </label>
              <input
                id="residenceRegion"
                className="input-modern input-modern--action"
                type="text"
                autoComplete="country-name"
                placeholder={t("form.placeholder.residenceRegion")}
                value={form.residenceRegion ?? ""}
                onChange={(e) => update("residenceRegion", e.target.value)}
              />
            </div>
          </div>
        </ScreenShell>
      );

    case "budget":
      return (
        <ScreenShell screenId="budget" t={t}>
          <h2 className="guided-screen__question" id="gq-s1-budget">
            {t("wizard.s1.budget.q")}
          </h2>
          <ContextLine screenId="budget" t={t} />
          <GuidedFieldPicker
            labelledBy="gq-s1-budget"
            value={form.budget}
            placeholder={choose}
            useButtonPickers={useButtonPickers}
            options={[
              { value: "full_pay", label: t("form.opt.budgetFull") },
              { value: "high_budget", label: t("form.opt.budgetHigh") },
              { value: "budget_cap", label: t("form.opt.budgetCap") },
              { value: "need_aid", label: t("form.opt.budgetAid") },
              { value: "unsure", label: t("form.opt.budgetUnsure") },
            ]}
            onChange={(v) => update("budget", v)}
          />
        </ScreenShell>
      );

    default:
      return null;
  }
}
