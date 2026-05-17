import type { ReactNode } from "react";
import type { ActivityItem, FormState, GeoPref } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import {
  getEffectiveIntake,
  INTAKE_OTHER_VALUE,
  INTAKE_PRESETS,
  isIntakeComplete,
} from "../lib/intakeTerm";

export type GuideTouch = {
  s2_gpa?: boolean;
  s2_major?: boolean;
  s2_major2?: boolean;
  s3_actv?: boolean;
  s3_deal?: boolean;
};

type Updater = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function createActivityItem(): ActivityItem {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    name: "",
    kind: "",
    grades: "",
    hours: "",
    role: "",
    description: "",
    outcome: "",
    award: "",
    scope: "",
    majorRelated: "",
    proof: "",
  };
}

function toggleGeo(prefs: GeoPref[], g: GeoPref): GeoPref[] {
  if (g === "any") return prefs.includes("any") ? [] : ["any"];
  const withoutAny = prefs.filter((x) => x !== "any");
  if (withoutAny.includes(g)) return withoutAny.filter((x) => x !== g);
  return [...withoutAny, g];
}

function fieldWrap(key: string, node: ReactNode) {
  return (
    <div key={key} className="field-guide field-guide--enter">
      {node}
    </div>
  );
}

function intakeFeedback(form: FormState, t: Translate): string | null {
  if (!isIntakeComplete(form)) return null;
  if (form.intakeTerm === INTAKE_OTHER_VALUE) return t("wizard.s1.intake.fbOther");
  const fbByPreset: Record<string, string> = {
    "2027 Fall": "wizard.s1.intake.fb2027Fall",
    "2028 Fall": "wizard.s1.intake.fb2028Fall",
    "2029 Fall": "wizard.s1.intake.fb2029Fall",
    "2030 Fall": "wizard.s1.intake.fb2030Fall",
  };
  return t(fbByPreset[form.intakeTerm] ?? "wizard.s1.intake.fbOther");
}

function identityFeedback(form: FormState, t: Translate): string | null {
  if (!form.applicantIdentity) return null;
  if (form.applicantIdentity === "intl") return t("wizard.s1.identity.fbIntl");
  if (form.applicantIdentity === "us_citizen") return t("wizard.s1.identity.fbUs");
  return t("wizard.s1.identity.fbOther");
}

function budgetFeedback(form: FormState, t: Translate): string | null {
  if (!form.budget) return null;
  if (form.budget === "full_pay") return t("wizard.s1.budget.fbFull");
  if (form.budget === "high_budget") return t("wizard.s1.budget.fbHigh");
  if (form.budget === "budget_cap") return t("wizard.s1.budget.fbCap");
  if (form.budget === "need_aid") return t("wizard.s1.budget.fbAid");
  return t("wizard.s1.budget.fbUnsure");
}

function testingFeedback(form: FormState, t: Translate): string | null {
  if (!form.testing) return null;
  if (form.testing === "test_optional") return t("wizard.s1.testing.fbOpt");
  return t("wizard.s1.testing.fbSubmit");
}

function hsFeedback(form: FormState, t: Translate): string | null {
  const v = form.highSchoolSystem;
  if (!v) return null;
  const map: Record<string, string> = {
    国内普高: "wizard.s2.hs.fbCn",
    美高: "wizard.s2.hs.fbUs",
    IB: "wizard.s2.hs.fbIb",
    "A-Level": "wizard.s2.hs.fbAl",
    AP体系: "wizard.s2.hs.fbAp",
    其他: "wizard.s2.hs.fbOther",
  };
  return t(map[v] ?? "wizard.s2.hs.fbOther");
}

function sizeFeedback(form: FormState, t: Translate): string | null {
  if (!form.schoolSize) return null;
  if (form.schoolSize === "small") return t("wizard.s2.size.fbSmall");
  if (form.schoolSize === "medium") return t("wizard.s2.size.fbMedium");
  if (form.schoolSize === "large") return t("wizard.s2.size.fbLarge");
  return t("wizard.s2.size.fbAny");
}

function riskFeedback(form: FormState, t: Translate): string | null {
  if (!form.riskStyle) return null;
  if (form.riskStyle === "conservative") return t("wizard.s3.risk.fbCon");
  if (form.riskStyle === "balanced") return t("wizard.s3.risk.fbBal");
  return t("wizard.s3.risk.fbAgg");
}

function labelSchoolSize(form: FormState, t: Translate): string {
  if (!form.schoolSize) return "";
  const m: Record<string, string> = {
    small: "form.opt.sizeS",
    medium: "form.opt.sizeM",
    large: "form.opt.sizeL",
    any: "form.opt.sizeAny",
  };
  return t(m[form.schoolSize] ?? "");
}

function labelRisk(form: FormState, t: Translate): string {
  if (!form.riskStyle) return "";
  const m: Record<string, string> = {
    conservative: "form.opt.riskCon",
    balanced: "form.opt.riskBal",
    aggressive: "form.opt.riskAgg",
  };
  return t(m[form.riskStyle] ?? "");
}

function labelBudget(form: FormState, t: Translate): string {
  if (!form.budget) return "";
  const m: Record<string, string> = {
    full_pay: "form.opt.budgetFull",
    high_budget: "form.opt.budgetHigh",
    budget_cap: "form.opt.budgetCap",
    need_aid: "form.opt.budgetAid",
    unsure: "form.opt.budgetUnsure",
  };
  return t(m[form.budget] ?? "");
}

function labelIdentity(form: FormState, t: Translate): string {
  if (!form.applicantIdentity) return "";
  const m: Record<string, string> = {
    intl: "form.opt.idIntl",
    us_citizen: "form.opt.idUs",
    other: "form.opt.idOther",
  };
  return t(m[form.applicantIdentity] ?? "");
}

function labelTesting(form: FormState, t: Translate): string {
  if (!form.testing) return "";
  return t(form.testing === "test_optional" ? "form.opt.testOpt" : "form.opt.testSubmit");
}

function labelHs(form: FormState, t: Translate): string {
  const v = form.highSchoolSystem;
  if (!v) return "";
  const map: Record<string, string> = {
    国内普高: "form.opt.hsCn",
    美高: "form.opt.hsUs",
    IB: "form.opt.hsIb",
    "A-Level": "form.opt.hsAl",
    AP体系: "form.opt.hsAp",
    其他: "form.opt.hsOther",
  };
  return map[v] ? t(map[v]) : v;
}

export function FormLiveSummary({ form, t }: { form: FormState; t: Translate }) {
  const lines: string[] = [];
  const eff = getEffectiveIntake(form);
  if (eff) lines.push(t("wizard.summary.intake", { v: eff }));
  if (form.applicantIdentity) lines.push(t("wizard.summary.identity", { v: labelIdentity(form, t) }));
  if ((form.citizenship ?? "").trim() || (form.residenceRegion ?? "").trim()) lines.push(t("wizard.summary.environment"));
  if (form.budget) lines.push(t("wizard.summary.budget", { v: labelBudget(form, t) }));
  if (form.testing) lines.push(t("wizard.summary.testing", { v: labelTesting(form, t) }));
  const scoreBits: string[] = [];
  if (form.satScore.trim()) scoreBits.push(`SAT ${form.satScore.trim()}`);
  if (form.actScore.trim()) scoreBits.push(`ACT ${form.actScore.trim()}`);
  if (scoreBits.length) lines.push(t("wizard.summary.scores", { v: scoreBits.join(" · ") }));

  if (form.highSchoolSystem) lines.push(t("wizard.summary.hs", { v: labelHs(form, t) }));
  if (form.gpa.trim()) lines.push(t("wizard.summary.gpa"));
  if (form.majorPrimary.trim()) lines.push(t("wizard.summary.major", { v: form.majorPrimary.trim() }));
  if (form.majorSecondary.trim()) lines.push(t("wizard.summary.major2", { v: form.majorSecondary.trim() }));
  if (form.schoolSize) lines.push(t("wizard.summary.size", { v: labelSchoolSize(form, t) }));
  if (form.geoPrefs.length) {
    const geo = form.geoPrefs.map((g) => t(`geo.${g}`)).join("、");
    lines.push(t("wizard.summary.geo", { v: geo }));
  }
  if (form.activities.trim()) {
    const short =
      form.activities.trim().length > 72 ? `${form.activities.trim().slice(0, 72)}…` : form.activities.trim();
    lines.push(t("wizard.summary.activities", { v: short }));
  }
  const detailedActivities = form.structuredActivities?.filter((item) => item.name.trim() || item.description.trim()) ?? [];
  if (detailedActivities.length > 0) {
    lines.push(t("wizard.summary.activityDetails", { n: detailedActivities.length }));
  }
  if (form.riskStyle) lines.push(t("wizard.summary.risk", { v: labelRisk(form, t) }));
  if (form.dealbreakers.trim()) {
    const d =
      form.dealbreakers.trim().length > 72 ? `${form.dealbreakers.trim().slice(0, 72)}…` : form.dealbreakers.trim();
    lines.push(t("wizard.summary.deal", { v: d }));
  }

  return (
    <aside className="form-live-summary" aria-live="polite">
      <h3 className="form-live-summary__title">{t("wizard.summary.title")}</h3>
      <p className="form-live-summary__lead">{t("wizard.summary.lead")}</p>
      {lines.length === 0 ? (
        <p className="form-live-summary__empty">{t("wizard.summary.empty")}</p>
      ) : (
        <ul className="form-live-summary__list">
          {lines.map((line, i) => (
            <li key={`summary-${i}-${line.slice(0, 24)}`}>{line}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function GuidedStep1({ form, update, t }: { form: FormState; update: Updater; t: Translate }) {
  const intakeOk = isIntakeComplete(form);
  const idOk = Boolean(form.applicantIdentity);
  const budgetOk = Boolean(form.budget);
  const testingOk = Boolean(form.testing);
  const showScores = testingOk && form.testing === "will_submit";
  const hasScore = Boolean(form.satScore.trim() || form.actScore.trim());

  const blocks: ReactNode[] = [];

  blocks.push(
    fieldWrap(
      "s1-intake",
      <>
        <p className="field-question" id="gq-s1-intake">
          {t("wizard.s1.intake.q")}
        </p>
        <p className="field-why" id="gw-s1-intake">
          {t("wizard.s1.intake.why")}
        </p>
        <select
          className="select-modern"
          id="intakeTerm"
          aria-labelledby="gq-s1-intake"
          aria-describedby="gw-s1-intake"
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
          <div className="field-intake-other">
            <label className="field-sub-label" htmlFor="intakeOtherDetail">
              {t("form.intakeOtherLabel")}
            </label>
            <input
              id="intakeOtherDetail"
              className="input-modern"
              type="text"
              autoComplete="off"
              placeholder={t("form.placeholder.intakeOther")}
              value={form.intakeOtherDetail}
              onChange={(e) => update("intakeOtherDetail", e.target.value)}
            />
          </div>
        )}
        {(() => {
          const fb = intakeFeedback(form, t);
          return fb ? <p className="field-feedback">{fb}</p> : null;
        })()}
      </>,
    ),
  );

  if (intakeOk) {
    blocks.push(
      fieldWrap(
        "s1-id",
        <>
          <p className="field-question" id="gq-s1-id">
            {t("wizard.s1.identity.q")}
          </p>
          <p className="field-why" id="gw-s1-id">
            {t("wizard.s1.identity.why")}
          </p>
          <select
            className="select-modern"
            aria-labelledby="gq-s1-id"
            aria-describedby="gw-s1-id"
            value={form.applicantIdentity}
            onChange={(e) => update("applicantIdentity", e.target.value as FormState["applicantIdentity"])}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="intl">{t("form.opt.idIntl")}</option>
            <option value="us_citizen">{t("form.opt.idUs")}</option>
            <option value="other">{t("form.opt.idOther")}</option>
          </select>
          {(() => {
            const fb = identityFeedback(form, t);
            return fb ? <p className="field-feedback">{fb}</p> : null;
          })()}
        </>,
      ),
    );
  }

  if (intakeOk && idOk) {
    blocks.push(
      fieldWrap(
        "s1-env",
        <>
          <p className="field-question" id="gq-s1-env">
            {t("wizard.s1.environment.q")}
          </p>
          <p className="field-why" id="gw-s1-env">
            {t("wizard.s1.environment.why")}
          </p>
          <div className="field-score-grid">
            <div>
              <label className="field-sub-label" htmlFor="citizenship">
                {t("form.citizenship")}
              </label>
              <input
                id="citizenship"
                className="input-modern"
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
                className="input-modern"
                type="text"
                autoComplete="country-name"
                placeholder={t("form.placeholder.residenceRegion")}
                value={form.residenceRegion ?? ""}
                onChange={(e) => update("residenceRegion", e.target.value)}
              />
            </div>
          </div>
          {((form.citizenship ?? "").trim() || (form.residenceRegion ?? "").trim()) && (
            <p className="field-feedback">{t("wizard.s1.environment.fb")}</p>
          )}
        </>,
      ),
    );
  }

  if (intakeOk && idOk) {
    blocks.push(
      fieldWrap(
        "s1-budget",
        <>
          <p className="field-question" id="gq-s1-budget">
            {t("wizard.s1.budget.q")}
          </p>
          <p className="field-why" id="gw-s1-budget">
            {t("wizard.s1.budget.why")}
          </p>
          <select
            className="select-modern"
            aria-labelledby="gq-s1-budget"
            aria-describedby="gw-s1-budget"
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
          {(() => {
            const fb = budgetFeedback(form, t);
            return fb ? <p className="field-feedback">{fb}</p> : null;
          })()}
        </>,
      ),
    );
  }

  if (intakeOk && idOk && budgetOk) {
    blocks.push(
      fieldWrap(
        "s1-test",
        <>
          <p className="field-question" id="gq-s1-test">
            {t("wizard.s1.testing.q")}
          </p>
          <p className="field-why" id="gw-s1-test">
            {t("wizard.s1.testing.why")}
          </p>
          <select
            className="select-modern"
            aria-labelledby="gq-s1-test"
            aria-describedby="gw-s1-test"
            value={form.testing}
            onChange={(e) => update("testing", e.target.value as FormState["testing"])}
          >
            <option value="">{t("form.opt.choose")}</option>
            <option value="test_optional">{t("form.opt.testOpt")}</option>
            <option value="will_submit">{t("form.opt.testSubmit")}</option>
          </select>
          {(() => {
            const fb = testingFeedback(form, t);
            return fb ? <p className="field-feedback">{fb}</p> : null;
          })()}
        </>,
      ),
    );
  }

  if (intakeOk && idOk && budgetOk && testingOk && showScores) {
    blocks.push(
      fieldWrap(
        "s1-scores",
        <>
          <p className="field-question" id="gq-s1-scores">
            {t("wizard.s1.scores.q")}
          </p>
          <p className="field-why" id="gw-s1-scores">
            {t("wizard.s1.scores.why")}
          </p>
          <div className="field-score-grid">
            <div>
              <label className="field-sub-label" htmlFor="sat">
                {t("form.sat")}
              </label>
              <input
                id="sat"
                className="input-modern"
                type="text"
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
                className="input-modern"
                type="text"
                autoComplete="off"
                placeholder={t("form.placeholder.act")}
                value={form.actScore}
                onChange={(e) => update("actScore", e.target.value)}
              />
            </div>
          </div>
          {hasScore && <p className="field-feedback">{t("wizard.s1.scores.fb")}</p>}
        </>,
      ),
    );
  }

  return <div className="guided-fields">{blocks}</div>;
}

export function GuidedStep2({
  form,
  update,
  t,
  guideTouch,
  markTouch,
}: {
  form: FormState;
  update: Updater;
  t: Translate;
  guideTouch: GuideTouch;
  markTouch: (k: keyof GuideTouch) => void;
}) {
  const hsOk = Boolean(form.highSchoolSystem);
  const gpaOk = Boolean(guideTouch.s2_gpa && form.gpa.trim());
  const majorOk = Boolean(guideTouch.s2_major && form.majorPrimary.trim());
  const major2Ok = Boolean(guideTouch.s2_major2);
  const sizeOk = Boolean(form.schoolSize);

  const blocks: ReactNode[] = [];

  blocks.push(
    fieldWrap(
      "s2-hs",
      <>
        <p className="field-question" id="gq-s2-hs">
          {t("wizard.s2.hs.q")}
        </p>
        <p className="field-why" id="gw-s2-hs">
          {t("wizard.s2.hs.why")}
        </p>
        <select
          className="select-modern"
          aria-labelledby="gq-s2-hs"
          aria-describedby="gw-s2-hs"
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
      </>,
    ),
  );

  if (hsOk) {
    blocks.push(
      fieldWrap(
        "s2-gpa",
        <>
          <p className="field-question" id="gq-s2-gpa">
            {t("wizard.s2.gpa.q")}
          </p>
          <p className="field-why" id="gw-s2-gpa">
            {t("wizard.s2.gpa.why")}
          </p>
          <textarea
            id="gpa"
            className="input-modern"
            aria-labelledby="gq-s2-gpa"
            aria-describedby="gw-s2-gpa"
            placeholder={t("form.placeholder.gpa")}
            value={form.gpa}
            onChange={(e) => update("gpa", e.target.value)}
            onBlur={() => markTouch("s2_gpa")}
          />
          {gpaOk && <p className="field-feedback">{t("wizard.s2.gpa.fb")}</p>}
        </>,
      ),
    );
  }

  if (hsOk && gpaOk) {
    blocks.push(
      fieldWrap(
        "s2-major",
        <>
          <p className="field-question" id="gq-s2-major">
            {t("wizard.s2.major.q")}
          </p>
          <p className="field-why" id="gw-s2-major">
            {t("wizard.s2.major.why")}
          </p>
          <input
            id="major"
            className="input-modern"
            type="text"
            aria-labelledby="gq-s2-major"
            aria-describedby="gw-s2-major"
            placeholder={t("form.placeholder.major")}
            value={form.majorPrimary}
            onChange={(e) => update("majorPrimary", e.target.value)}
            onBlur={() => markTouch("s2_major")}
          />
          {majorOk && <p className="field-feedback">{t("wizard.s2.major.fb")}</p>}
        </>,
      ),
    );
  }

  if (hsOk && gpaOk && majorOk) {
    blocks.push(
      fieldWrap(
        "s2-major2",
        <>
          <p className="field-question" id="gq-s2-major2">
            {t("wizard.s2.major2.q")}
          </p>
          <p className="field-why" id="gw-s2-major2">
            {t("wizard.s2.major2.why")}
          </p>
          <input
            id="major2"
            className="input-modern"
            type="text"
            aria-labelledby="gq-s2-major2"
            aria-describedby="gw-s2-major2"
            value={form.majorSecondary}
            onChange={(e) => update("majorSecondary", e.target.value)}
            onBlur={() => markTouch("s2_major2")}
          />
          {major2Ok && (
            <p className="field-feedback">
              {form.majorSecondary.trim() ? t("wizard.s2.major2.fb") : t("wizard.s2.major2.fbSkip")}
            </p>
          )}
        </>,
      ),
    );
  }

  if (hsOk && gpaOk && majorOk && major2Ok) {
    blocks.push(
      fieldWrap(
        "s2-size",
        <>
          <p className="field-question" id="gq-s2-size">
            {t("wizard.s2.size.q")}
          </p>
          <p className="field-why" id="gw-s2-size">
            {t("wizard.s2.size.why")}
          </p>
          <select
            className="select-modern"
            aria-labelledby="gq-s2-size"
            aria-describedby="gw-s2-size"
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
        </>,
      ),
    );
  }

  if (hsOk && gpaOk && majorOk && major2Ok && sizeOk) {
    blocks.push(
      fieldWrap(
        "s2-geo",
        <>
          <p className="field-question" id="gq-s2-geo">
            {t("wizard.s2.geo.q")}
          </p>
          <p className="field-why" id="gw-s2-geo">
            {t("wizard.s2.geo.why")}
          </p>
          <div className="row-check" role="group" aria-labelledby="gq-s2-geo">
            {(["west", "east", "south", "midwest", "great_lakes", "any"] as const).map((g) => (
              <label key={g}>
                <input
                  type="checkbox"
                  checked={form.geoPrefs.includes(g)}
                  onChange={() => {
                    const next = toggleGeo(form.geoPrefs, g);
                    update("geoPrefs", next);
                  }}
                />
                {t(`geo.${g}`)}
              </label>
            ))}
          </div>
          {form.geoPrefs.length > 0 && <p className="field-feedback">{t("wizard.s2.geo.fb")}</p>}
        </>,
      ),
    );
  }

  return <div className="guided-fields">{blocks}</div>;
}

export function GuidedStep3({
  form,
  update,
  t,
  guideTouch,
  markTouch,
}: {
  form: FormState;
  update: Updater;
  t: Translate;
  guideTouch: GuideTouch;
  markTouch: (k: keyof GuideTouch) => void;
}) {
  const actvTouched = Boolean(guideTouch.s3_actv);
  const riskOk = Boolean(form.riskStyle);
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

  const blocks: ReactNode[] = [];

  blocks.push(
    fieldWrap(
      "s3-act",
      <>
        <p className="field-question" id="gq-s3-act">
          {t("wizard.s3.activities.q")}
        </p>
        <p className="field-why" id="gw-s3-act">
          {t("wizard.s3.activities.why")}
        </p>
        <textarea
          id="actv"
          className="input-modern"
          maxLength={600}
          aria-labelledby="gq-s3-act"
          aria-describedby="gw-s3-act"
          placeholder={t("form.placeholder.activities")}
          value={form.activities}
          onChange={(e) => update("activities", e.target.value)}
          onBlur={() => markTouch("s3_actv")}
        />
        <small>{form.activities.length}/600</small>
        {actvTouched && (
          <p className="field-feedback">
            {form.activities.trim() ? t("wizard.s3.activities.fb") : t("wizard.s3.activities.fbEmpty")}
          </p>
        )}
        <details className="activity-builder" open={structuredActivities.length > 0}>
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
                        {(["activity", "competition", "research", "internship", "club", "service", "arts", "sports", "other"] as const).map(
                          (kind) => (
                            <option key={kind} value={kind}>
                              {t(`wizard.s3.activities.kindOpt.${kind}`)}
                            </option>
                          ),
                        )}
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
                        onChange={(e) => updateActivity(item.id, { majorRelated: e.target.value as ActivityItem["majorRelated"] })}
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
          </div>
        </details>
      </>,
    ),
  );

  if (actvTouched) {
    blocks.push(
      fieldWrap(
        "s3-risk",
        <>
          <p className="field-question" id="gq-s3-risk">
            {t("wizard.s3.risk.q")}
          </p>
          <p className="field-why" id="gw-s3-risk">
            {t("wizard.s3.risk.why")}
          </p>
          <select
            className="select-modern"
            aria-labelledby="gq-s3-risk"
            aria-describedby="gw-s3-risk"
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
        </>,
      ),
    );
  }

  if (actvTouched && riskOk) {
    blocks.push(
      fieldWrap(
        "s3-deal",
        <>
          <p className="field-question" id="gq-s3-deal">
            {t("wizard.s3.deal.q")}
          </p>
          <p className="field-why" id="gw-s3-deal">
            {t("wizard.s3.deal.why")}
          </p>
          <input
            id="deal"
            className="input-modern"
            type="text"
            aria-labelledby="gq-s3-deal"
            aria-describedby="gw-s3-deal"
            placeholder={t("form.placeholder.deal")}
            value={form.dealbreakers}
            onChange={(e) => update("dealbreakers", e.target.value)}
            onBlur={() => markTouch("s3_deal")}
          />
          {guideTouch.s3_deal && (
            <p className="field-feedback">
              {form.dealbreakers.trim() ? t("wizard.s3.deal.fb") : t("wizard.s3.deal.fbSkip")}
            </p>
          )}
        </>,
      ),
    );
  }

  return <div className="guided-fields">{blocks}</div>;
}
