/** POST /api/transcript/parse — draft grade sheet from upload or text. */

import { resolveVisionLlmClient, visionLlmConfigHint } from "./llmVisionConfig.mjs";
import OpenAI from "openai";
import { parseJsonFromLlm } from "./parseLlmJson.mjs";
import { extractPdfText, renderPdfPagesToPngBase64 } from "./pdfExtract.mjs";
import {
  filterTranscriptCourses,
  isPlausibleCourseRow,
  sanitizeGpaValue,
} from "./transcriptCourseValidate.mjs";

const PARSE_SCHEMA = {
  gradingScale: "",
  unweightedGpa: "",
  weightedGpa: "",
  scaleNotes: "",
  courses: [],
};

function parseGpaFromText(text) {
  const t = String(text || "").trim();
  const uw = t.match(/(?:unweighted|UW|未加权|非加权)[^\d]*(\d+(?:\.\d+)?)/i);
  const w = t.match(/(?:weighted|加权)[^\d]*(\d+(?:\.\d+)?)/i);
  return {
    unweighted: sanitizeGpaValue(uw?.[1], { min: 1.5, max: 4.5 }),
    weighted: sanitizeGpaValue(w?.[1], { min: 2.0, max: 5.5 }),
  };
}

function normalizeTranscriptSheet(sheet) {
  if (!sheet) return sheet;
  const courses = filterTranscriptCourses(sheet.courses);
  const unweightedGpa = sanitizeGpaValue(sheet.unweightedGpa, { min: 1.5, max: 4.5 });
  const weightedGpa = sanitizeGpaValue(sheet.weightedGpa, { min: 2.0, max: 5.5 });
  const ok = courses.length > 0 || unweightedGpa || weightedGpa;
  return {
    ...sheet,
    courses,
    unweightedGpa,
    weightedGpa,
    parseStatus: ok ? "ready" : "failed",
    parseError: ok ? "" : "no_courses_detected",
  };
}

function inferCourseLevel(name) {
  const n = String(name).toLowerCase();
  if (/\bap\b|advanced placement/i.test(n)) return "ap";
  if (/ib\s*hl|\bhl\b/i.test(n)) return "ib_hl";
  if (/ib\s*sl|\bsl\b/i.test(n)) return "ib_sl";
  if (/honors|honours|a-?level/i.test(n)) return "honors";
  if (/dual\s*enroll/i.test(n)) return "dual_enrollment";
  return "regular";
}

function inferGradeYear(line) {
  if (/\b(grade\s*)?9\b|freshman|九年级/i.test(line)) return "9";
  if (/\b(grade\s*)?10\b|sophomore|十年级/i.test(line)) return "10";
  if (/\b(grade\s*)?11\b|junior|十一年级/i.test(line)) return "11";
  if (/\b(grade\s*)?12\b|senior|十二年级/i.test(line)) return "12";
  return "11";
}

function inferSubject(courseName) {
  const n = String(courseName).toLowerCase();
  if (/calc|algebra|math|geometry|statistics/i.test(n)) return "Math";
  if (/english|literature|writing/i.test(n)) return "English";
  if (/physics|chemistry|biology|science/i.test(n)) return "Science";
  if (/history|government|economics|social/i.test(n)) return "Social Studies";
  if (/chinese|spanish|french|language/i.test(n)) return "Language";
  if (/computer|programming|cs\b/i.test(n)) return "CS";
  return "Other";
}

function newCourseId() {
  return `tc-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function parseCourseFromLine(line) {
  const trimmed = String(line || "").trim();
  if (trimmed.length < 4) return null;
  if (/gpa|绩点|weighted|unweighted|class rank|transcript|school|student/i.test(trimmed) && !/\b[A-F][+-]?\b/.test(trimmed)) {
    return null;
  }

  const tabCols = trimmed.split(/\t|\|/).map((c) => c.trim()).filter(Boolean);
  if (tabCols.length >= 2) {
    const last = tabCols[tabCols.length - 1];
    const gradeMatch = last.match(/^([A-F][+-]?|\d{1,3})$/);
    if (gradeMatch) {
      const coursePart = tabCols.length >= 3 ? tabCols.slice(1, -1).join(" ") : tabCols[0];
      const name = coursePart.replace(/^(grade\s*)?(9|10|11|12)\s*/i, "").trim();
      if (name.length >= 2 && isPlausibleCourseRow(name, gradeMatch[1])) {
        return { coursePart: name, grade: gradeMatch[1], line: trimmed };
      }
    }
  }

  const spaced = trimmed.match(
    /^(?:(?:\d{4}[-/]\d{2,4}|[SF]\d{2})\s+)?(?:(?:grade\s*)?(9|10|11|12)\s+)?(.+?)\s+([A-F][+-]?|\d{1,3})\s*$/i,
  );
  if (spaced) {
    const coursePart = spaced[2].trim();
    if (coursePart.length >= 2) {
      if (!isPlausibleCourseRow(coursePart, spaced[3])) return null;
      return { coursePart, grade: spaced[3], line: trimmed };
    }
  }

  const gradeMatch = trimmed.match(/([A-F][+-]?|\d{1,3})\s*$/) || trimmed.match(/\b([1-7])\s*$/);
  if (!gradeMatch) return null;
  let coursePart = trimmed.slice(0, gradeMatch.index).replace(/[|\t,;]+/g, " ").trim();
  coursePart = coursePart.replace(/^(grade\s*)?(9|10|11|12)\s*/i, "").trim();
  if (coursePart.length < 2) return null;
  if (!isPlausibleCourseRow(coursePart, gradeMatch[1])) return null;
  return { coursePart, grade: gradeMatch[1], line: trimmed };
}

export function heuristicParseTranscriptText(raw) {
  const text = String(raw || "").replace(/\r/g, "\n").trim();
  const gpas = parseGpaFromText(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const courses = [];

  for (const line of lines) {
    const parsed = parseCourseFromLine(line);
    if (!parsed) continue;
    courses.push({
      id: newCourseId(),
      gradeYear: inferGradeYear(parsed.line),
      subject: inferSubject(parsed.coursePart),
      courseName: parsed.coursePart,
      level: inferCourseLevel(parsed.coursePart),
      grade: parsed.grade,
      confidence: "medium",
      source: "ocr",
    });
  }

  return normalizeTranscriptSheet({
    gradingScale: gpas.unweighted ? "4.0_uw" : "",
    unweightedGpa: gpas.unweighted,
    weightedGpa: gpas.weighted,
    scaleNotes: "",
    courses: courses.slice(0, 40),
    parseStatus: courses.length || gpas.unweighted ? "ready" : "failed",
    parseError: courses.length || gpas.unweighted ? "" : "no_courses_detected",
  });
}

function sheetHasUsableCourses(sheet) {
  if (!sheet) return false;
  const normalized = normalizeTranscriptSheet(sheet);
  const hasGpa = Boolean(normalized.unweightedGpa?.trim() || normalized.weightedGpa?.trim());
  const hasCourse = normalized.courses.length > 0;
  return hasGpa || hasCourse;
}

const VISION_PROMPT = `You are reading a high school transcript image. Extract ONLY academic course rows into JSON.

INCLUDE: rows from course/grade tables — subject titles like "AP Calculus BC", "English 11 Honors", "Chemistry" with a letter grade (A, B+, etc.) or numeric grade (0-100).

EXCLUDE completely (do NOT put in courses[]):
- Student name, age, birthdate, gender, address, phone, email
- Student ID, state ID, SSN, barcode numbers
- School name, district, counselor, page numbers
- GPA summary lines, class rank, credits earned/attempted
- Column headers (Course, Grade, Term, Semester, Year)
- Term codes like "2022-2023" or "78 2022-2023 1 9" without a real course title
- Rows where the "grade" is an age, ID digit, or school year

Schema:
{
  "gradingScale": "4.0_uw"|"4.0_w"|"100"|"ib"|"a_level"|"other"|"",
  "unweightedGpa": string (only if explicitly labeled unweighted/UW, else ""),
  "weightedGpa": string (only if explicitly labeled weighted/W, else ""),
  "scaleNotes": string,
  "courses": [{ "gradeYear": "9"|"10"|"11"|"12"|"other", "subject": string, "courseName": string, "level": "regular"|"honors"|"ap"|"ib_hl"|"ib_sl"|"a_level"|"dual_enrollment"|"other", "grade": string }]
}

Rules:
- courseName must be an academic course title (at least 2 words OR contains subject keywords).
- grade must be a letter grade or 55-100 numeric score, NOT student ID or year.
- unweightedGpa/weightedGpa must be between 1.5 and 5.5; leave empty if unsure.
- Return at most 40 courses. JSON only.`;

function visionApiErrorCode(err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timed out|timeout|ETIMEDOUT/i.test(msg)) return "vision_timeout";
  if (/does not exist|not have access|404/i.test(msg)) return "endpoint_not_found";
  if (/can only support text|only support text|multimodal|image|vision|unsupported.*content/i.test(msg)) {
    return "vision_model_unsupported";
  }
  return "vision_parse_failed";
}

function mergeSheets(primary, fallback) {
  if (!fallback) return normalizeTranscriptSheet(primary);
  if (!primary) return normalizeTranscriptSheet(fallback);
  const primaryCourses = filterTranscriptCourses(primary.courses);
  const fallbackCourses = filterTranscriptCourses(fallback.courses);
  const courses = primaryCourses.length ? primaryCourses : fallbackCourses;
  return normalizeTranscriptSheet({
    gradingScale: primary.gradingScale || fallback.gradingScale || "",
    unweightedGpa: primary.unweightedGpa || fallback.unweightedGpa || "",
    weightedGpa: primary.weightedGpa || fallback.weightedGpa || "",
    scaleNotes: primary.scaleNotes || fallback.scaleNotes || "",
    courses,
    parseStatus: "ready",
    parseError: "",
  });
}

async function parseWithVisionLlm(imageBase64List, mimeType = "image/png") {
  const cfg = resolveVisionLlmClient();
  if (!cfg) return { sheet: null, error: "vision_not_configured" };

  const first = await callVisionLlm(cfg, imageBase64List, mimeType);
  if (!first.error || first.error === "no_courses_detected") return first;

  const sk = String(process.env.US_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  if (
    /^sk-/.test(sk) &&
    cfg.provider !== "openai" &&
    /vision_model_unsupported|endpoint_not_found|vision_parse_failed/i.test(first.error)
  ) {
    const timeoutMs = Number(process.env.TRANSCRIPT_VISION_TIMEOUT_MS || 0) || 180_000;
    const fallbackCfg = {
      client: new OpenAI({ apiKey: sk, timeout: timeoutMs }),
      model: "gpt-4o-mini",
      provider: "openai",
    };
    console.info("[transcript/parse] vision_retry openai/gpt-4o-mini after", first.error);
    return callVisionLlm(fallbackCfg, imageBase64List, mimeType);
  }

  return first;
}

async function callVisionLlm(cfg, imageBase64List, mimeType = "image/png") {
  const { client, model, provider } = cfg;

  const images = Array.isArray(imageBase64List) ? imageBase64List : [imageBase64List];
  const totalBytes = images.reduce((n, b64) => n + Math.ceil((b64.length * 3) / 4), 0);
  console.info(
    `[transcript/parse] vision_start model=${model} images=${images.length} bytes≈${Math.round(totalBytes / 1024)}KB thinking=disabled`,
  );

  const content = [
    { type: "text", text: VISION_PROMPT },
    ...images.map((b64) => ({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${b64}` },
    })),
  ];

  try {
    /** @type {Record<string, unknown>} */
    const request = {
      model,
      messages: [
        { role: "system", content: "You extract academic course rows from transcripts. Ignore demographics and headers. Output valid JSON only." },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    };
    // Transcript OCR is structured extraction — disable Ark thinking for much faster responses.
    if (provider === "volcengine-ark") {
      request.thinking = { type: "disabled" };
    }

    const res = await client.chat.completions.create(request);

    const raw = res.choices?.[0]?.message?.content ?? "";
    console.info(`[transcript/parse] vision_done model=${model} chars=${raw.length}`);
    const parsed = parseJsonFromLlm(raw);
  const courses = Array.isArray(parsed.courses)
    ? parsed.courses.map((c) => ({
        id: newCourseId(),
        gradeYear: c.gradeYear || "11",
        subject: String(c.subject || inferSubject(c.courseName || "")),
        courseName: String(c.courseName || "").trim(),
        level: c.level || inferCourseLevel(c.courseName || ""),
        grade: String(c.grade || "").trim(),
        confidence: "medium",
        source: "ocr",
      }))
    : [];
  const sheet = normalizeTranscriptSheet({
    gradingScale: parsed.gradingScale || "",
    unweightedGpa: String(parsed.unweightedGpa || "").trim(),
    weightedGpa: String(parsed.weightedGpa || "").trim(),
    scaleNotes: String(parsed.scaleNotes || "").trim(),
    courses: courses.filter((c) => c.courseName),
    parseStatus: courses.length ? "ready" : "failed",
    parseError: courses.length ? "" : "no_courses_detected",
  });
  return { sheet, error: sheetHasUsableCourses(sheet) ? "" : "no_courses_detected" };
  } catch (e) {
    const code = e?.code === "invalid_json" ? "vision_parse_failed" : visionApiErrorCode(e);
    console.warn("[transcript/parse] vision_failed", e instanceof Error ? e.message : e);
    return {
      sheet: { ...PARSE_SCHEMA, parseStatus: "failed", parseError: code },
      error: code,
    };
  }
}

async function parsePdfBuffer(buffer) {
  let text = "";
  try {
    text = await extractPdfText(buffer);
  } catch (e) {
    console.warn("[transcript/parse] pdf_text_extract_failed", e instanceof Error ? e.message : e);
  }

  let textSheet = null;
  if (text.length >= 20) {
    textSheet = heuristicParseTranscriptText(text);
    const hasCourses = textSheet.courses?.some((c) => c.courseName?.trim());
    if (hasCourses) {
      return { sheet: textSheet, method: "pdf_text" };
    }
  }

  const cfg = resolveVisionLlmClient();
  if (!cfg) {
    if (textSheet && sheetHasUsableCourses(textSheet)) {
      return { sheet: textSheet, method: "pdf_text_partial" };
    }
    return {
      sheet: {
        ...PARSE_SCHEMA,
        ...(textSheet ?? {}),
        parseStatus: "failed",
        parseError: text.length >= 20 ? "no_courses_detected" : "vision_not_configured",
      },
      method: "pdf_vision_unconfigured",
    };
  }

  try {
    const pages = await renderPdfPagesToPngBase64(buffer, 4);
    if (pages.length === 0) {
      if (textSheet && sheetHasUsableCourses(textSheet)) {
        return { sheet: textSheet, method: "pdf_text_partial", warning: "pdf_render_failed" };
      }
      return {
        sheet: { ...PARSE_SCHEMA, parseStatus: "failed", parseError: "pdf_render_failed" },
        method: "pdf_vision",
      };
    }
    const { sheet, error } = await parseWithVisionLlm(pages, "image/png");
    const merged = mergeSheets(sheet ?? PARSE_SCHEMA, textSheet);
    if (sheetHasUsableCourses(merged)) {
      if (error && !merged.courses?.some((c) => c.courseName?.trim())) {
        merged.parseError = error;
      }
      return { sheet: merged, method: merged.courses?.length ? "pdf_vision" : "pdf_text_partial", warning: error || "" };
    }
    return {
      sheet: merged ?? { ...PARSE_SCHEMA, parseStatus: "failed", parseError: error || "no_courses_detected" },
      method: "pdf_vision",
      warning: error || "",
    };
  } catch (e) {
    console.warn("[transcript/parse] pdf_vision_failed", e instanceof Error ? e.message : e);
    if (textSheet && sheetHasUsableCourses(textSheet)) {
      return { sheet: textSheet, method: "pdf_text_partial", warning: "vision_parse_failed" };
    }
    return {
      sheet: { ...PARSE_SCHEMA, parseStatus: "failed", parseError: "vision_parse_failed" },
      method: "pdf_vision",
    };
  }
}

export function registerTranscriptParseRoutes(app, express) {
  app.post("/api/transcript/parse", express.json({ limit: "12mb" }), async (req, res) => {
    try {
      const locale = String(req.body?.locale ?? "zh").trim() === "en" ? "en" : "zh";
      const text = String(req.body?.text ?? "").trim();
      if (text) {
        return res.json({ sheet: heuristicParseTranscriptText(text) });
      }

      const dataBase64 = String(req.body?.dataBase64 ?? "").trim();
      const mimeType = String(req.body?.mimeType ?? "application/octet-stream").trim();
      const fileName = String(req.body?.fileName ?? "").trim().toLowerCase();
      if (!dataBase64) {
        return res.status(400).json({ error: "text_or_file_required" });
      }

      const buffer = Buffer.from(dataBase64, "base64");
      const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf");

      if (isPdf) {
        const { sheet, method, warning } = await parsePdfBuffer(buffer);
        if (sheetHasUsableCourses(sheet)) {
          return res.json({ sheet, method, warning: warning || undefined });
        }
        const hint =
          sheet?.parseError === "vision_not_configured" ? visionLlmConfigHint(locale) : undefined;
        return res.status(422).json({
          error: sheet?.parseError || "parse_failed",
          hint,
          sheet,
        });
      }

      if (mimeType.startsWith("image/")) {
        const { sheet, error } = await parseWithVisionLlm([dataBase64], mimeType);
        if (sheet && sheetHasUsableCourses(sheet)) {
          return res.json({ sheet, method: "image_vision" });
        }
        const errCode = error || sheet?.parseError || "vision_parse_failed";
        return res.status(422).json({
          error: errCode,
          hint: errCode === "vision_not_configured" ? visionLlmConfigHint(locale) : undefined,
          sheet: sheet ?? { ...PARSE_SCHEMA, parseStatus: "failed", parseError: errCode },
        });
      }

      return res.status(422).json({
        error: "parse_unsupported_format",
        sheet: { ...PARSE_SCHEMA, parseStatus: "failed", parseError: "parse_unsupported_format" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[transcript/parse]", msg);
      return res.status(500).json({ error: msg });
    }
  });
}

export function formatTranscriptSheetBlock(sheet, locale = "en") {
  if (!sheet || sheet.skipped || !sheet.confirmedAt) return "";
  const isEn = locale === "en";
  const lines = [];
  if (isEn) {
    lines.push("[Structured transcript grade sheet — user confirmed; prioritize for GPA & course rigor]");
  } else {
    lines.push("【结构化课程成绩表 — 用户已确认；GPA 与课程 rigor 分析优先使用此表】");
  }
  if (sheet.gradingScale) {
    lines.push(isEn ? `Grading scale: ${sheet.gradingScale}` : `分制：${sheet.gradingScale}`);
  }
  if (sheet.unweightedGpa) {
    lines.push(isEn ? `Unweighted GPA: ${sheet.unweightedGpa}` : `未加权 GPA：${sheet.unweightedGpa}`);
  }
  if (sheet.weightedGpa) {
    lines.push(isEn ? `Weighted GPA: ${sheet.weightedGpa}` : `加权 GPA：${sheet.weightedGpa}`);
  }
  const courses = Array.isArray(sheet.courses) ? sheet.courses : [];
  for (const c of courses) {
    if (!c?.courseName?.trim()) continue;
    lines.push(
      isEn
        ? `- G${c.gradeYear || "?"} | ${c.subject || "—"} | ${c.courseName} | ${c.level || "regular"} | grade ${c.grade || "—"}`
        : `- ${c.gradeYear || "?"} 年级 | ${c.subject || "—"} | ${c.courseName} | ${c.level || "regular"} | 成绩 ${c.grade || "—"}`,
    );
  }
  return lines.join("\n");
}
