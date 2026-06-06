import type { FormState } from "../../types";
import type { Locale } from "../../i18n/strings";
import { emptyFormState } from "../formDefaults";
import { INTAKE_OTHER_VALUE, INTAKE_PRESETS } from "../intakeTerm";
import { buildReportApiBody } from "../reportApiBody";
import { buildFullSnapshotRows, type SnapshotRow } from "../../components/formSnapshotRows";
import type { Translate } from "../../i18n/LanguageContext";

export type EvalCaseMeta = {
  title: string;
  locale: Locale;
  reachSchools: string;
  matchSchools: string;
  safetySchools: string;
  forbiddenSchools: string;
  notes: string;
};

export type EvalCaseDraft = EvalCaseMeta & { form: FormState };

export function emptyEvalCaseDraft(locale: Locale = "zh"): EvalCaseDraft {
  return {
    title: "",
    locale,
    reachSchools: "",
    matchSchools: "",
    safetySchools: "",
    forbiddenSchools: "",
    notes: "",
    form: emptyFormState(),
  };
}

function splitSchoolLines(raw: string): string[] {
  return raw
    .split(/[\n,;，；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function toExpectedSchools(raw: string) {
  return splitSchoolLines(raw).map((school) => ({ school }));
}

function nextCaseKey(existingKeys: Set<string>) {
  let n = existingKeys.size + 1;
  while (existingKeys.has(`CASE-${String(n).padStart(3, "0")}`)) n += 1;
  return `CASE-${String(n).padStart(3, "0")}`;
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function asOptionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | "" {
  const v = asString(value);
  return (allowed as readonly string[]).includes(v) ? (v as T) : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

export function reportBodyToFormState(body: Record<string, unknown>): FormState {
  const form = emptyFormState();
  const intakeRaw = asString(body.intakeTerm);
  if (intakeRaw && !(INTAKE_PRESETS as readonly string[]).includes(intakeRaw)) {
    form.intakeTerm = INTAKE_OTHER_VALUE;
    form.intakeOtherDetail = intakeRaw;
  } else {
    form.intakeTerm = intakeRaw;
  }

  form.applicantIdentity = asOptionalEnum(body.applicantIdentity, ["intl", "us_citizen", "other"]);
  form.citizenship = asString(body.citizenship);
  form.residenceRegion = asString(body.residenceRegion);
  form.budget = asOptionalEnum(body.budget, ["full_pay", "high_budget", "budget_cap", "need_aid", "unsure"]);
  form.testing = asOptionalEnum(body.testing, ["test_optional", "will_submit"]);
  form.satScore = asString(body.satScore);
  form.actScore = asString(body.actScore);
  form.highSchoolSystem = asString(body.highSchoolSystem);
  form.currentHighSchool = asString(body.currentHighSchool);
  form.gpa = asString(body.gpa);
  form.gpaTrend = asOptionalEnum(body.gpaTrend, ["upward", "stable", "downward", "mixed", "unsure"]);
  form.languageScores = asString(body.languageScores);
  form.academicSpecialNotes = asString(body.academicSpecialNotes);
  form.majorPrimary = asString(body.majorPrimary);
  form.majorSecondary = asString(body.majorSecondary);
  form.schoolSize = asOptionalEnum(body.schoolSize, ["small", "medium", "large", "any"]);
  form.campusCulturePref = asOptionalEnum(body.campusCulturePref, ["academic", "balanced", "social", "any"]);
  form.geoPrefs = asStringArray(body.geoPrefs) as FormState["geoPrefs"];
  form.riskStyle = asOptionalEnum(body.riskStyle, ["conservative", "balanced", "aggressive"]);
  form.dealbreakers = asString(body.dealbreakers);

  const flags = Array.isArray(body.academicSpecialFlags) ? body.academicSpecialFlags : [];
  const allowedFlags = ["low_grades", "gap_year", "health"] as const;
  form.academicSpecialFlags = flags
    .map((flag) => asString(flag))
    .filter((flag): flag is (typeof allowedFlags)[number] => (allowedFlags as readonly string[]).includes(flag));

  if (Array.isArray(body.structuredActivities)) {
    form.structuredActivities = body.structuredActivities
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const name = asString(row.name);
        if (!name) return null;
        return {
          id: asString(row.id) || String(index + 1),
          name,
          kind: asOptionalEnum(row.kind, [
            "activity",
            "competition",
            "research",
            "internship",
            "club",
            "service",
            "arts",
            "sports",
            "other",
          ]),
          grades: asString(row.grades),
          hours: asString(row.hours),
          role: asString(row.role),
          description: asString(row.description),
          outcome: asString(row.outcome),
          award: asString(row.award),
          scope: asOptionalEnum(row.scope, [
            "school",
            "local",
            "regional",
            "state",
            "national",
            "international",
            "",
          ]),
          majorRelated: asOptionalEnum(row.majorRelated, ["yes", "no", "unsure", ""]),
          proof: asString(row.proof),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }

  return form;
}

const ADMIN_FIELD_LABEL_KEYS: Record<string, string> = {
  gpa: "admin.evalHarness.field.gpa",
  scores: "admin.evalHarness.field.scores",
  sat: "admin.evalHarness.field.sat",
  act: "admin.evalHarness.field.act",
  activities: "admin.evalHarness.field.activities",
};

function adminActivitiesSummary(form: FormState, t: Translate): string | null {
  const named = (form.structuredActivities ?? []).map((item) => item.name.trim()).filter(Boolean);
  if (named.length > 0) {
    return t("admin.evalHarness.activityListSummary", { names: named.join("、") });
  }
  const legacy = form.activities.trim();
  return legacy || null;
}

function adminTestScoreValue(raw: string, form: FormState, t: Translate): string {
  if (form.testing === "test_optional") return t("admin.evalHarness.testNotSubmitted");
  const v = raw.trim();
  return v || "—";
}

/** Read-only admin case view: full values, no wizard placeholder hints. */
export function buildAdminEvalFormRows(form: FormState, t: Translate): SnapshotRow[] {
  const rows = buildFullSnapshotRows(form, t).filter((row) => row.id !== "scores");
  const next: SnapshotRow[] = [];

  for (const row of rows) {
    const labelKey = ADMIN_FIELD_LABEL_KEYS[row.id];
    if (labelKey) {
      const label = t(labelKey);
      if (label !== labelKey) row.label = label;
    }

    if (row.id === "activities") {
      row.value = adminActivitiesSummary(form, t);
    }

    if (!row.isStepSummary && !row.value) {
      row.value = "—";
    }

    next.push(row);

    if (row.id === "testing") {
      next.push(
        {
          id: "sat",
          section: 2,
          label: t("admin.evalHarness.field.sat"),
          value: adminTestScoreValue(form.satScore, form, t),
          status: "filled",
          hint: "",
          isNext: false,
        },
        {
          id: "act",
          section: 2,
          label: t("admin.evalHarness.field.act"),
          value: adminTestScoreValue(form.actScore, form, t),
          status: "filled",
          hint: "",
          isNext: false,
        },
      );
    }
  }

  return next;
}

export function expectedSchoolsToText(rows: { school: string; note?: string }[] | undefined) {
  if (!rows?.length) return "";
  return rows.map((row) => (row.note ? `${row.school}（${row.note}）` : row.school)).join("\n");
}

export type EvalCaseExpectedDraft = Pick<
  EvalCaseMeta,
  "reachSchools" | "matchSchools" | "safetySchools" | "forbiddenSchools" | "notes"
>;

export function evalCaseToExpectedDraft(caseRow: {
  expectedReach: { school: string; note?: string }[];
  expectedMatch: { school: string; note?: string }[];
  expectedSafety: { school: string; note?: string }[];
  forbiddenSchools: string[];
  notes: string | null;
}): EvalCaseExpectedDraft {
  return {
    reachSchools: expectedSchoolsToText(caseRow.expectedReach),
    matchSchools: expectedSchoolsToText(caseRow.expectedMatch),
    safetySchools: expectedSchoolsToText(caseRow.expectedSafety),
    forbiddenSchools: caseRow.forbiddenSchools.join("\n"),
    notes: caseRow.notes ?? "",
  };
}

export function buildEvalCaseExpectedPatch(draft: EvalCaseExpectedDraft, uiLocale: Locale = "zh") {
  const base = {
    expectedReach: toExpectedSchools(draft.reachSchools),
    expectedMatch: toExpectedSchools(draft.matchSchools),
    expectedSafety: toExpectedSchools(draft.safetySchools),
    forbiddenSchools: splitSchoolLines(draft.forbiddenSchools),
  };
  const notesValue = draft.notes.trim() || null;
  if (uiLocale === "en") return { ...base, notesEn: notesValue };
  return { ...base, notes: notesValue };
}

export function buildEvalCasePayload(draft: EvalCaseDraft, existingCaseKeys: string[] = []) {
  const title = draft.title.trim();
  if (!title) return { error: "eval_title_required" as const };

  const caseKey = nextCaseKey(new Set(existingCaseKeys));
  const reportBody = buildReportApiBody(draft.form, undefined, draft.locale);

  return {
    payload: {
      caseKey,
      title,
      tags: [],
      reportBody,
      expectedReach: toExpectedSchools(draft.reachSchools),
      expectedMatch: toExpectedSchools(draft.matchSchools),
      expectedSafety: toExpectedSchools(draft.safetySchools),
      forbiddenSchools: splitSchoolLines(draft.forbiddenSchools),
      notes: draft.notes.trim() || null,
    },
  };
}

export type EvalSchoolPreviewRow = {
  school: string;
  why: string;
  risks: string[];
};

export type EvalReportPreview = {
  summaryBullets: string[];
  reach: EvalSchoolPreviewRow[];
  match: EvalSchoolPreviewRow[];
  safety: EvalSchoolPreviewRow[];
  informationGaps: string[];
  improvementPlan: string[];
  portfolioRisks: string[];
};

function mapSchoolRows(rows: unknown, whyKeys: string[]): EvalSchoolPreviewRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const school = String(o.school ?? "").trim();
      if (!school) return null;
      const why =
        whyKeys.map((k) => String(o[k] ?? "").trim()).find(Boolean) ??
        String(o.differentiation ?? "").trim();
      const risks = Array.isArray(o.key_risks)
        ? o.key_risks.map((r) => String(r ?? "").trim()).filter(Boolean).slice(0, 3)
        : [];
      return { school, why, risks };
    })
    .filter((row): row is EvalSchoolPreviewRow => row != null);
}

function pickBullets(raw: unknown, max = 5): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, max);
}

function pickPlanItems(report: Record<string, unknown>): string[] {
  const plan = report.improvement_plan;
  if (!plan || typeof plan !== "object") return [];
  const p = plan as Record<string, unknown>;
  const buckets = ["this_week", "this_month", "before_submitting", "activity_build"] as const;
  const out: string[] = [];
  for (const key of buckets) {
    const items = pickBullets(p[key], 2);
    out.push(...items);
  }
  return out.slice(0, 6);
}

export function buildEvalReportPreview(report: Record<string, unknown> | null | undefined): EvalReportPreview | null {
  if (!report) return null;
  return {
    summaryBullets: pickBullets(report.executive_summary, 5),
    reach: mapSchoolRows(report.reach, ["why_reach_for_you"]),
    match: mapSchoolRows(report.match, ["why_match_for_you"]),
    safety: mapSchoolRows(report.safety, ["why_safety_for_you"]),
    informationGaps: pickBullets(report.information_gaps, 6),
    improvementPlan: pickPlanItems(report),
    portfolioRisks: Array.isArray(report.portfolio_risks)
      ? report.portfolio_risks
          .map((r) => {
            if (!r || typeof r !== "object") return "";
            const o = r as Record<string, unknown>;
            const title = String(o.risk_title ?? "").trim();
            const detail = String(o.what_it_means_for_you ?? "").trim();
            return title && detail ? `${title}：${detail}` : title || detail;
          })
          .filter(Boolean)
          .slice(0, 4)
      : [],
  };
}

/** @deprecated use buildEvalReportPreview */
export function summarizeReportForCounselor(report: Record<string, unknown> | null | undefined) {
  const preview = buildEvalReportPreview(report);
  if (!preview) return null;
  return {
    summary: preview.summaryBullets[0] ?? "",
    reach: preview.reach.map((r) => r.school),
    match: preview.match.map((r) => r.school),
    safety: preview.safety.map((r) => r.school),
  };
}
