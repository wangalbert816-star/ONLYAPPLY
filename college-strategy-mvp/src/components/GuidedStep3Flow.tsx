import type { ActivityItem, FormState } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { ExportActivitiesCsvButton } from "./ExportActivitiesCsvButton";
import type { GuideTouch } from "./GuidedQuestionnaire";
import {
  DEALBREAKER_PRESET_KEYS,
  GuidedContextLine,
  GuidedScreenShell,
  createActivityItem,
  riskFeedback,
  splitPresetList,
  toggleDealbreakerPreset,
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
      if (f.activities.length > 600) return tr("validation.activitiesLen");
      return null;
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
}: {
  screen: Step3ScreenId;
  form: FormState;
  update: Updater;
  t: Translate;
  guideTouch: GuideTouch;
  markTouch: (k: keyof GuideTouch) => void;
}) {
  const actvTouched = Boolean(guideTouch.s3_actv);
  const structuredActivities = form.structuredActivities ?? [];

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
          <textarea
            id="actv"
            className="input-modern input-modern--action"
            maxLength={600}
            aria-labelledby="gq-s3-act"
            placeholder={t("form.placeholder.activities")}
            value={form.activities}
            onChange={(e) => update("activities", e.target.value)}
            onBlur={() => markTouch("s3_actv")}
          />
          <small className="guided-screen__char-count">{form.activities.length}/600</small>
          <button
            type="button"
            className="field-skip-btn"
            onClick={() => {
              update("activities", "");
              markTouch("s3_actv");
            }}
          >
            {t("wizard.s3.activities.skip")}
          </button>
          {actvTouched && (
            <p className="field-feedback">
              {form.activities.trim() ? t("wizard.s3.activities.fb") : t("wizard.s3.activities.fbEmpty")}
            </p>
          )}
          <details className="activity-builder activity-builder--guided" open={structuredActivities.length > 0}>
            <summary>
              <span>{t("wizard.s3.activities.detailTitle")}</span>
              <small>{t("wizard.s3.activities.detailHint")}</small>
            </summary>
            <div className="activity-builder__body">
              {structuredActivities.length === 0 ? (
                <p className="activity-builder__empty">{t("wizard.s3.activities.detailEmpty")}</p>
              ) : (
                structuredActivities.map((item, index) => (
                  <article className="activity-card" key={item.id}>
                    <div className="activity-card__head">
                      <strong>{t("wizard.s3.activities.cardTitle", { n: index + 1 })}</strong>
                      <button type="button" className="activity-card__remove" onClick={() => removeActivity(item.id)}>
                        {t("wizard.s3.activities.remove")}
                      </button>
                    </div>
                    <div className="activity-card__grid">
                      <label>
                        <span>{t("wizard.s3.activities.name")}</span>
                        <input
                          className="input-modern"
                          value={item.name}
                          onChange={(e) => updateActivity(item.id, { name: e.target.value })}
                          placeholder={t("wizard.s3.activities.namePh")}
                        />
                      </label>
                      <label>
                        <span>{t("wizard.s3.activities.kind")}</span>
                        <select
                          className="select-modern"
                          value={item.kind}
                          onChange={(e) => updateActivity(item.id, { kind: e.target.value as ActivityItem["kind"] })}
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          {(
                            ["activity", "competition", "research", "internship", "club", "service", "arts", "sports", "other"] as const
                          ).map((kind) => (
                            <option key={kind} value={kind}>
                              {t(`wizard.s3.activities.kindOpt.${kind}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>{t("wizard.s3.activities.grades")}</span>
                        <input
                          className="input-modern"
                          value={item.grades}
                          onChange={(e) => updateActivity(item.id, { grades: e.target.value })}
                          placeholder={t("wizard.s3.activities.gradesPh")}
                        />
                      </label>
                      <label>
                        <span>{t("wizard.s3.activities.hours")}</span>
                        <input
                          className="input-modern"
                          value={item.hours}
                          onChange={(e) => updateActivity(item.id, { hours: e.target.value })}
                          placeholder={t("wizard.s3.activities.hoursPh")}
                        />
                      </label>
                      <label>
                        <span>{t("wizard.s3.activities.role")}</span>
                        <input
                          className="input-modern"
                          value={item.role}
                          onChange={(e) => updateActivity(item.id, { role: e.target.value })}
                          placeholder={t("wizard.s3.activities.rolePh")}
                        />
                      </label>
                      <label>
                        <span>{t("wizard.s3.activities.scope")}</span>
                        <select
                          className="select-modern"
                          value={item.scope}
                          onChange={(e) => updateActivity(item.id, { scope: e.target.value as ActivityItem["scope"] })}
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          {(["school", "local", "regional", "state", "national", "international"] as const).map((scope) => (
                            <option key={scope} value={scope}>
                              {t(`wizard.s3.activities.scopeOpt.${scope}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="activity-card__full">
                      <span>{t("wizard.s3.activities.description")}</span>
                      <textarea
                        className="input-modern"
                        value={item.description}
                        onChange={(e) => updateActivity(item.id, { description: e.target.value })}
                        placeholder={t("wizard.s3.activities.descriptionPh")}
                      />
                    </label>
                    <div className="activity-card__grid">
                      <label>
                        <span>{t("wizard.s3.activities.outcome")}</span>
                        <input
                          className="input-modern"
                          value={item.outcome}
                          onChange={(e) => updateActivity(item.id, { outcome: e.target.value })}
                          placeholder={t("wizard.s3.activities.outcomePh")}
                        />
                      </label>
                      <label>
                        <span>{t("wizard.s3.activities.award")}</span>
                        <input
                          className="input-modern"
                          value={item.award}
                          onChange={(e) => updateActivity(item.id, { award: e.target.value })}
                          placeholder={t("wizard.s3.activities.awardPh")}
                        />
                      </label>
                      <label>
                        <span>{t("wizard.s3.activities.majorRelated")}</span>
                        <select
                          className="select-modern"
                          value={item.majorRelated}
                          onChange={(e) =>
                            updateActivity(item.id, { majorRelated: e.target.value as ActivityItem["majorRelated"] })
                          }
                        >
                          <option value="">{t("form.opt.choose")}</option>
                          <option value="yes">{t("wizard.s3.activities.majorYes")}</option>
                          <option value="no">{t("wizard.s3.activities.majorNo")}</option>
                          <option value="unsure">{t("wizard.s3.activities.majorUnsure")}</option>
                        </select>
                      </label>
                      <label>
                        <span>{t("wizard.s3.activities.proof")}</span>
                        <input
                          className="input-modern"
                          value={item.proof}
                          onChange={(e) => updateActivity(item.id, { proof: e.target.value })}
                          placeholder={t("wizard.s3.activities.proofPh")}
                        />
                      </label>
                    </div>
                  </article>
                ))
              )}
              <button type="button" className="activity-builder__add" onClick={addActivity}>
                {t("wizard.s3.activities.add")}
              </button>
              <ExportActivitiesCsvButton activities={structuredActivities} form={form} />
            </div>
          </details>
        </GuidedScreenShell>
      );

    case "risk":
      return (
        <GuidedScreenShell step={3} screenId="risk" t={t}>
          <h2 className="guided-screen__question" id="gq-s3-risk">
            {t("wizard.s3.risk.q")}
          </h2>
          <GuidedContextLine step={3} screenId="risk" t={t} />
          <select
            className="select-modern select-modern--action"
            aria-labelledby="gq-s3-risk"
            value={form.riskStyle}
            onChange={(e) => update("riskStyle", e.target.value as FormState["riskStyle"])}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="conservative">{t("form.opt.riskCon")}</option>
            <option value="balanced">{t("form.opt.riskBal")}</option>
            <option value="aggressive">{t("form.opt.riskAgg")}</option>
          </select>
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
