import type { ReactNode } from "react";
import type { FormState } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { getEffectiveIntake, INTAKE_OTHER_VALUE, INTAKE_PRESETS } from "../lib/intakeTerm";

export type Step1ScreenId = "intake" | "identity" | "environment" | "budget" | "testing" | "scores";

type Updater = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

export function getStep1Screens(form: FormState): Step1ScreenId[] {
  const screens: Step1ScreenId[] = ["intake", "identity", "environment", "budget", "testing"];
  if (form.testing === "will_submit") screens.push("scores");
  return screens;
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
    case "testing":
      if (!f.testing) return tr("validation.testing");
      return null;
    case "scores": {
      if (f.testing !== "will_submit") return null;
      const hasSat = f.satScore.trim().length > 0;
      const hasAct = f.actScore.trim().length > 0;
      if (!hasSat && !hasAct) return tr("validation.testScore");
      return null;
    }
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
  t,
}: {
  screen: Step1ScreenId;
  form: FormState;
  update: Updater;
  t: Translate;
}) {
  switch (screen) {
    case "intake":
      return (
        <ScreenShell screenId="intake" t={t}>
          <h2 className="guided-screen__question" id="gq-s1-intake">
            {t("wizard.s1.intake.q")}
          </h2>
          <ContextLine screenId="intake" t={t} />
          <select
            className="select-modern select-modern--action"
            id="intakeTerm"
            aria-labelledby="gq-s1-intake"
            value={
              (INTAKE_PRESETS as readonly string[]).includes(form.intakeTerm)
                ? form.intakeTerm
                : form.intakeTerm === INTAKE_OTHER_VALUE
                  ? INTAKE_OTHER_VALUE
                  : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === INTAKE_OTHER_VALUE) {
                update("intakeTerm", INTAKE_OTHER_VALUE);
              } else {
                update("intakeTerm", v);
                update("intakeOtherDetail", "");
              }
            }}
          >
            <option value="">{t("form.opt.choose")}</option>
            {INTAKE_PRESETS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
            <option value={INTAKE_OTHER_VALUE}>{t("form.opt.intakeOther")}</option>
          </select>
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
          <select
            className="select-modern select-modern--action"
            aria-labelledby="gq-s1-id"
            value={form.applicantIdentity}
            onChange={(e) => update("applicantIdentity", e.target.value as FormState["applicantIdentity"])}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="intl">{t("form.opt.idIntl")}</option>
            <option value="us_citizen">{t("form.opt.idUs")}</option>
            <option value="other">{t("form.opt.idOther")}</option>
          </select>
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
          <select
            className="select-modern select-modern--action"
            aria-labelledby="gq-s1-budget"
            value={form.budget}
            onChange={(e) => update("budget", e.target.value as FormState["budget"])}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="full_pay">{t("form.opt.budgetFull")}</option>
            <option value="high_budget">{t("form.opt.budgetHigh")}</option>
            <option value="budget_cap">{t("form.opt.budgetCap")}</option>
            <option value="need_aid">{t("form.opt.budgetAid")}</option>
            <option value="unsure">{t("form.opt.budgetUnsure")}</option>
          </select>
        </ScreenShell>
      );

    case "testing":
      return (
        <ScreenShell screenId="testing" t={t}>
          <h2 className="guided-screen__question" id="gq-s1-test">
            {t("wizard.s1.testing.q")}
          </h2>
          <ContextLine screenId="testing" t={t} />
          <select
            className="select-modern select-modern--action"
            aria-labelledby="gq-s1-test"
            value={form.testing}
            onChange={(e) => update("testing", e.target.value as FormState["testing"])}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="test_optional">{t("form.opt.testOpt")}</option>
            <option value="will_submit">{t("form.opt.testSubmit")}</option>
          </select>
        </ScreenShell>
      );

    case "scores":
      return (
        <ScreenShell screenId="scores" t={t}>
          <h2 className="guided-screen__question" id="gq-s1-scores">
            {t("wizard.s1.scores.q")}
          </h2>
          <ContextLine screenId="scores" t={t} />
          <div className="guided-screen__field-stack guided-screen__field-stack--pair">
            <div>
              <label className="field-sub-label" htmlFor="sat">
                {t("form.sat")}
              </label>
              <input
                id="sat"
                className="input-modern input-modern--action"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("form.placeholder.sat")}
                value={form.satScore}
                onChange={(e) => update("satScore", e.target.value)}
              />
            </div>
            <div>
              <label className="field-sub-label" htmlFor="act">
                {t("form.act")}
              </label>
              <input
                id="act"
                className="input-modern input-modern--action"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("form.placeholder.act")}
                value={form.actScore}
                onChange={(e) => update("actScore", e.target.value)}
              />
            </div>
          </div>
        </ScreenShell>
      );

    default:
      return null;
  }
}
