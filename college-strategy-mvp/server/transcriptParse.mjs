/** POST /api/transcript/parse — draft grade sheet from upload or text. */

import { resolveVisionLlmClient, visionLlmConfigHint } from "./llmVisionConfig.mjs";
import { extractPdfText, renderPdfPagesToPngBase64 } from "./pdfExtract.mjs";

const PARSE_SCHEMA = {
  gradingScale: "",
  unweightedGpa: "",
  weightedGpa: "",
  scaleNotes: "",
  courses: [],
};

function parseGpaFromText(text) {
  const t = String(text || "").trim();
  const uw = t.match(/(?:unweighted|UW|未加权|非加权)[^\d]*(\d(?:\.\d{1,2})?)/i);
  const w = t.match(/(?:weighted|W|加权)[^\d]*(\d(?:\.\d{1,2})?)/i);
  const all = [...t.matchAll(/\b(\d\.\d{1,2})\b/g)].map((m) => m[1]);
  return {
    unweighted: uw?.[1] ?? all[0] ?? "",
    weighted: w?.[1] ?? (all.length > 1 ? all[1] : all[0] ?? ""),
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

export function heuristicParseTranscriptText(raw) {
  const text = String(raw || "").replace(/\r/g, "\n").trim();
  const gpas = parseGpaFromText(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const courses = [];

  for (const line of lines) {
    if (line.length < 4) continue;
    if (/gpa|绩点|weighted|unweighted|class rank/i.test(line) && !/\b[A-F][+-]?\b/.test(line)) continue;
    const gradeMatch = line.match(/([A-F][+-]?|\d{1,3})\s*$/) || line.match(/\b([1-7])\s*$/);
    if (!gradeMatch) continue;
    const grade = gradeMatch[1];
    let coursePart = line.slice(0, gradeMatch.index).replace(/[|\t,;]+/g, " ").trim();
    coursePart = coursePart.replace(/^(grade\s*)?(9|10|11|12)\s*/i, "").trim();
    if (coursePart.length < 2) continue;
    courses.push({
      id: newCourseId(),
      gradeYear: inferGradeYear(line),
      subject: inferSubject(coursePart),
      courseName: coursePart,
      level: inferCourseLevel(coursePart),
      grade,
      confidence: "medium",
      source: "ocr",
    });
  }

  return {
    gradingScale: gpas.unweighted ? "4.0_uw" : "",
    unweightedGpa: gpas.unweighted,
    weightedGpa: gpas.weighted,
    scaleNotes: "",
    courses: courses.slice(0, 40),
    parseStatus: courses.length || gpas.unweighted ? "ready" : "failed",
    parseError: courses.length || gpas.unweighted ? "" : "no_courses_detected",
  };
}

function sheetHasUsableCourses(sheet) {
  if (!sheet) return false;
  const hasGpa = Boolean(sheet.unweightedGpa?.trim() || sheet.weightedGpa?.trim());
  const hasCourse = Array.isArray(sheet.courses) && sheet.courses.some((c) => c.courseName?.trim());
  return hasGpa || hasCourse;
}

const VISION_PROMPT = `Extract high school transcript courses into JSON only. Schema:
{
  "gradingScale": "4.0_uw"|"4.0_w"|"100"|"ib"|"a_level"|"other"|"",
  "unweightedGpa": string,
  "weightedGpa": string,
  "scaleNotes": string,
  "courses": [{ "gradeYear": "9"|"10"|"11"|"12"|"other", "subject": string, "courseName": string, "level": "regular"|"honors"|"ap"|"ib_hl"|"ib_sl"|"a_level"|"dual_enrollment"|"other", "grade": string }]
}
Return at most 40 courses. Use empty strings when unknown. JSON only.`;

function visionApiErrorCode(err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timed out|timeout|ETIMEDOUT/i.test(msg)) return "vision_timeout";
  if (/does not exist|not have access|404/i.test(msg)) return "endpoint_not_found";
  if (/can only support text|only support text|multimodal|image|vision|unsupported.*content/i.test(msg)) {
    return "vision_model_unsupported";
  }
  return "vision_parse_failed";
}

async function parseWithVisionLlm(imageBase64List, mimeType = "image/png") {
  const cfg = resolveVisionLlmClient();
  if (!cfg) return { sheet: null, error: "vision_not_configured" };
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
        { role: "system", content: "You extract structured transcript data. Output valid JSON only." },
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
    const parsed = JSON.parse(raw);
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
  const sheet = {
    gradingScale: parsed.gradingScale || "",
    unweightedGpa: String(parsed.unweightedGpa || "").trim(),
    weightedGpa: String(parsed.weightedGpa || "").trim(),
    scaleNotes: String(parsed.scaleNotes || "").trim(),
    courses: courses.filter((c) => c.courseName),
    parseStatus: courses.length ? "ready" : "failed",
    parseError: courses.length ? "" : "no_courses_detected",
  };
  return { sheet, error: sheetHasUsableCourses(sheet) ? "" : "no_courses_detected" };
  } catch (e) {
    const code = visionApiErrorCode(e);
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

  if (text.length >= 20) {
    const fromText = heuristicParseTranscriptText(text);
    if (sheetHasUsableCourses(fromText)) {
      return { sheet: fromText, method: "pdf_text" };
    }
  }

  const cfg = resolveVisionLlmClient();
  if (!cfg) {
    return {
      sheet: {
        ...PARSE_SCHEMA,
        parseStatus: "failed",
        parseError: text.length >= 20 ? "no_courses_detected" : "vision_not_configured",
      },
      method: "pdf_vision_unconfigured",
    };
  }

  try {
    const pages = await renderPdfPagesToPngBase64(buffer, 2);
    if (pages.length === 0) {
      return {
        sheet: { ...PARSE_SCHEMA, parseStatus: "failed", parseError: "pdf_render_failed" },
        method: "pdf_vision",
      };
    }
    const { sheet, error } = await parseWithVisionLlm(pages, "image/png");
    if (sheet && sheetHasUsableCourses(sheet)) {
      return { sheet, method: "pdf_vision" };
    }
    return {
      sheet: sheet ?? { ...PARSE_SCHEMA, parseStatus: "failed", parseError: error || "no_courses_detected" },
      method: "pdf_vision",
    };
  } catch (e) {
    console.warn("[transcript/parse] pdf_vision_failed", e instanceof Error ? e.message : e);
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
        const { sheet, method } = await parsePdfBuffer(buffer);
        if (sheetHasUsableCourses(sheet)) {
          return res.json({ sheet, method });
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
