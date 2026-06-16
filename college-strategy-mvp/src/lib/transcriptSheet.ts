import type {
  FormState,
  GradingScale,
  TranscriptCourseLevel,
  TranscriptCourseRow,
  TranscriptGradeYear,
  TranscriptSheet,
} from "../types";
import {
  isPlausibleCourseRow,
  isValidTranscriptGrade,
  sanitizeGpaValue,
} from "./transcriptCourseValidate";

export function createTranscriptCourseRow(partial?: Partial<TranscriptCourseRow>): TranscriptCourseRow {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    gradeYear: partial?.gradeYear ?? "11",
    subject: partial?.subject ?? "",
    courseName: partial?.courseName ?? "",
    level: partial?.level ?? "regular",
    grade: partial?.grade ?? "",
    confidence: partial?.confidence,
    source: partial?.source ?? "user",
  };
}

export function emptyTranscriptSheet(): TranscriptSheet {
  return {
    gradingScale: "",
    scaleNotes: "",
    unweightedGpa: "",
    weightedGpa: "",
    courses: [],
    parseStatus: "idle",
    parseError: "",
    confirmedAt: "",
    fileName: "",
    skipped: false,
  };
}

export function ensureTranscriptSheet(form: FormState): TranscriptSheet {
  return form.transcriptSheet ?? emptyTranscriptSheet();
}

export function transcriptSheetIsUsable(sheet: TranscriptSheet | undefined): boolean {
  if (!sheet || sheet.skipped || !sheet.confirmedAt) return false;
  const hasGpa = Boolean(sheet.unweightedGpa.trim() || sheet.weightedGpa.trim());
  const hasCourse = sheet.courses.some((c) => c.courseName.trim() && c.grade.trim());
  return Boolean(sheet.gradingScale && (hasGpa || hasCourse)) || hasCourse;
}

export type TranscriptRigorStats = {
  apCount: number;
  ibHlCount: number;
  ibSlCount: number;
  honorsCount: number;
  totalCourses: number;
  highRigorRatio: number;
};

export function computeTranscriptRigorStats(sheet: TranscriptSheet | undefined): TranscriptRigorStats | null {
  if (!sheet || sheet.skipped) return null;
  const courses = sheet.courses.filter((c) => c.courseName.trim());
  if (courses.length === 0 && !sheet.unweightedGpa.trim() && !sheet.weightedGpa.trim()) return null;

  let apCount = 0;
  let ibHlCount = 0;
  let ibSlCount = 0;
  let honorsCount = 0;
  for (const c of courses) {
    if (c.level === "ap") apCount += 1;
    else if (c.level === "ib_hl") ibHlCount += 1;
    else if (c.level === "ib_sl") ibSlCount += 1;
    else if (c.level === "honors" || c.level === "a_level" || c.level === "dual_enrollment") honorsCount += 1;
  }
  const totalCourses = courses.length || 1;
  const highRigor = apCount + ibHlCount + honorsCount;
  return {
    apCount,
    ibHlCount,
    ibSlCount,
    honorsCount,
    totalCourses: courses.length,
    highRigorRatio: courses.length ? highRigor / totalCourses : 0,
  };
}

function parseGpaFromText(text: string): { unweighted: string; weighted: string } {
  const t = text.trim();
  if (!t) return { unweighted: "", weighted: "" };
  const uw = t.match(/(?:unweighted|UW|未加权|非加权)[^\d]*(\d(?:\.\d{1,2})?)/i);
  const w = t.match(/(?:weighted|W(?!ed)|加权)[^\d]*(\d(?:\.\d{1,2})?)/i);
  return {
    unweighted: sanitizeGpaValue(uw?.[1] ?? "", { min: 1.5, max: 4.5 }),
    weighted: sanitizeGpaValue(w?.[1] ?? "", { min: 2.0, max: 5.5 }),
  };
}

function inferCourseLevel(name: string): TranscriptCourseLevel {
  const n = name.toLowerCase();
  if (/\bap\b|advanced placement/i.test(n)) return "ap";
  if (/ib\s*hl|\bhl\b/i.test(n)) return "ib_hl";
  if (/ib\s*sl|\bsl\b/i.test(n)) return "ib_sl";
  if (/honors|honours|a-?level|a level/i.test(n)) return "honors";
  if (/dual\s*enroll|de\b/i.test(n)) return "dual_enrollment";
  return "regular";
}

function inferGradeYear(line: string, fallback: TranscriptGradeYear): TranscriptGradeYear {
  if (/\b(grade\s*)?9\b|freshman|九年级/i.test(line)) return "9";
  if (/\b(grade\s*)?10\b|sophomore|十年级/i.test(line)) return "10";
  if (/\b(grade\s*)?11\b|junior|十一年级/i.test(line)) return "11";
  if (/\b(grade\s*)?12\b|senior|十二年级/i.test(line)) return "12";
  return fallback;
}

function inferSubject(courseName: string): string {
  const n = courseName.toLowerCase();
  if (/calc|algebra|math|geometry|statistics|precalc/i.test(n)) return "Math";
  if (/english|literature|writing|lang/i.test(n)) return "English";
  if (/physics|chemistry|biology|science|env/i.test(n)) return "Science";
  if (/history|government|economics|geo|social/i.test(n)) return "Social Studies";
  if (/chinese|spanish|french|mandarin|language/i.test(n)) return "Language";
  if (/computer|programming|cs\b/i.test(n)) return "CS";
  return "Other";
}

/** Heuristic parser for pasted transcript text (local / fallback). */
export function parseTranscriptTextHeuristic(raw: string): Partial<TranscriptSheet> {
  const text = raw.replace(/\r/g, "\n").trim();
  const gpas = parseGpaFromText(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const courses: TranscriptCourseRow[] = [];

  for (const line of lines) {
    if (line.length < 4) continue;
    if (/gpa|绩点|weighted|unweighted|class rank|rank/i.test(line) && !/\b[A-F][+-]?\b/.test(line)) continue;

    const gradeMatch =
      line.match(/([A-F][+-]?|\d{1,3})\s*$/) ||
      line.match(/\b(\d{1,2})\s*\/\s*7\b/) ||
      line.match(/\b([1-7])\s*$/);
    if (!gradeMatch) continue;

    const grade = gradeMatch[1];
    let coursePart = line.slice(0, gradeMatch.index).replace(/[|\t,;]+/g, " ").trim();
    coursePart = coursePart.replace(/^(grade\s*)?(9|10|11|12)\s*/i, "").trim();
    if (coursePart.length < 2) continue;
    if (!isValidTranscriptGrade(grade) || !isPlausibleCourseRow(coursePart, grade)) continue;

    const level = inferCourseLevel(coursePart);
    courses.push(
      createTranscriptCourseRow({
        gradeYear: inferGradeYear(line, "11"),
        subject: inferSubject(coursePart),
        courseName: coursePart,
        level,
        grade,
        confidence: "medium",
        source: "ocr",
      }),
    );
  }

  return {
    gradingScale: gpas.unweighted ? "4.0_uw" : "",
    unweightedGpa: gpas.unweighted,
    weightedGpa: gpas.weighted,
    courses: courses.slice(0, 40),
    parseStatus: courses.length || gpas.unweighted ? "ready" : "failed",
    parseError: courses.length || gpas.unweighted ? "" : "no_courses_detected",
  };
}

export function syncGpaSummaryFromSheet(sheet: TranscriptSheet): string {
  if (sheet.skipped) return "";
  const parts: string[] = [];
  if (sheet.unweightedGpa.trim()) parts.push(`UW ${sheet.unweightedGpa.trim()}`);
  if (sheet.weightedGpa.trim()) parts.push(`W ${sheet.weightedGpa.trim()}`);
  const stats = computeTranscriptRigorStats(sheet);
  if (stats && stats.apCount > 0) parts.push(`${stats.apCount}×AP`);
  if (stats && stats.ibHlCount > 0) parts.push(`${stats.ibHlCount}×IB HL`);
  if (stats && stats.honorsCount > 0) parts.push(`${stats.honorsCount}×Honors+`);
  if (sheet.scaleNotes.trim()) parts.push(sheet.scaleNotes.trim());
  const courseLines = sheet.courses
    .filter((c) => c.courseName.trim() && c.grade.trim())
    .slice(0, 8)
    .map((c) => `${c.gradeYear}: ${c.courseName} (${c.level}) ${c.grade}`);
  if (courseLines.length) parts.push(courseLines.join("; "));
  return parts.join(" · ");
}

export function formatTranscriptSheetForPrompt(sheet: TranscriptSheet | undefined, locale: "en" | "zh"): string {
  if (!sheet || sheet.skipped || !transcriptSheetIsUsable(sheet)) return "";
  const stats = computeTranscriptRigorStats(sheet);
  const lines: string[] = [];
  if (locale === "en") {
    lines.push("[Structured transcript sheet — user confirmed; use for GPA and course rigor analysis]");
    if (sheet.gradingScale) lines.push(`Grading scale: ${sheet.gradingScale}`);
    if (sheet.unweightedGpa.trim()) lines.push(`Unweighted GPA: ${sheet.unweightedGpa.trim()}`);
    if (sheet.weightedGpa.trim()) lines.push(`Weighted GPA: ${sheet.weightedGpa.trim()}`);
    if (stats) {
      lines.push(
        `Rigor summary: AP ${stats.apCount}, IB HL ${stats.ibHlCount}, Honors+ ${stats.honorsCount}, high-rigor share ${Math.round(stats.highRigorRatio * 100)}%`,
      );
    }
    for (const c of sheet.courses.filter((r) => r.courseName.trim())) {
      lines.push(
        `- G${c.gradeYear} | ${c.subject || "—"} | ${c.courseName} | ${c.level} | grade ${c.grade || "—"}`,
      );
    }
  } else {
    lines.push("【结构化成绩单表 — 用户已确认；GPA 与课程 rigor 分析优先使用此表】");
    if (sheet.gradingScale) lines.push(`分制：${sheet.gradingScale}`);
    if (sheet.unweightedGpa.trim()) lines.push(`未加权 GPA：${sheet.unweightedGpa.trim()}`);
    if (sheet.weightedGpa.trim()) lines.push(`加权 GPA：${sheet.weightedGpa.trim()}`);
    if (stats) {
      lines.push(
        `Rigor 汇总：AP ${stats.apCount} 门，IB HL ${stats.ibHlCount} 门，Honors+ ${stats.honorsCount} 门，高难度占比约 ${Math.round(stats.highRigorRatio * 100)}%`,
      );
    }
    for (const c of sheet.courses.filter((r) => r.courseName.trim())) {
      lines.push(`- ${c.gradeYear} 年级 | ${c.subject || "—"} | ${c.courseName} | ${c.level} | 成绩 ${c.grade || "—"}`);
    }
  }
  return lines.join("\n");
}

export const GRADING_SCALE_OPTIONS: { value: GradingScale; labelKey: string }[] = [
  { value: "4.0_uw", labelKey: "form.transcriptSheet.scale.4_0_uw" },
  { value: "4.0_w", labelKey: "form.transcriptSheet.scale.4_0_w" },
  { value: "100", labelKey: "form.transcriptSheet.scale.100" },
  { value: "ib", labelKey: "form.transcriptSheet.scale.ib" },
  { value: "a_level", labelKey: "form.transcriptSheet.scale.a_level" },
  { value: "other", labelKey: "form.transcriptSheet.scale.other" },
];

export const COURSE_LEVEL_OPTIONS: { value: TranscriptCourseLevel; labelKey: string }[] = [
  { value: "regular", labelKey: "form.transcriptSheet.level.regular" },
  { value: "honors", labelKey: "form.transcriptSheet.level.honors" },
  { value: "ap", labelKey: "form.transcriptSheet.level.ap" },
  { value: "ib_hl", labelKey: "form.transcriptSheet.level.ib_hl" },
  { value: "ib_sl", labelKey: "form.transcriptSheet.level.ib_sl" },
  { value: "a_level", labelKey: "form.transcriptSheet.level.a_level" },
  { value: "dual_enrollment", labelKey: "form.transcriptSheet.level.dual_enrollment" },
  { value: "other", labelKey: "form.transcriptSheet.level.other" },
];

export const GRADE_YEAR_OPTIONS: TranscriptGradeYear[] = ["9", "10", "11", "12", "other"];
