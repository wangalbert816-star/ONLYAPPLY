import { useEffect } from "react";
import type { ActivityItem, FormState } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { ExportActivitiesCsvButton } from "./ExportActivitiesCsvButton";
import { ActivityCard } from "./ActivityCard";
import type { GuideTouch } from "./GuidedQuestionnaire";
import {
  DEALBREAKER_PRESET_KEYS,
  GuidedContextLine,
  GuidedFieldPicker,
  GuidedScreenShell,
  activityItemMeetsWizardRequirement,
  createActivityItem,
  riskFeedback,
  splitPresetList,
  toggleDealbreakerPreset,
  validateStructuredActivities,
} from "./guidedStepShared";

export type Step3ScreenId = "activities" | "risk" | "deal";

type Updater = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

const STEP3_SCREENS: Step3ScreenId[] = ["activities", "risk", "deal"];

export function getStep3Screens(): Step3ScreenId[] {
  return STEP3_SCREENS;
}

export function validateStep3Screen(screen: Step3ScreenId, f: FormState, tr: (path: string) => string): string | null {
  switch (screen) {
    case "activities":
      return validateStructuredActivities(f, tr);
    case "risk":
      if (!f.riskStyle) return tr("validation.risk");
      return null;
    case "deal":
      return null;
    default:
      return null;
  }
}

export function GuidedStep3Flow({
  screen,
  form,
  update,
  t,
  guideTouch,
  markTouch,
  onSkipAdvance,
  useButtonPickers = false,
}: {
  screen: Step3ScreenId;
  form: FormState;
  update: Updater;
  t: Translate;
  guideTouch: GuideTouch;
  markTouch: (k: keyof GuideTouch) => void;
  onSkipAdvance: () => void;
  useButtonPickers?: boolean;
}) {
  const choose = t("form.opt.choose");
  const structuredActivities = form.structuredActivities ?? [];

  useEffect(() => {
    if (screen !== "activities") return;
    if ((form.structuredActivities ?? []).length > 0) return;
    update("structuredActivities", [createActivityItem()]);
  }, [screen]);

  function updateActivity(id: string, patch: Partial<ActivityItem>) {
    update(
      "structuredActivities",
      structuredActivities.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addActivity() {
    update("structuredActivities", [...structuredActivities, createActivityItem()]);
    markTouch("s3_actv");
  }

  function removeActivity(id: string) {
    update(
      "structuredActivities",
      structuredActivities.filter((item) => item.id !== id),
    );
  }

  switch (screen) {
    case "activities":
      return (
        <GuidedScreenShell step={3} screenId="activities" t={t}>
          <h2 className="guided-screen__question" id="gq-s3-act">
            {t("wizard.s3.activities.q")}
          </h2>
          <GuidedContextLine step={3} screenId="activities" t={t} />
          <p className="activity-builder__required-note">{t("wizard.s3.activities.detailHint")}</p>
          <div className="activity-builder activity-builder--guided activity-builder--open">
            <div className="activity-builder__body">
              {structuredActivities.map((item, index) => (
                <ActivityCard
                  key={item.id}
                  item={item}
                  index={index}
                  incomplete={!activityItemMeetsWizardRequirement(item)}
                  showRemove={structuredActivities.length > 1}
                  onChange={(patch) => updateActivity(item.id, patch)}
                  onRemove={() => removeActivity(item.id)}
                  t={t}
                />
              ))}
              <button type="button" className="activity-builder__add" onClick={addActivity}>
                {t("wizard.s3.activities.add")}
              </button>
              <ExportActivitiesCsvButton activities={structuredActivities} form={form} />
            </div>
          </div>
        </GuidedScreenShell>
      );

    case "risk":
      return (
        <GuidedScreenShell step={3} screenId="risk" t={t}>
          <h2 className="guided-screen__question" id="gq-s3-risk">
            {t("wizard.s3.risk.q")}
          </h2>
          <GuidedContextLine step={3} screenId="risk" t={t} />
          <GuidedFieldPicker
            labelledBy="gq-s3-risk"
            value={form.riskStyle}
            placeholder={choose}
            useButtonPickers={useButtonPickers}
            options={[
              { value: "conservative", label: t("form.opt.riskCon") },
              { value: "balanced", label: t("form.opt.riskBal") },
              { value: "aggressive", label: t("form.opt.riskAgg") },
            ]}
            onChange={(v) => update("riskStyle", v)}
          />
          {(() => {
            const fb = riskFeedback(form, t);
            return fb ? <p className="field-feedback">{fb}</p> : null;
          })()}
        </GuidedScreenShell>
      );

    case "deal":
      return (
        <GuidedScreenShell step={3} screenId="deal" t={t}>
          <h2 className="guided-screen__question" id="gq-s3-deal">
            {t("wizard.s3.deal.q")}
          </h2>
          <GuidedContextLine step={3} screenId="deal" t={t} />
          <div className="major-preset-group" aria-label={t("wizard.s3.deal.presetLabel")}>
            <p className="major-preset-group__label">{t("wizard.s3.deal.presetLabel")}</p>
            <div className="major-preset-group__options">
              {DEALBREAKER_PRESET_KEYS.map((key) => {
                const label = t(`wizard.s3.deal.presets.${key}`);
                const selected =
                  key === "none"
                    ? form.dealbreakers.trim() === label
                    : splitPresetList(form.dealbreakers).includes(label);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`major-preset${selected ? " major-preset--selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => {
                      const noneLabel = t("wizard.s3.deal.presets.none");
                      update("dealbreakers", toggleDealbreakerPreset(form.dealbreakers, label, noneLabel));
                      markTouch("s3_deal");
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="field-sub-label">{t("wizard.s3.deal.customLabel")}</p>
          <input
            id="deal"
            className="input-modern input-modern--action"
            type="text"
            aria-labelledby="gq-s3-deal"
            placeholder={t("form.placeholder.deal")}
            value={form.dealbreakers}
            onChange={(e) => update("dealbreakers", e.target.value)}
            onBlur={() => markTouch("s3_deal")}
          />
          <button
            type="button"
            className="field-skip-btn"
            onClick={() => {
              update("dealbreakers", t("wizard.s3.deal.presets.none"));
              markTouch("s3_deal");
              onSkipAdvance();
            }}
          >
            {t("wizard.s3.deal.skip")}
          </button>
          {guideTouch.s3_deal && (
            <p className="field-feedback">
              {form.dealbreakers.trim() ? t("wizard.s3.deal.fb") : t("wizard.s3.deal.fbSkip")}
            </p>
          )}
        </GuidedScreenShell>
      );

    default:
      return null;
  }
}
