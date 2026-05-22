import type { FormState, ReportPayload, SchoolRow, SchoolTier, UcAnalysis } from "../types";
import type { Locale } from "../i18n/strings";

function escapeCsvCell(s: string): string {
  const v = (s || "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return /[",\n]/.test(v) ? `"${v}"` : v;
}

function whyForTier(row: SchoolRow, tier: SchoolTier): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function tierLabel(tier: SchoolTier, locale: Locale): string {
  if (locale === "en") {
    return tier === "reach" ? "Reach" : tier === "match" ? "Match" : "Safety";
  }
  return tier === "reach" ? "冲刺" : tier === "match" ? "匹配" : "保底";
}

function rowsToCsvLines(
  rows: SchoolRow[],
  tier: SchoolTier,
  locale: Locale,
  notesCol: string,
): string[] {
  return rows.map((row) => {
    const links = (row.official_links ?? []).map((l) => `${l.label}: ${l.url}`).join(" | ");
    return [
      tierLabel(tier, locale),
      row.school,
      row.campus_vibe || "",
      row.school_differentiator || "",
      whyForTier(row, tier),
      (row.key_fit_signals || []).join("; "),
      (row.key_risks || []).join("; "),
      (row.verification_focus || []).join("; "),
      links,
      notesCol,
    ]
      .map(escapeCsvCell)
      .join(",");
  });
}

export function buildReportCsv(
  report: ReportPayload,
  form: FormState,
  locale: Locale,
  uc: UcAnalysis | null,
  unlocked: boolean,
): string {
  const header =
    locale === "en"
      ? "Tier,School,Campus vibe,Differentiator,Why tier,Fit signals,Risks,Verify on official site,Links,Your notes"
      : "档位,学校,社区气质,差异化要点,入档理由,匹配信号,主要风险,官网核对项,快捷链接,你的备注";
  const lines = [header];
  const emptyNotes = "";

  if (unlocked) {
    for (const tier of ["reach", "match", "safety"] as const) {
      lines.push(...rowsToCsvLines(report[tier] ?? [], tier, locale, emptyNotes));
    }
    if (uc) {
      for (const tier of ["reach", "match", "safety"] as const) {
        lines.push(...rowsToCsvLines(uc[tier] ?? [], tier, locale, emptyNotes));
      }
    }
  } else {
    for (const tier of ["reach", "match", "safety"] as const) {
      const preview = (report[tier] ?? []).slice(0, 1);
      lines.push(...rowsToCsvLines(preview, tier, locale, emptyNotes));
    }
  }

  lines.push("");
  lines.push(
    escapeCsvCell(
      locale === "en"
        ? `Major: ${form.majorPrimary}; Intake: ${form.intakeTerm}; Export preview=${unlocked ? "full" : "partial"}`
        : `主申: ${form.majorPrimary}; 入学季: ${form.intakeTerm}; 导出=${unlocked ? "完整" : "预览"}`,
    ),
  );
  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
