/** Parse JSON from LLM output (markdown fences, trailing prose, truncation, minor syntax issues). */

function normalizeSmartQuotes(text) {
  return String(text ?? "")
    .replace(/[\u201c\u201d\uff02]/g, '"')
    .replace(/[\u2018\u2019\uff07]/g, "'");
}

function fixTrailingCommas(text) {
  return text.replace(/,\s*([}\]])/g, "$1");
}

function stripMarkdownFence(text) {
  let s = String(text ?? "").trim();
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/im);
  if (fenced) return fenced[1].trim();
  if (s.startsWith("```")) {
    return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return s;
}

function extractOutermostJsonObject(raw) {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = start; i < raw.length; i += 1) {
    const c = raw[i];
    if (inString) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return raw.slice(start);
}

function salvageTruncatedJsonObject(raw) {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let text = raw.slice(start).trimEnd();
  text = text.replace(/,\s*"[^"]*$/s, "").replace(/,\s*$/s, "");
  const stack = [];
  for (const ch of text) {
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if ((ch === "}" || ch === "]") && stack.length) stack.pop();
  }
  while (stack.length) text += stack.pop();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function repairAndParse(raw) {
  const candidates = new Set();
  const base = stripMarkdownFence(raw);
  candidates.add(base);
  candidates.add(normalizeSmartQuotes(base));
  candidates.add(fixTrailingCommas(base));
  candidates.add(fixTrailingCommas(normalizeSmartQuotes(base)));

  const balanced = extractOutermostJsonObject(base);
  if (balanced) {
    candidates.add(balanced);
    candidates.add(fixTrailingCommas(balanced));
    candidates.add(fixTrailingCommas(normalizeSmartQuotes(balanced)));
  }

  const start = base.indexOf("{");
  const end = base.lastIndexOf("}");
  if (start >= 0 && end > start) {
    candidates.add(base.slice(start, end + 1));
    candidates.add(fixTrailingCommas(base.slice(start, end + 1)));
  }

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed != null) return parsed;
  }
  return null;
}

/** Pull individual course objects from malformed vision JSON. */
export function salvageCourseObjectsFromLlm(raw) {
  const text = String(raw ?? "");
  if (!/"courseName"/i.test(text)) return null;

  const courses = [];
  const blocks = text.match(/\{[^{}]*"courseName"[\s\S]*?\}/gi) ?? [];
  for (const block of blocks) {
    const courseName = block.match(/"courseName"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1];
    const grade = block.match(/"grade"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1];
    if (!courseName?.trim() || !grade?.trim()) continue;
    courses.push({
      gradeYear: block.match(/"gradeYear"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] || "11",
      subject: block.match(/"subject"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] || "",
      courseName: courseName.replace(/\\"/g, '"').trim(),
      level: block.match(/"level"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] || "regular",
      grade: grade.replace(/\\"/g, '"').trim(),
    });
  }

  if (!courses.length) return null;

  const root = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const gradingScale = root.match(/"gradingScale"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] ?? "";
  const unweightedGpa = root.match(/"unweightedGpa"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] ?? "";
  const weightedGpa = root.match(/"weightedGpa"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] ?? "";
  const scaleNotes = root.match(/"scaleNotes"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1] ?? "";

  return {
    gradingScale,
    unweightedGpa,
    weightedGpa,
    scaleNotes,
    courses,
  };
}

export function parseJsonFromLlm(raw) {
  const s = String(raw ?? "").trim();
  if (!s) {
    const err = new Error("empty_llm_response");
    err.code = "invalid_json";
    throw err;
  }

  const repaired = repairAndParse(s);
  if (repaired != null) return repaired;

  const salvaged = salvageTruncatedJsonObject(s);
  if (salvaged) return salvaged;

  const err = new Error(`invalid_json (${s.length} chars)`);
  err.code = "invalid_json";
  throw err;
}
