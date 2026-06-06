import type { FormState } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { getEffectiveIntake } from "../lib/intakeTerm";
import type { Step1ScreenId } from "./GuidedStep1Flow";
import type { Step2ScreenId } from "./GuidedStep2Flow";
import type { Step3ScreenId } from "./GuidedStep3Flow";
import { activityItemMeetsWizardRequirement } from "./guidedStepShared";

export type SnapshotRowStatus = "filled" | "pending" | "optional" | "na";

export type SnapshotRow = {
  id: string;
  section: 1 | 2 | 3;
  label: string;
  value: string | null;
  status: SnapshotRowStatus;
  hint: string;
  isNext: boolean;
  isStepSummary?: boolean;
  step1Screen?: Step1ScreenId;
  step2Screen?: Step2ScreenId;
  step3Screen?: Step3ScreenId;
};

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

function labelCampusCulture(form: FormState, t: Translate): string {
  if (!form.campusCulturePref) return "";
  const m: Record<string, string> = {
    academic: "form.opt.campusAcademic",
    balanced: "form.opt.campusBalanced",
    social: "form.opt.campusSocial",
    any: "form.opt.campusAny",
  };
  return t(m[form.campusCulturePref] ?? "");
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

function labelGpaTrend(form: FormState, t: Translate): string {
  if (!form.gpaTrend) return "";
  const m: Record<string, string> = {
    upward: "form.opt.gpaTrendUpward",
    stable: "form.opt.gpaTrendStable",
    downward: "form.opt.gpaTrendDownward",
    mixed: "form.opt.gpaTrendMixed",
    unsure: "form.opt.gpaTrendUnsure",
  };
  return t(m[form.gpaTrend] ?? "");
}

function specialDisplay(form: FormState, t: Translate): string | null {
  const parts = form.academicSpecialFlags.map((flag) => t(`form.opt.special.${flag}`));
  const notes = form.academicSpecialNotes.trim();
  if (notes) parts.push(notes.length > 40 ? `${notes.slice(0, 40)}…` : notes);
  return parts.length ? parts.join(" · ") : null;
}

function scoreDisplay(form: FormState): string | null {
  const bits: string[] = [];
  if (form.satScore.trim()) bits.push(`SAT ${form.satScore.trim()}`);
  if (form.actScore.trim()) bits.push(`ACT ${form.actScore.trim()}`);
  return bits.length ? bits.join(" · ") : null;
}

function environmentDisplay(form: FormState): string | null {
  const parts = [form.citizenship?.trim(), form.residenceRegion?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

type RowDef = {
  id: string;
  section: 1 | 2 | 3;
  labelKey: string;
  hintKey: string;
  optional?: boolean;
  step1Screen?: Step1ScreenId;
  filled: (form: FormState) => boolean;
  value: (form: FormState, t: Translate) => string | null;
  statusWhenEmpty?: (form: FormState) => SnapshotRowStatus;
};

function defsForSection(section: 1 | 2 | 3, form: FormState): RowDef[] {
  return ROW_DEFS.filter((def) => {
    if (def.section !== section) return false;
    if (def.id === "scores" && form.testing !== "will_submit") return false;
    if (def.id === "language" && form.applicantIdentity !== "intl") return false;
    return true;
  });
}

function sectionProgress(section: 1 | 2 | 3, form: FormState): { filled: number; total: number } {
  const defs = defsForSection(section, form);
  const required = defs.filter((d) => !d.optional && !(d.id === "scores" && form.testing === "test_optional"));
  const filled = required.filter((d) => {
    if (d.id === "scores" && form.testing === "test_optional") return true;
    return d.filled(form);
  }).length;
  const total = required.length;
  return { filled, total };
}

function buildDetailRows(section: 1 | 2 | 3, form: FormState, t: Translate): SnapshotRow[] {
  const defs = defsForSection(section, form);
  return defs.map((def) => {
    const filled = def.filled(form);
    const value = filled ? def.value(form, t) : null;
    let status: SnapshotRowStatus = filled ? "filled" : def.statusWhenEmpty?.(form) ?? (def.optional ? "optional" : "pending");
    if (def.id === "scores" && form.testing === "test_optional") status = "na";
    return {
      id: def.id,
      section: def.section,
      label: t(def.labelKey),
      value,
      status,
      hint: t(def.hintKey),
      isNext: false,
      step1Screen: def.step1Screen,
      step2Screen: STEP2_SCREEN_IDS.has(def.id as Step2ScreenId) ? (def.id as Step2ScreenId) : undefined,
      step3Screen: STEP3_SCREEN_IDS.has(def.id as Step3ScreenId) ? (def.id as Step3ScreenId) : undefined,
    };
  });
}

function applyNextHighlight(
  rows: SnapshotRow[],
  currentStep: number,
  step1ScreenId?: Step1ScreenId,
  step2ScreenId?: Step2ScreenId,
  step3ScreenId?: Step3ScreenId,
) {
  let nextAssigned = false;
  for (const row of rows) {
    if (row.isStepSummary || nextAssigned) continue;
    if (row.section !== currentStep) continue;
    if (row.status === "filled" || row.status === "na") continue;
    if (row.status === "optional" && currentStep !== row.section) continue;

    if (currentStep === 1 && step1ScreenId && row.step1Screen === step1ScreenId) {
      row.isNext = true;
      nextAssigned = true;
    } else if (currentStep === 2 && step2ScreenId && row.step2Screen === step2ScreenId) {
      row.isNext = true;
      nextAssigned = true;
    } else if (currentStep === 3 && step3ScreenId && row.step3Screen === step3ScreenId) {
      row.isNext = true;
      nextAssigned = true;
    }
  }
}

function labelGeoPrefs(form: FormState, t: Translate): string | null {
  if (!form.geoPrefs.length) return null;
  const aliases: Record<string, string> = {
    west_coast: "west",
    northeast: "east",
    west_coast_us: "west",
  };
  return form.geoPrefs
    .map((g) => {
      const key = aliases[g] ?? g;
      const label = t(`geo.${key}`);
      return label === `geo.${key}` ? g : label;
    })
    .join("、");
}

const ROW_DEFS: RowDef[] = [
  {
    id: "intake",
    section: 1,
    labelKey: "wizard.summary.row.intake",
    hintKey: "wizard.summary.hint.intake",
    step1Screen: "intake",
    filled: (f) => Boolean(getEffectiveIntake(f).trim()),
    value: (f) => getEffectiveIntake(f).trim() || null,
  },
  {
    id: "identity",
    section: 1,
    labelKey: "wizard.summary.row.identity",
    hintKey: "wizard.summary.hint.identity",
    step1Screen: "identity",
    filled: (f) => Boolean(f.applicantIdentity),
    value: (f, t) => labelIdentity(f, t) || null,
  },
  {
    id: "environment",
    section: 1,
    labelKey: "wizard.summary.row.environment",
    hintKey: "wizard.summary.hint.environment",
    optional: true,
    step1Screen: "environment",
    filled: (f) => Boolean(environmentDisplay(f)),
    value: (f) => environmentDisplay(f),
    statusWhenEmpty: () => "optional",
  },
  {
    id: "budget",
    section: 1,
    labelKey: "wizard.summary.row.budget",
    hintKey: "wizard.summary.hint.budget",
    step1Screen: "budget",
    filled: (f) => Boolean(f.budget),
    value: (f, t) => labelBudget(f, t) || null,
  },
  {
    id: "gpa",
    section: 2,
    labelKey: "wizard.summary.row.gpa",
    hintKey: "wizard.summary.hint.gpa",
    filled: (f) => Boolean(f.gpa.trim()),
    value: (f) => f.gpa.trim() || null,
  },
  {
    id: "gpaTrend",
    section: 2,
    labelKey: "wizard.summary.row.gpaTrend",
    hintKey: "wizard.summary.hint.gpaTrend",
    filled: (f) => Boolean(f.gpaTrend),
    value: (f, t) => labelGpaTrend(f, t) || null,
  },
  {
    id: "testing",
    section: 2,
    labelKey: "wizard.summary.row.testing",
    hintKey: "wizard.summary.hint.testing",
    filled: (f) => Boolean(f.testing),
    value: (f, t) => labelTesting(f, t) || null,
  },
  {
    id: "scores",
    section: 2,
    labelKey: "wizard.summary.row.scores",
    hintKey: "wizard.summary.hint.scores",
    filled: (f) => Boolean(scoreDisplay(f)),
    value: (f) => scoreDisplay(f),
    statusWhenEmpty: (f) => (f.testing === "test_optional" ? "na" : "pending"),
  },
  {
    id: "language",
    section: 2,
    labelKey: "wizard.summary.row.language",
    hintKey: "wizard.summary.hint.language",
    optional: true,
    filled: (f) => Boolean(f.languageScores.trim()),
    value: (f) => f.languageScores.trim() || null,
    statusWhenEmpty: () => "optional",
  },
  {
    id: "special",
    section: 2,
    labelKey: "wizard.summary.row.special",
    hintKey: "wizard.summary.hint.special",
    optional: true,
    filled: (f) =>
      f.academicSpecialFlags.length > 0 || Boolean(f.academicSpecialNotes.trim()),
    value: (f, t) => specialDisplay(f, t),
    statusWhenEmpty: () => "optional",
  },
  {
    id: "hs",
    section: 2,
    labelKey: "wizard.summary.row.hs",
    hintKey: "wizard.summary.hint.hs",
    filled: (f) => Boolean(f.highSchoolSystem),
    value: (f, t) => labelHs(f, t) || null,
  },
  {
    id: "currentSchool",
    section: 2,
    labelKey: "wizard.summary.row.currentSchool",
    hintKey: "wizard.summary.hint.currentSchool",
    filled: (f) => Boolean(f.currentHighSchool.trim()),
    value: (f) => f.currentHighSchool.trim() || null,
  },
  {
    id: "major",
    section: 2,
    labelKey: "wizard.summary.row.major",
    hintKey: "wizard.summary.hint.major",
    filled: (f) => Boolean(f.majorPrimary.trim()),
    value: (f) => f.majorPrimary.trim() || null,
  },
  {
    id: "major2",
    section: 2,
    labelKey: "wizard.summary.row.major2",
    hintKey: "wizard.summary.hint.major2",
    optional: true,
    filled: (f) => Boolean(f.majorSecondary.trim()),
    value: (f) => f.majorSecondary.trim() || null,
    statusWhenEmpty: () => "optional",
  },
  {
    id: "size",
    section: 2,
    labelKey: "wizard.summary.row.size",
    hintKey: "wizard.summary.hint.size",
    filled: (f) => Boolean(f.schoolSize),
    value: (f, t) => labelSchoolSize(f, t) || null,
  },
  {
    id: "culture",
    section: 2,
    labelKey: "wizard.summary.row.culture",
    hintKey: "wizard.summary.hint.culture",
    filled: (f) => Boolean(f.campusCulturePref),
    value: (f, t) => labelCampusCulture(f, t) || null,
  },
  {
    id: "geo",
    section: 2,
    labelKey: "wizard.summary.row.geo",
    hintKey: "wizard.summary.hint.geo",
    filled: (f) => f.geoPrefs.length > 0,
    value: (f, t) => labelGeoPrefs(f, t),
  },
  {
    id: "activities",
    section: 3,
    labelKey: "wizard.summary.row.activities",
    hintKey: "wizard.summary.hint.activities",
    filled: (f) => {
      const complete = (f.structuredActivities ?? []).filter(activityItemMeetsWizardRequirement);
      return complete.length > 0;
    },
    value: (f, t) => {
      const complete = (f.structuredActivities ?? []).filter(activityItemMeetsWizardRequirement);
      if (complete.length > 0) return t("wizard.summary.value.activityCount", { n: complete.length });
      return null;
    },
  },
  {
    id: "risk",
    section: 3,
    labelKey: "wizard.summary.row.risk",
    hintKey: "wizard.summary.hint.risk",
    filled: (f) => Boolean(f.riskStyle),
    value: (f, t) => labelRisk(f, t) || null,
  },
  {
    id: "deal",
    section: 3,
    labelKey: "wizard.summary.row.deal",
    hintKey: "wizard.summary.hint.deal",
    optional: true,
    filled: (f) => Boolean(f.dealbreakers.trim()),
    value: (f) => {
      const d = f.dealbreakers.trim();
      if (!d) return null;
      return d.length > 48 ? `${d.slice(0, 48)}…` : d;
    },
    statusWhenEmpty: () => "optional",
  },
];

const STEP2_SCREEN_IDS = new Set<Step2ScreenId>([
  "gpa",
  "gpaTrend",
  "testing",
  "scores",
  "language",
  "special",
  "hs",
  "currentSchool",
  "major",
  "major2",
  "size",
  "culture",
  "geo",
]);
const STEP3_SCREEN_IDS = new Set<Step3ScreenId>(["activities", "risk", "deal"]);

function specialDisplayFull(form: FormState, t: Translate): string | null {
  const parts = form.academicSpecialFlags.map((flag) => t(`form.opt.special.${flag}`));
  const notes = form.academicSpecialNotes.trim();
  if (notes) parts.push(notes);
  return parts.length ? parts.join(" · ") : null;
}

/** All questionnaire fields expanded (admin eval case read-only view). */
export function buildFullSnapshotRows(form: FormState, t: Translate): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  for (const section of [1, 2, 3] as const) {
    rows.push({
      id: `step-${section}-header`,
      section,
      label: t(`steps.${section}.title`),
      value: null,
      status: "filled",
      hint: "",
      isNext: false,
      isStepSummary: true,
    });
    rows.push(...buildDetailRows(section, form, t));
  }
  for (const row of rows) {
    if (row.id === "deal") {
      const d = form.dealbreakers.trim();
      if (d) row.value = d;
    }
    if (row.id === "special") {
      const v = specialDisplayFull(form, t);
      if (v) row.value = v;
    }
  }
  return rows;
}

export function buildSnapshotRows(
  form: FormState,
  t: Translate,
  currentStep: number,
  step1ScreenId?: Step1ScreenId,
  step2ScreenId?: Step2ScreenId,
  step3ScreenId?: Step3ScreenId,
): SnapshotRow[] {
  const rows: SnapshotRow[] = [];

  for (let section = 1; section <= 3; section += 1) {
    const s = section as 1 | 2 | 3;
    if (s < currentStep) {
      const { filled, total } = sectionProgress(s, form);
      rows.push({
        id: `step-${s}-summary`,
        section: s,
        label: t(`steps.${s}.title`),
        value: t("wizard.summary.stepDone", { filled, total }),
        status: "filled",
        hint: "",
        isNext: false,
        isStepSummary: true,
      });
    } else if (s === currentStep) {
      rows.push(...buildDetailRows(s, form, t));
    }
  }

  applyNextHighlight(rows, currentStep, step1ScreenId, step2ScreenId, step3ScreenId);
  return rows;
}

export function snapshotProgress(rows: SnapshotRow[], currentStep: number): { filled: number; total: number } {
  const detail = rows.filter((r) => !r.isStepSummary && r.section === currentStep);
  const required = detail.filter((r) => r.status !== "optional" && r.status !== "na");
  const filled = required.filter((r) => r.status === "filled").length;
  return { filled, total: required.length };
}
