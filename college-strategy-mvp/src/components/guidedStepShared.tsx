import type { ReactNode } from "react";
import type { ActivityItem, FormState, GeoPref } from "../types";
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

export function riskFeedback(form: FormState, t: Translate): string | null {
  if (!form.riskStyle) return null;
  if (form.riskStyle === "conservative") return t("wizard.s3.risk.fbCon");
  if (form.riskStyle === "balanced") return t("wizard.s3.risk.fbBal");
  return t("wizard.s3.risk.fbAgg");
}
