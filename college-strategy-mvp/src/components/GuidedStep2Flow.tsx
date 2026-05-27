import type { CampusCulturePref, FormState } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import type { GuideTouch } from "./GuidedQuestionnaire";
import {
  GuidedContextLine,
  GuidedScreenShell,
  MAJOR_PRESET_KEYS,
  cultureFeedback,
  hsFeedback,
  sizeFeedback,
  toggleGeo,
} from "./guidedStepShared";

export type Step2ScreenId = "hs" | "gpa" | "major" | "major2" | "size" | "culture" | "geo";

type Updater = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

const STEP2_SCREENS: Step2ScreenId[] = ["hs", "gpa", "major", "major2", "size", "culture", "geo"];

export function getStep2Screens(): Step2ScreenId[] {
  return STEP2_SCREENS;
}

export function validateStep2Screen(screen: Step2ScreenId, f: FormState, tr: (path: string) => string): string | null {
  switch (screen) {
    case "hs":
      if (!f.highSchoolSystem) return tr("validation.hs");
      return null;
    case "gpa":
      if (!f.gpa.trim()) return tr("validation.gpa");
      return null;
    case "major":
      if (!f.majorPrimary.trim()) return tr("validation.major");
      return null;
    case "major2":
      return null;
    case "size":
      if (!f.schoolSize) return tr("validation.schoolSize");
      return null;
    case "culture":
      if (!f.campusCulturePref) return tr("validation.campusCulture");
      return null;
    case "geo":
      if (f.geoPrefs.length === 0) return tr("validation.geo");
      return null;
    default:
      return null;
  }
}

export function GuidedStep2Flow({
  screen,
  form,
  update,
  t,
  guideTouch,
  markTouch,
}: {
  screen: Step2ScreenId;
  form: FormState;
  update: Updater;
  t: Translate;
  guideTouch: GuideTouch;
  markTouch: (k: keyof GuideTouch) => void;
}) {
  const gpaOk = Boolean(guideTouch.s2_gpa && form.gpa.trim());
  const majorOk = Boolean(guideTouch.s2_major && form.majorPrimary.trim());
  const major2Ok = Boolean(guideTouch.s2_major2);

  switch (screen) {
    case "hs":
      return (
        <GuidedScreenShell step={2} screenId="hs" t={t}>
          <h2 className="guided-screen__question" id="gq-s2-hs">
            {t("wizard.s2.hs.q")}
          </h2>
          <GuidedContextLine step={2} screenId="hs" t={t} />
          <select
            className="select-modern select-modern--action"
            aria-labelledby="gq-s2-hs"
            value={form.highSchoolSystem}
            onChange={(e) => update("highSchoolSystem", e.target.value)}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="国内普高">{t("form.opt.hsCn")}</option>
            <option value="美高">{t("form.opt.hsUs")}</option>
            <option value="IB">{t("form.opt.hsIb")}</option>
            <option value="A-Level">{t("form.opt.hsAl")}</option>
            <option value="AP体系">{t("form.opt.hsAp")}</option>
            <option value="其他">{t("form.opt.hsOther")}</option>
          </select>
          {(() => {
            const fb = hsFeedback(form, t);
            return fb ? <p className="field-feedback">{fb}</p> : null;
          })()}
        </GuidedScreenShell>
      );

    case "gpa":
      return (
        <GuidedScreenShell step={2} screenId="gpa" t={t}>
          <h2 className="guided-screen__question" id="gq-s2-gpa">
            {t("wizard.s2.gpa.q")}
          </h2>
          <GuidedContextLine step={2} screenId="gpa" t={t} />
          <textarea
            id="gpa"
            className="input-modern input-modern--action"
            aria-labelledby="gq-s2-gpa"
            placeholder={t("form.placeholder.gpa")}
            value={form.gpa}
            onChange={(e) => update("gpa", e.target.value)}
            onBlur={() => markTouch("s2_gpa")}
          />
          {gpaOk && <p className="field-feedback">{t("wizard.s2.gpa.fb")}</p>}
        </GuidedScreenShell>
      );

    case "major":
      return (
        <GuidedScreenShell step={2} screenId="major" t={t}>
          <h2 className="guided-screen__question" id="gq-s2-major">
            {t("wizard.s2.major.q")}
          </h2>
          <GuidedContextLine step={2} screenId="major" t={t} />
          <div className="major-preset-group" aria-label={t("wizard.s2.major.presetLabel")}>
            <p className="major-preset-group__label">{t("wizard.s2.major.presetLabel")}</p>
            <div className="major-preset-group__options">
              {MAJOR_PRESET_KEYS.map((key) => {
                const label = t(`wizard.s2.major.presets.${key}`);
                const selected = form.majorPrimary.trim() === label;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`major-preset${selected ? " major-preset--selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => {
                      update("majorPrimary", label);
                      markTouch("s2_major");
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="field-sub-label">{t("wizard.s2.major.customLabel")}</p>
          <input
            id="major"
            className="input-modern input-modern--action"
            type="text"
            aria-labelledby="gq-s2-major"
            placeholder={t("form.placeholder.major")}
            value={form.majorPrimary}
            onChange={(e) => update("majorPrimary", e.target.value)}
            onBlur={() => markTouch("s2_major")}
          />
          {majorOk && <p className="field-feedback">{t("wizard.s2.major.fb")}</p>}
        </GuidedScreenShell>
      );

    case "major2":
      return (
        <GuidedScreenShell step={2} screenId="major2" t={t}>
          <h2 className="guided-screen__question" id="gq-s2-major2">
            {t("wizard.s2.major2.q")}
          </h2>
          <GuidedContextLine step={2} screenId="major2" t={t} />
          <input
            id="major2"
            className="input-modern input-modern--action"
            type="text"
            aria-labelledby="gq-s2-major2"
            value={form.majorSecondary}
            onChange={(e) => update("majorSecondary", e.target.value)}
            onBlur={() => markTouch("s2_major2")}
          />
          <button
            type="button"
            className="field-skip-btn"
            onClick={() => {
              update("majorSecondary", "");
              markTouch("s2_major2");
            }}
          >
            {t("wizard.s2.major2.skip")}
          </button>
          {major2Ok && (
            <p className="field-feedback">
              {form.majorSecondary.trim() ? t("wizard.s2.major2.fb") : t("wizard.s2.major2.fbSkip")}
            </p>
          )}
        </GuidedScreenShell>
      );

    case "size":
      return (
        <GuidedScreenShell step={2} screenId="size" t={t}>
          <h2 className="guided-screen__question" id="gq-s2-size">
            {t("wizard.s2.size.q")}
          </h2>
          <GuidedContextLine step={2} screenId="size" t={t} />
          <select
            className="select-modern select-modern--action"
            aria-labelledby="gq-s2-size"
            value={form.schoolSize}
            onChange={(e) => update("schoolSize", e.target.value as FormState["schoolSize"])}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="small">{t("form.opt.sizeS")}</option>
            <option value="medium">{t("form.opt.sizeM")}</option>
            <option value="large">{t("form.opt.sizeL")}</option>
            <option value="any">{t("form.opt.sizeAny")}</option>
          </select>
          {(() => {
            const fb = sizeFeedback(form, t);
            return fb ? <p className="field-feedback">{fb}</p> : null;
          })()}
        </GuidedScreenShell>
      );

    case "culture":
      return (
        <GuidedScreenShell step={2} screenId="culture" t={t}>
          <h2 className="guided-screen__question" id="gq-s2-culture">
            {t("wizard.s2.culture.q")}
          </h2>
          <GuidedContextLine step={2} screenId="culture" t={t} />
          <select
            className="select-modern select-modern--action"
            aria-labelledby="gq-s2-culture"
            value={form.campusCulturePref}
            onChange={(e) => update("campusCulturePref", e.target.value as CampusCulturePref)}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="academic">{t("form.opt.campusAcademic")}</option>
            <option value="balanced">{t("form.opt.campusBalanced")}</option>
            <option value="social">{t("form.opt.campusSocial")}</option>
            <option value="any">{t("form.opt.campusAny")}</option>
          </select>
          {(() => {
            const fb = cultureFeedback(form, t);
            return fb ? <p className="field-feedback">{fb}</p> : null;
          })()}
        </GuidedScreenShell>
      );

    case "geo":
      return (
        <GuidedScreenShell step={2} screenId="geo" t={t}>
          <h2 className="guided-screen__question" id="gq-s2-geo">
            {t("wizard.s2.geo.q")}
          </h2>
          <GuidedContextLine step={2} screenId="geo" t={t} />
          <div className="row-check row-check--guided" role="group" aria-labelledby="gq-s2-geo">
            {(["west", "east", "south", "midwest", "great_lakes", "any"] as const).map((g) => (
              <label key={g}>
                <input
                  type="checkbox"
                  checked={form.geoPrefs.includes(g)}
                  onChange={() => update("geoPrefs", toggleGeo(form.geoPrefs, g))}
                />
                {t(`geo.${g}`)}
              </label>
            ))}
          </div>
          {form.geoPrefs.length > 0 && <p className="field-feedback">{t("wizard.s2.geo.fb")}</p>}
        </GuidedScreenShell>
      );

    default:
      return null;
  }
}
