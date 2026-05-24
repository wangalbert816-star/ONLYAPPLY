import type { ActivityItem, ActivityKind, FormState } from "../types";
import type { Locale } from "../i18n/strings";
import { getEffectiveIntake } from "./intakeTerm";

const CSV_HEADERS = [
  "Activity type",
  "Position / Leadership",
  "Organization name",
  "Description",
  "Grade levels",
  "Hours per week",
  "Weeks per year",
  "Timing",
  "Scope (reference)",
  "Major related (reference)",
  "Proof (reference)",
] as const;

const CA_ACTIVITY_TYPE: Record<ActivityKind, string> = {
  activity: "Extracurricular Activity",
  competition: "Academic / Competition",
  research: "Research",
  internship: "Internship / Work",
  club: "School Club / Organization",
  service: "Community Service",
  arts: "Art / Performance",
  sports: "Athletics",
  other: "Other Club / Activity",
};

function escCsv(v: string): string {
  const s = String(v ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsvLine(cols: string[]): string {
  return cols.map(escCsv).join(",");
}

function isActivityRowEmpty(item: ActivityItem): boolean {
  return ![
    item.name,
    item.kind,
    item.grades,
    item.hours,
    item.role,
    item.description,
    item.outcome,
    item.award,
    item.scope,
    item.majorRelated,
    item.proof,
  ].some((v) => String(v || "").trim());
}

function mergeDescription(item: ActivityItem): string {
  return [item.description, item.outcome, item.award].map((s) => String(s || "").trim()).filter(Boolean).join(" · ");
}

function activityTypeLabel(kind: ActivityItem["kind"]): string {
  if (!kind) return "";
  return CA_ACTIVITY_TYPE[kind as ActivityKind] ?? kind;
}

function scopeLabel(scope: ActivityItem["scope"], locale: Locale): string {
  const zh: Record<string, string> = {
    school: "校内",
    local: "本地",
    regional: "区域",
    state: "州级",
    national: "全国",
    international: "国际",
  };
  const en: Record<string, string> = {
    school: "School",
    local: "Local",
    regional: "Regional",
    state: "State",
    national: "National",
    international: "International",
  };
  if (!scope) return "";
  return (locale === "en" ? en : zh)[scope] ?? scope;
}

function majorRelatedLabel(value: ActivityItem["majorRelated"], locale: Locale): string {
  if (value === "yes") return locale === "en" ? "Yes" : "相关";
  if (value === "no") return locale === "en" ? "No" : "不直接相关";
  if (value === "unsure") return locale === "en" ? "Unsure" : "不确定";
  return "";
}

function csvComments(locale: Locale): string[] {
  if (locale === "en") {
    return [
      "# OnlyApply activity list export · not an official Common App import",
      "# Copy each row into Common App or UC activity forms manually.",
      "# Common App: usually up to 10 activities. UC: up to 20 activities and honors combined.",
      "# Pick your top entries by priority. Character limits apply on each portal.",
    ];
  }
  return [
    "# OnlyApply 活动清单导出 · 非 Common App / UC 官方导入格式",
    "# 请逐条对照复制到 Common App 或 UC 活动表；无法一键批量导入。",
    "# Common App 活动表通常最多 10 条；UC 活动与奖项合计最多 20 条。",
    "# 请按优先级自行选择要填写的条目；各平台栏位有字符上限。",
  ];
}

function activityToRow(item: ActivityItem, locale: Locale): string {
  return rowToCsvLine([
    activityTypeLabel(item.kind),
    item.role || "",
    item.name || "",
    mergeDescription(item),
    item.grades || "",
    item.hours || "",
    "",
    "",
    scopeLabel(item.scope, locale),
    majorRelatedLabel(item.majorRelated, locale),
    item.proof || "",
  ]);
}

export function buildActivitiesCsv(activities: ActivityItem[], locale: Locale): string {
  const rows = (activities ?? []).filter((item) => !isActivityRowEmpty(item));
  const lines = [...csvComments(locale), rowToCsvLine([...CSV_HEADERS]), ...rows.map((item) => activityToRow(item, locale))];
  return `${lines.join("\n")}\n`;
}

export function countExportableActivities(activities: ActivityItem[]): number {
  return (activities ?? []).filter((item) => !isActivityRowEmpty(item)).length;
}

export function downloadActivitiesCsv(activities: ActivityItem[], locale: Locale, intakeLabel?: string): void {
  const csv = buildActivitiesCsv(activities, locale);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const intake = (intakeLabel || "activities").replace(/\s+/g, "-");
  a.href = url;
  a.download = `onlyapply-activities-${intake}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadActivitiesCsvFromForm(
  activities: ActivityItem[],
  locale: Locale,
  form?: Pick<FormState, "intakeTerm" | "intakeOtherDetail">,
): void {
  const intake = form ? getEffectiveIntake(form) : "";
  downloadActivitiesCsv(activities, locale, intake || undefined);
}
