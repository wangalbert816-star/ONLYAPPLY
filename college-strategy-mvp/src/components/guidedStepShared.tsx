import type { ReactNode } from "react";
import type { ActivityItem, AcademicSpecialFlag, FormState, GeoPref } from "../types";
import type { Translate } from "../i18n/LanguageContext";

export const MAJOR_PRESET_KEYS = ["cs", "business", "engineering", "bio", "social", "arts", "policy", "undecided"] as const;
export const DEALBREAKER_PRESET_KEYS = ["none", "cold", "rural", "religious", "majorLimits", "transferLimits", "cost", "safety"] as const;

export function splitPresetList(value: string): string[] {
  return value
    .split(/[，,、;；\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function toggleDealbreakerPreset(current: string, label: string, noneLabel: string): string {
  const trimmed = current.trim();
  if (label === noneLabel) return trimmed === noneLabel ? "" : noneLabel;
  const parts = splitPresetList(current).filter((part) => part !== noneLabel);
  const next = parts.includes(label) ? parts.filter((part) => part !== label) : [...parts, label];
  return next.join("、");
}

export function createActivityItem(): ActivityItem {
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

export function toggleGeo(prefs: GeoPref[], g: GeoPref): GeoPref[] {
  if (g === "any") return prefs.includes("any") ? [] : ["any"];
  const withoutAny = prefs.filter((x) => x !== "any");
  if (withoutAny.includes(g)) return withoutAny.filter((x) => x !== g);
  return [...withoutAny, g];
}

export function toggleAcademicSpecialFlag(
  flags: AcademicSpecialFlag[],
  flag: AcademicSpecialFlag,
): AcademicSpecialFlag[] {
  if (flags.includes(flag)) return flags.filter((f) => f !== flag);
  return [...flags, flag];
}

export function gpaTrendFeedback(form: FormState, t: Translate): string | null {
  const map: Record<string, string> = {
    upward: "wizard.s2.gpaTrend.fbUpward",
    stable: "wizard.s2.gpaTrend.fbStable",
    downward: "wizard.s2.gpaTrend.fbDownward",
    mixed: "wizard.s2.gpaTrend.fbMixed",
    unsure: "wizard.s2.gpaTrend.fbUnsure",
  };
  if (!form.gpaTrend) return null;
  return t(map[form.gpaTrend] ?? "wizard.s2.gpaTrend.fbUnsure");
}

export function guidedFormCompletionPercent(
  step: 1 | 2 | 3,
  step1Screens: readonly string[],
  step2Screens: readonly string[],
  step3Screens: readonly string[],
  step1ScreenSafe: number,
  step2ScreenSafe: number,
  step3ScreenSafe: number,
): number {
  const total = step1Screens.length + step2Screens.length + step3Screens.length;
  if (total <= 0) return 0;

  let completed = 0;
  if (step >= 1) {
    completed += step === 1 ? step1ScreenSafe + 1 : step1Screens.length;
  }
  if (step >= 2) {
    completed += step === 2 ? step2ScreenSafe + 1 : step2Screens.length;
  }
  if (step >= 3) {
    completed += step === 3 ? step3ScreenSafe + 1 : step3Screens.length;
  }

  return Math.min(100, Math.round((completed / total) * 100));
}

export function GuidedFormProgress({
  step,
  step1Screens,
  step2Screens,
  step3Screens,
  step1ScreenSafe,
  step2ScreenSafe,
  step3ScreenSafe,
  t,
}: {
  step: 1 | 2 | 3;
  step1Screens: readonly string[];
  step2Screens: readonly string[];
  step3Screens: readonly string[];
  step1ScreenSafe: number;
  step2ScreenSafe: number;
  step3ScreenSafe: number;
  t: Translate;
}) {
  const percent = guidedFormCompletionPercent(
    step,
    step1Screens,
    step2Screens,
    step3Screens,
    step1ScreenSafe,
    step2ScreenSafe,
    step3ScreenSafe,
  );

  return (
    <div
      className="guided-progress"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t("wizard.progressBar.aria")}
    >
      <div className="guided-progress__track">
        <div className="guided-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="guided-progress__label">{t("wizard.progressBar.percent", { n: percent })}</p>
    </div>
  );
}

export function GuidedScreenShell({
  step,
  screenId,
  children,
  t,
}: {
  step: 1 | 2 | 3;
  screenId: string;
  children: ReactNode;
  t: Translate;
}) {
  return (
    <div className="guided-screen" key={`s${step}-${screenId}`}>
      <p className="guided-screen__eyebrow">{t(`wizard.s${step}.screens.${screenId}.title`)}</p>
      {children}
    </div>
  );
}

export function GuidedContextLine({
  step,
  screenId,
  t,
}: {
  step: 1 | 2 | 3;
  screenId: string;
  t: Translate;
}) {
  return <p className="guided-screen__context">{t(`wizard.s${step}.screens.${screenId}.context`)}</p>;
}

export function hsFeedback(form: FormState, t: Translate): string | null {
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

export function sizeFeedback(form: FormState, t: Translate): string | null {
  if (!form.schoolSize) return null;
  if (form.schoolSize === "small") return t("wizard.s2.size.fbSmall");
  if (form.schoolSize === "medium") return t("wizard.s2.size.fbMedium");
  if (form.schoolSize === "large") return t("wizard.s2.size.fbLarge");
  return t("wizard.s2.size.fbAny");
}

export function cultureFeedback(form: FormState, t: Translate): string | null {
  const v = form.campusCulturePref;
  if (!v) return null;
  if (v === "academic") return t("wizard.s2.culture.fbAcademic");
  if (v === "balanced") return t("wizard.s2.culture.fbBalanced");
  if (v === "social") return t("wizard.s2.culture.fbSocial");
  return t("wizard.s2.culture.fbAny");
}

const MIN_ACTIVITY_DESCRIPTION_LEN = 40;

export function activityItemMeetsWizardRequirement(item: ActivityItem): boolean {
  return item.name.trim().length > 0 && item.description.trim().length >= MIN_ACTIVITY_DESCRIPTION_LEN;
}

export function validateStructuredActivities(form: FormState, tr: Translate): string | null {
  const items = form.structuredActivities ?? [];
  const complete = items.filter(activityItemMeetsWizardRequirement);
  if (complete.length > 0) return null;
  if (items.length === 0) return tr("validation.activitiesRequired");
  const needsName = items.some((item) => !item.name.trim());
  if (needsName) return tr("validation.activityName");
  return tr("validation.activityDescription");
}

export function riskFeedback(form: FormState, t: Translate): string | null {
  if (!form.riskStyle) return null;
  if (form.riskStyle === "conservative") return t("wizard.s3.risk.fbCon");
  if (form.riskStyle === "balanced") return t("wizard.s3.risk.fbBal");
  return t("wizard.s3.risk.fbAgg");
}
