import type { FormState, ReportPayload, SchoolRow, SchoolTier } from "../types";
import type { Locale } from "../i18n/strings";
import { campusCultureAlignmentNote } from "./campusCulturePref";
import { enrichSchoolRow } from "./enrichSchoolRow";
import { getEffectiveIntake } from "./intakeTerm";
import { sanitizeReportProse } from "./reportProseSanitize";
import { resolveUcAnalysis } from "./ucApplication";
import { getOfficialLinksForSchool, officialLinkLabel } from "./universityOfficialLinks";
import { splitToBullets } from "./schoolRowDisplay";

function whyText(row: SchoolRow, tier: SchoolTier): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function tierLabel(tier: SchoolTier, locale: Locale): string {
  if (locale === "en") {
    if (tier === "reach") return "Reach";
    if (tier === "match") return "Match";
    return "Safety";
  }
  if (tier === "reach") return "冲刺";
  if (tier === "match") return "匹配";
  return "保底";
}

function escCsv(v: string): string {
  const s = String(v ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsvLine(cols: string[]): string {
  return cols.map(escCsv).join(",");
}

function appendSchoolRows(
  lines: string[],
  tier: SchoolTier,
  rows: SchoolRow[],
  form: FormState,
  locale: Locale,
  listKind: string,
  unlocked: boolean,
) {
  for (const row of rows) {
    const enriched = enrichSchoolRow(row, form, locale);
    const links = getOfficialLinksForSchool(enriched.school, locale)
      .map((l) => `${officialLinkLabel(l, locale)}: ${l.href}`)
      .join(" | ");
    const cultureFit = unlocked ? campusCultureAlignmentNote(form, enriched, locale) || "" : "";
    lines.push(
      rowToCsvLine([
        listKind,
        tierLabel(tier, locale),
        enriched.school,
        splitToBullets(whyText(enriched, tier)).join(" · "),
        enriched.campus_vibe || "",
        unlocked ? enriched.differentiation || "" : "",
        unlocked ? enriched.context_note || "" : "",
        (enriched.key_fit_signals || []).join(" · "),
        (enriched.key_risks || []).join(" · "),
        (enriched.verification_focus || []).join(" · "),
        unlocked ? links : "",
        cultureFit,
        "",
      ]),
    );
  }
}

export function buildReportCsv(
  report: ReportPayload,
  form: FormState,
  locale: Locale,
  unlocked: boolean,
): string {
  const headers =
    locale === "en"
      ? ["List", "Tier", "School", "Why", "Campus vibe", "Differentiation", "Context note", "Fit signals", "Risks", "Verify on official site", "Official links", "Culture fit note", "Your notes"]
      : ["名单", "档位", "学校", "入档理由", "校园气质", "校际差异", "语境参考", "匹配信号", "主要风险", "官网核对项", "官方链接", "社区偏好对照", "你的备注"];

  const lines: string[] = [rowToCsvLine(headers)];
  const listMain = locale === "en" ? "Main 9 schools" : "主名单 9 校";
  const safeReport = sanitizeReportProse(report, locale);

  if (unlocked) {
    for (const tier of ["reach", "match", "safety"] as const) {
      appendSchoolRows(lines, tier, safeReport[tier] ?? [], form, locale, listMain, unlocked);
    }
    const uc = resolveUcAnalysis(safeReport, form, locale);
    if (uc) {
      const listUc = locale === "en" ? "UC campuses" : "UC 校区";
      for (const tier of ["reach", "match", "safety"] as const) {
        appendSchoolRows(lines, tier, uc[tier] ?? [], form, locale, listUc, unlocked);
      }
    }
  } else {
    for (const tier of ["reach", "match", "safety"] as const) {
      const rows = safeReport[tier] ?? [];
      if (rows[0]) appendSchoolRows(lines, tier, [rows[0]], form, locale, listMain, unlocked);
    }
  }

  const intake = getEffectiveIntake(form);
  const meta =
    locale === "en"
      ? `# OnlyApply export · ${intake || "intake TBD"} · ${unlocked ? "full" : "preview"}`
      : `# OnlyApply 导出 · ${intake || "入学季待定"} · ${unlocked ? "完整版" : "预览"}`;
  return `${meta}\n${lines.join("\n")}\n`;
}

export function downloadReportCsv(
  report: ReportPayload,
  form: FormState,
  locale: Locale,
  unlocked: boolean,
): void {
  const csv = buildReportCsv(report, form, locale, unlocked);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const intake = getEffectiveIntake(form).replace(/\s+/g, "-") || "report";
  a.href = url;
  a.download = `onlyapply-school-list-${intake}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
