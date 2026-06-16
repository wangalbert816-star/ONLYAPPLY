/** POST /api/activities/parse — draft activity list from upload or text. */

import OpenAI from "openai";
import { resolveVisionLlmClient, visionLlmConfigHint } from "./llmVisionConfig.mjs";
import { parseJsonFromLlm } from "./parseLlmJson.mjs";
import { extractPdfText, getPdfPageCount, renderPdfPageToPngBase64 } from "./pdfExtract.mjs";

const VALID_KINDS = new Set([
  "activity",
  "competition",
  "research",
  "internship",
  "club",
  "service",
  "arts",
  "sports",
  "other",
]);

const VALID_SCOPES = new Set(["school", "local", "regional", "state", "national", "international"]);

const CA_TYPE_TO_KIND = {
  "extracurricular activity": "activity",
  "academic / competition": "competition",
  competition: "competition",
  research: "research",
  "internship / work": "internship",
  internship: "internship",
  "school club / organization": "club",
  club: "club",
  "community service": "service",
  service: "service",
  "art / performance": "arts",
  arts: "arts",
  athletics: "sports",
  sports: "sports",
  "other club / activity": "other",
};

function newActivityId() {
  return `act-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeKind(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase();
  if (!key) return "";
  if (VALID_KINDS.has(key)) return key;
  return CA_TYPE_TO_KIND[key] ?? "";
}

function normalizeScope(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase();
  if (VALID_SCOPES.has(key)) return key;
  const zhMap = { 校内: "school", 本地: "local", 区域: "regional", 州级: "state", 全国: "national", 国际: "international" };
  return zhMap[key] ?? "";
}

function normalizeMajorRelated(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "yes" || v === "相关" || v === "y") return "yes";
  if (v === "no" || v === "不直接相关" || v === "n") return "no";
  if (v === "unsure" || v === "不确定") return "unsure";
  return "";
}

function emptyActivityItem(partial = {}) {
  return {
    id: newActivityId(),
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
    ...partial,
  };
}

function isRowEmpty(item) {
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

function parseCsvLine(line) {
  const cols = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === "," || ch === "\t") && !inQuotes) {
      cols.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function splitCsvRows(text) {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return lines.map(parseCsvLine).filter((row) => row.some((c) => c.trim()));
}

function headerIndex(headers, ...names) {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = normalized.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function activityFromCsvRow(headers, row) {
  const kindIdx = headerIndex(headers, "activity type", "type", "活动类型");
  const roleIdx = headerIndex(headers, "position / leadership", "position", "role", "职位", "角色");
  const nameIdx = headerIndex(headers, "organization name", "organization", "name", "活动名称", "组织");
  const descIdx = headerIndex(headers, "description", "描述", "说明");
  const gradesIdx = headerIndex(headers, "grade levels", "grades", "年级");
  const hoursIdx = headerIndex(headers, "hours per week", "hours", "每周小时");
  const scopeIdx = headerIndex(headers, "scope (reference)", "scope", "范围");
  const majorIdx = headerIndex(headers, "major related (reference)", "major related", "专业相关");
  const proofIdx = headerIndex(headers, "proof (reference)", "proof", "证明");

  const pick = (idx) => (idx >= 0 && idx < row.length ? row[idx] : "");
  const name = pick(nameIdx).trim();
  const description = pick(descIdx).trim();
  if (!name && !description) return null;

  return emptyActivityItem({
    name,
    kind: normalizeKind(pick(kindIdx)),
    role: pick(roleIdx).trim(),
    description,
    grades: pick(gradesIdx).trim(),
    hours: pick(hoursIdx).trim(),
    scope: normalizeScope(pick(scopeIdx)),
    majorRelated: normalizeMajorRelated(pick(majorIdx)),
    proof: pick(proofIdx).trim(),
  });
}

function parseActivitiesCsv(text) {
  const rows = splitCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const hasKnownHeader =
    headerIndex(headers, "organization name", "organization", "活动名称") >= 0 ||
    headerIndex(headers, "activity type", "活动类型") >= 0;
  if (!hasKnownHeader) return [];

  return rows
    .slice(1)
    .map((row) => activityFromCsvRow(headers, row))
    .filter((item) => item && !isRowEmpty(item))
    .slice(0, 20);
}

const CA_ACTIVITY_ROW_TYPE_RE =
  /^(Extracurricular Activity|Community Service|Academic \/ Competition|Research|Internship \/ Work|School Club \/ Organization|Art \/ Performance|Athletics|Other Club \/ Activity)\b/i;

/** Common App "print/save PDF" vertical blocks (type on its own line, not tabular export). */
const CA_PDF_TYPE_LINE_RE =
  /^(Community Service(?:\s*\(Volunteer\))?|Other Club\/Activity|Foreign Exchange|Internship|Academic|Debate\/Speech|Extracurricular Activity|Research|School Club\/Organization|Art\/Performance|Athletics)$/i;

const GRADES_LINE_RE = /^\d{1,2}(?:\s*,\s*\d{1,2})*$/;
const HOURS_LINE_RE = /^\d+\s*hr\/wk,\s*\d+\s*wk\/yr$/i;
const TIMING_LINE_RE = /^(School|Break|Year|All year)(\s*,\s*(School|Break|Year|All year))*$/i;
const COLLEGE_INTENT_RE = /^(Continue|I intend to participate|Do not wish to continue)/i;

function kindFromCaPdfTypeLine(typeLine) {
  const t = String(typeLine || "").trim();
  if (/^Community Service/i.test(t)) return "service";
  if (/^Internship$/i.test(t)) return "internship";
  if (/^Academic$/i.test(t)) return "competition";
  if (/^Research$/i.test(t)) return "research";
  if (/^Foreign Exchange$/i.test(t)) return "activity";
  if (/^Debate\/Speech$/i.test(t)) return "activity";
  if (/^Other Club\/Activity$/i.test(t)) return "club";
  if (/^School Club/i.test(t)) return "club";
  if (/^Art\/Performance$/i.test(t)) return "arts";
  if (/^Athletics$/i.test(t)) return "sports";
  return normalizeKind(t) || "activity";
}

function scopeFromTimingLine(timingLine, kind, typeLine = "") {
  if (/foreign exchange/i.test(typeLine)) return "international";
  const t = String(timingLine || "").trim().toLowerCase();
  if (kind === "internship" && /school/i.test(t)) return "national";
  if (/foreign|international|exchange/i.test(t)) return "international";
  if (/national/i.test(t)) return "national";
  if (/school/i.test(t)) return "school";
  return "";
}

function splitRoleAndOrganization(line) {
  const raw = String(line || "").trim();
  const idx = raw.indexOf(",");
  if (idx < 0) return { role: "", name: raw };
  return { role: raw.slice(0, idx).trim(), name: raw.slice(idx + 1).trim() };
}

function looksLikeDescriptionStart(line) {
  return /^(Organized|Donated|Led|Wrote|Contacted|Taught|Assisted|Took|Engaged|Discussed|Managed|Participated|Founded|Created|Developed|Completed|Volunteered|Helped|Coordinated)/i.test(
    String(line || "").trim(),
  );
}

function consumeRoleNameAndDescription(blockLines, startIdx) {
  let i = startIdx;
  let role = "";
  let name = "";
  if (blockLines[i]) {
    ({ role, name } = splitRoleAndOrganization(blockLines[i]));
    i += 1;
    while (i < blockLines.length) {
      const line = blockLines[i];
      if (CA_PDF_TYPE_LINE_RE.test(line)) break;
      if (GRADES_LINE_RE.test(line) || HOURS_LINE_RE.test(line) || TIMING_LINE_RE.test(line)) break;
      if (COLLEGE_INTENT_RE.test(line)) break;
      if (looksLikeDescriptionStart(line)) break;
      if (line.length > 90) break;
      name = `${name} ${line}`.replace(/\s+/g, " ").trim();
      i += 1;
    }
  }
  const description = blockLines.slice(i).join(" ").replace(/\s+/g, " ").trim();
  return { role, name, description, nextIdx: i };
}

function extractOutcomeAndAward(description) {
  const text = String(description || "").trim();
  let outcome = "";
  let award = "";
  const awardPatterns = [
    /received an? ([^.]+certificate[^.]*)/i,
    /\b(second place|third place|first place|honorable mention)\b[^.]*/i,
    /earned the title of ([^.]+)/i,
    /earned ([^.]+(?:certificate|cert|praise)[^.]*)/i,
    /achieved ([^.]+)/i,
  ];
  for (const re of awardPatterns) {
    const m = text.match(re);
    if (m) {
      const snippet = (m[1] || m[0]).trim();
      if (/certificate|place|title|cert/i.test(snippet)) award = award ? `${award}; ${snippet}` : snippet;
      else outcome = outcome ? `${outcome}; ${snippet}` : snippet;
    }
  }
  return { outcome, award };
}

function cleanCommonAppPdfLines(text) {
  const cutIdx = text.search(/Responsibilities and circumstances\b/i);
  const clipped = cutIdx >= 0 ? text.slice(0, cutIdx) : text;
  return clipped
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^Activities$/i.test(line)) return false;
      if (/My Common Application/i.test(line)) return false;
      if (/apply\.commonapp\.org/i.test(line)) return false;
      if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(line)) return false;
      if (/^\d+\/\d+$/.test(line)) return false;
      return true;
    });
}

function parseCommonAppPdfBlock(blockLines) {
  if (!blockLines.length) return null;
  const typeLine = blockLines[0];
  if (!CA_PDF_TYPE_LINE_RE.test(typeLine)) return null;

  const kind = kindFromCaPdfTypeLine(typeLine);
  let i = 1;
  let grades = "";
  let hours = "";
  let scope = "";

  if (blockLines[i] && GRADES_LINE_RE.test(blockLines[i])) {
    grades = blockLines[i].replace(/\s+/g, "");
    i += 1;
  }
  if (blockLines[i] && TIMING_LINE_RE.test(blockLines[i])) {
    scope = scopeFromTimingLine(blockLines[i], kind, typeLine);
    i += 1;
  }
  if (blockLines[i] && HOURS_LINE_RE.test(blockLines[i])) {
    hours = blockLines[i];
    i += 1;
  }
  if (blockLines[i] && COLLEGE_INTENT_RE.test(blockLines[i])) {
    i += 1;
  }

  const { role, name, description } = consumeRoleNameAndDescription(blockLines, i);
  if (!name && !description) return null;

  const { outcome, award } = extractOutcomeAndAward(description);
  if (!scope && /worldwide|international|unicef|global/i.test(description)) scope = "international";
  return emptyActivityItem({
    kind,
    name,
    role,
    grades,
    hours,
    scope,
    description,
    outcome,
    award,
  });
}

function looksLikeCommonAppPdfExport(text) {
  return (
    /hr\/wk,\s*\d+\s*wk\/yr/i.test(text) &&
    /(?:Community Service|Other Club\/Activity|Internship|Debate\/Speech|Foreign Exchange)/i.test(text)
  );
}

function parseCommonAppPdfExport(text) {
  if (!looksLikeCommonAppPdfExport(text)) return [];

  const lines = cleanCommonAppPdfLines(text);
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (CA_PDF_TYPE_LINE_RE.test(line)) {
      if (current.length) blocks.push(current);
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  return blocks
    .map(parseCommonAppPdfBlock)
    .filter((item) => item && !isRowEmpty(item) && !isLikelyGarbageActivity(item))
    .slice(0, 20);
}

function isLikelyGarbageActivity(item) {
  const name = String(item?.name || "").trim();
  if (!name) return true;
  if (/^(activities|activity type|organization name|position)/i.test(name)) return true;
  if (/activity type.*organization name/i.test(name)) return true;
  if (/^\(Volunteer\)/i.test(name)) return true;
  if (/hr\/wk/i.test(name)) return true;
  if (name.length > 140 && !String(item.description || "").trim()) return true;
  return false;
}

function filterQualityActivities(activities) {
  return (activities || []).filter((item) => item && !isLikelyGarbageActivity(item));
}

function listHasQualityActivities(result) {
  return filterQualityActivities(result?.activities).some(
    (a) => String(a?.name || "").trim() || String(a?.description || "").trim(),
  );
}

function parseCommonAppActivityLine(line) {
  const raw = String(line || "").trim();
  const typeMatch = raw.match(CA_ACTIVITY_ROW_TYPE_RE);
  if (!typeMatch) return null;

  const kind = normalizeKind(typeMatch[1]);
  let rest = raw.slice(typeMatch[0].length).trim();
  let grades = "";
  let hours = "";

  const tailMatch = rest.match(/(\d{1,2}(?:\s*,\s*\d{1,2})+)(?:\s+(\d{1,2}))?\s*$/);
  if (tailMatch) {
    grades = tailMatch[1].replace(/\s+/g, "");
    hours = tailMatch[2] || "";
    rest = rest.slice(0, tailMatch.index).trim();
  }

  if (rest.includes(",")) {
    const parts = rest.split(",").map((p) => p.trim()).filter(Boolean);
    const [first, second, ...descParts] = parts;
    return emptyActivityItem({
      kind,
      name: first || "",
      role: second || "",
      description: descParts.join(", "),
      grades,
      hours,
    });
  }

  if (!rest) return emptyActivityItem({ kind, grades, hours });

  const tokens = rest.split(/\s{2,}|\t+/).map((p) => p.trim()).filter(Boolean);
  if (tokens.length >= 3) {
    return emptyActivityItem({
      kind,
      name: tokens[0],
      role: tokens[1],
      description: tokens.slice(2).join(" "),
      grades,
      hours,
    });
  }

  return emptyActivityItem({
    kind,
    name: rest.slice(0, 80).trim(),
    description: rest.length > 80 ? rest.slice(80).trim() : "",
    grades,
    hours,
  });
}

function parseCommonAppActivityBlocks(text) {
  const lines = String(text || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const headerIdx = lines.findIndex(
    (line) => /activity type/i.test(line) && /organization name/i.test(line),
  );
  if (headerIdx >= 0) {
    const headerLine = lines[headerIdx];
    const delimiter = headerLine.includes("\t") ? "\t" : headerLine.includes(",") ? "," : null;
    if (delimiter) {
      const headers = headerLine.split(delimiter).map((h) => h.trim());
      const activities = [];
      for (let i = headerIdx + 1; i < lines.length; i += 1) {
        const row = lines[i].split(delimiter).map((c) => c.trim());
        if (row.length < 2) continue;
        const item = activityFromCsvRow(headers, row);
        if (item && !isRowEmpty(item) && !isLikelyGarbageActivity(item)) activities.push(item);
      }
      if (activities.length > 0) return activities.slice(0, 20);
    }
  }

  const blocks = [];
  let current = "";
  for (const line of lines) {
    if (CA_ACTIVITY_ROW_TYPE_RE.test(line)) {
      if (current) blocks.push(current);
      current = line;
    } else if (current) {
      current = `${current} ${line}`;
    }
  }
  if (current) blocks.push(current);

  return blocks
    .map(parseCommonAppActivityLine)
    .filter((item) => item && !isRowEmpty(item) && !isLikelyGarbageActivity(item))
    .slice(0, 20);
}

function finalizeActivitiesParseResult(activities) {
  const cleaned = filterQualityActivities(activities);
  if (cleaned.length === 0) {
    return { activities: [], parseStatus: "failed", parseError: "no_activities_detected" };
  }
  return { activities: cleaned, parseStatus: "ready", parseError: "" };
}

function parseFreeformLine(line) {
  let raw = line.replace(/^[\s\-–—•*·\d.)]+/, "").trim();
  if (raw.length < 3) return null;

  const parts = raw.split(/\s*[|｜]\s*|\t+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const [a, b, ...rest] = parts;
    const maybeGrades = rest.find((p) => /\b(9|10|11|12)\b/.test(p) || /年级/.test(p)) ?? "";
    const maybeHours = rest.find((p) => /hr|hour|小时|h\/w/i.test(p)) ?? "";
    const descParts = rest.filter((p) => p !== maybeGrades && p !== maybeHours);
    return emptyActivityItem({
      name: b.length >= a.length ? b : a,
      role: b.length >= a.length ? a : b,
      grades: maybeGrades,
      hours: maybeHours,
      description: descParts.join(" · "),
    });
  }

  const dashSplit = raw.split(/\s*[–—-]\s+/);
  if (dashSplit.length >= 2) {
    return emptyActivityItem({
      name: dashSplit[0].trim(),
      description: dashSplit.slice(1).join(" — ").trim(),
    });
  }

  const colonIdx = raw.indexOf(":");
  if (colonIdx > 0 && colonIdx < 60) {
    return emptyActivityItem({
      name: raw.slice(0, colonIdx).trim(),
      description: raw.slice(colonIdx + 1).trim(),
    });
  }

  return emptyActivityItem({ name: raw.slice(0, 80), description: raw.length > 80 ? raw.slice(80).trim() : "" });
}

export function heuristicParseActivitiesText(raw) {
  const text = String(raw || "").replace(/\r/g, "\n").trim();
  if (!text) {
    return { activities: [], parseStatus: "failed", parseError: "no_activities_detected" };
  }

  const fromCsv = parseActivitiesCsv(text);
  if (fromCsv.length > 0) {
    return finalizeActivitiesParseResult(fromCsv);
  }

  const fromCaPdf = parseCommonAppPdfExport(text);
  if (fromCaPdf.length > 0) {
    return finalizeActivitiesParseResult(fromCaPdf);
  }

  const fromCommonApp = parseCommonAppActivityBlocks(text);
  if (fromCommonApp.length > 0) {
    return finalizeActivitiesParseResult(fromCommonApp);
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^#/.test(l));

  const activities = lines
    .map(parseFreeformLine)
    .filter((item) => item && !isRowEmpty(item) && !isLikelyGarbageActivity(item))
    .slice(0, 20);

  return finalizeActivitiesParseResult(activities);
}

export function normalizeParsedActivities(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = emptyActivityItem({
        name: String(row.name ?? row.organization ?? "").trim(),
        kind: normalizeKind(String(row.kind ?? row.type ?? "")),
        grades: String(row.grades ?? row.gradeLevels ?? "").trim(),
        hours: String(row.hours ?? row.hoursPerWeek ?? "").trim(),
        role: String(row.role ?? row.position ?? "").trim(),
        description: String(row.description ?? "").trim(),
        outcome: String(row.outcome ?? "").trim(),
        award: String(row.award ?? row.honor ?? "").trim(),
        scope: normalizeScope(String(row.scope ?? "")),
        majorRelated: normalizeMajorRelated(String(row.majorRelated ?? "")),
        proof: String(row.proof ?? "").trim(),
      });
      return isRowEmpty(item) ? null : item;
    })
    .filter(Boolean)
    .slice(0, 20);
}

function listHasUsableActivities(result) {
  return listHasQualityActivities(result);
}

const VISION_PROMPT = `You are reading a student extracurricular / activity list image. Extract ONLY activity rows into JSON.

INCLUDE: named activities, clubs, competitions, research, internships, sports, service — with role, grades, hours, description when visible.

EXCLUDE: student name, ID, birthdate, school header, page numbers, column headers ("Activity type", "Organization name"), instructions.

Schema:
{
  "activities": [{
    "name": string,
    "kind": "activity"|"competition"|"research"|"internship"|"club"|"service"|"arts"|"sports"|"other"|"",
    "grades": string,
    "hours": string,
    "role": string,
    "description": string,
    "outcome": string,
    "award": string,
    "scope": "school"|"local"|"regional"|"state"|"national"|"international"|"",
    "majorRelated": "yes"|"no"|"unsure"|"",
    "proof": string
  }]
}
Return at most 20 activities total across all pages. Use empty strings when unknown. JSON only.`;

const PDF_TEXT_ACTIVITY_THRESHOLD = 5;
const PDF_VISION_PARALLEL = 2;

function pdfVisionPageLimit() {
  const configured = Number(process.env.ACTIVITIES_PDF_MAX_PAGES || process.env.TRANSCRIPT_PDF_MAX_PAGES || 0);
  return configured > 0 ? configured : 10;
}

function mergeActivityLists(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const item of filterQualityActivities(list)) {
      const key = [
        String(item.name || "").trim().toLowerCase(),
        String(item.role || "").trim().toLowerCase(),
        String(item.description || "").trim().toLowerCase().slice(0, 48),
      ].join("|");
      if (!key.replace(/\|/g, "") || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out.slice(0, 20);
}

function limitWarning(numPages) {
  const limit = pdfVisionPageLimit();
  return numPages > limit ? `pdf_page_limit:${limit}` : "";
}

function visionApiErrorCode(err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timed out|timeout|ETIMEDOUT/i.test(msg)) return "vision_timeout";
  if (/does not exist|not have access|404/i.test(msg)) return "endpoint_not_found";
  if (/can only support text|only support text|multimodal|image|vision|unsupported.*content/i.test(msg)) {
    return "vision_model_unsupported";
  }
  return "vision_parse_failed";
}

async function parseWithVisionLlm(imageBase64List, mimeType = "image/png", opts = {}) {
  const cfg = resolveVisionLlmClient();
  if (!cfg) return { result: null, error: "vision_not_configured" };

  const first = await callVisionLlm(cfg, imageBase64List, mimeType, opts);
  if (!first.error || first.error === "no_activities_detected") return first;

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
    console.info("[activities/parse] vision_retry openai/gpt-4o-mini after", first.error);
    return callVisionLlm(fallbackCfg, imageBase64List, mimeType, opts);
  }

  return first;
}

async function callVisionLlm(cfg, imageBase64List, mimeType = "image/png", opts = {}) {
  const { client, model, provider } = cfg;
  const { pageNum, numPages } = opts;

  const images = Array.isArray(imageBase64List) ? imageBase64List : [imageBase64List];
  const totalBytes = images.reduce((n, b64) => n + Math.ceil((b64.length * 3) / 4), 0);
  const pageTag = pageNum && numPages ? ` page=${pageNum}/${numPages}` : "";
  console.info(
    `[activities/parse] vision_start model=${model}${pageTag} images=${images.length} bytes≈${Math.round(totalBytes / 1024)}KB thinking=disabled`,
  );

  const pageHint =
    pageNum && numPages
      ? `\n\nThis image is page ${pageNum} of ${numPages}. Extract activities visible on THIS page only.`
      : "";
  const content = [
    { type: "text", text: VISION_PROMPT + pageHint },
    ...images.map((b64) => ({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${b64}` },
    })),
  ];

  try {
    const request = {
      model,
      messages: [
        { role: "system", content: "You extract extracurricular activities from student lists. Ignore demographics and headers. Output valid JSON only." },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    };
    if (provider === "volcengine-ark") {
      request.thinking = { type: "disabled" };
    }

    const res = await client.chat.completions.create(request);
    const raw = res.choices?.[0]?.message?.content ?? "";
    console.info(`[activities/parse] vision_done model=${model}${pageTag} chars=${raw.length}`);
    const parsed = parseJsonFromLlm(raw);
    const activities = normalizeParsedActivities(parsed.activities);
    const result = finalizeActivitiesParseResult(activities);
    return { result, error: listHasUsableActivities(result) ? "" : "no_activities_detected" };
  } catch (e) {
    const code = e?.code === "invalid_json" ? "vision_parse_failed" : visionApiErrorCode(e);
    console.warn("[activities/parse] vision_failed", e instanceof Error ? e.message : e);
    return {
      result: { activities: [], parseStatus: "failed", parseError: code },
      error: code,
    };
  }
}

function mergeParseResults(primary, fallback) {
  const activities = mergeActivityLists(primary?.activities, fallback?.activities);
  if (activities.length === 0) {
    return primary?.parseStatus === "ready" ? primary : fallback ?? { activities: [], parseStatus: "failed", parseError: "no_activities_detected" };
  }
  return finalizeActivitiesParseResult(activities);
}

async function parsePdfWithVisionPerPage(buffer, cfg, numPages) {
  const limit = Math.min(numPages, pdfVisionPageLimit());
  const activityBatches = [];

  for (let start = 1; start <= limit; start += PDF_VISION_PARALLEL) {
    const batchPages = [];
    for (let p = start; p < start + PDF_VISION_PARALLEL && p <= limit; p += 1) {
      batchPages.push(p);
    }

    const rendered = await Promise.all(
      batchPages.map(async (pageNum) => ({
        pageNum,
        image: await renderPdfPageToPngBase64(buffer, pageNum),
      })),
    );

    const results = await Promise.all(
      rendered.map(({ pageNum, image }) =>
        callVisionLlm(cfg, [image], "image/png", { pageNum, numPages }),
      ),
    );

    for (const { result } of results) {
      if (result?.activities?.length) activityBatches.push(result.activities);
    }
  }

  return finalizeActivitiesParseResult(mergeActivityLists(...activityBatches));
}

async function parsePdfBuffer(buffer) {
  let numPages = 1;
  try {
    numPages = await getPdfPageCount(buffer);
  } catch (e) {
    console.warn("[activities/parse] pdf_page_count_failed", e instanceof Error ? e.message : e);
  }

  let text = "";
  try {
    text = await extractPdfText(buffer);
  } catch (e) {
    console.warn("[activities/parse] pdf_text_extract_failed", e instanceof Error ? e.message : e);
  }

  if (text.length >= 20) {
    const fromText = heuristicParseActivitiesText(text);
    const textActivities = filterQualityActivities(fromText.activities);
    if (numPages === 1 && textActivities.length > 0) {
      return { result: finalizeActivitiesParseResult(textActivities), method: "pdf_text" };
    }
    if (textActivities.length >= PDF_TEXT_ACTIVITY_THRESHOLD) {
      return { result: finalizeActivitiesParseResult(textActivities), method: "pdf_text" };
    }
  }

  const cfg = resolveVisionLlmClient();
  if (!cfg) {
    const partial = text.length >= 20 ? heuristicParseActivitiesText(text) : null;
    if (partial && listHasUsableActivities(partial)) {
      return { result: partial, method: "pdf_text_partial" };
    }
    return {
      result: {
        activities: [],
        parseStatus: "failed",
        parseError: text.length >= 20 ? "no_activities_detected" : "vision_not_configured",
      },
      method: "pdf_vision_unconfigured",
    };
  }

  try {
    const textPartial = text.length >= 20 ? heuristicParseActivitiesText(text) : null;
    const visionResult = await parsePdfWithVisionPerPage(buffer, cfg, numPages);
    const merged = mergeParseResults(visionResult, textPartial);
    if (listHasUsableActivities(merged)) {
      return {
        result: merged,
        method: numPages > 1 ? "pdf_vision_multipage" : "pdf_vision",
        warning: limitWarning(numPages),
      };
    }
    return {
      result: merged ?? { activities: [], parseStatus: "failed", parseError: "no_activities_detected" },
      method: "pdf_vision",
    };
  } catch (e) {
    console.warn("[activities/parse] pdf_vision_failed", e instanceof Error ? e.message : e);
    const partial = text.length >= 20 ? heuristicParseActivitiesText(text) : null;
    if (partial && listHasUsableActivities(partial)) {
      return { result: partial, method: "pdf_text_partial", warning: "vision_parse_failed" };
    }
    return {
      result: { activities: [], parseStatus: "failed", parseError: "vision_parse_failed" },
      method: "pdf_vision",
    };
  }
}

export function registerActivitiesParseRoutes(app, express) {
  app.post("/api/activities/parse", express.json({ limit: "12mb" }), async (req, res) => {
    try {
      const locale = String(req.body?.locale ?? "zh").trim() === "en" ? "en" : "zh";
      const text = String(req.body?.text ?? "").trim();
      if (text) {
        return res.json(heuristicParseActivitiesText(text));
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
        const { result, method, warning } = await parsePdfBuffer(buffer);
        if (listHasUsableActivities(result)) {
          return res.json({ ...result, method, warning: warning || undefined });
        }
        const hint =
          result?.parseError === "vision_not_configured" ? visionLlmConfigHint(locale) : undefined;
        return res.status(422).json({
          error: result?.parseError || "parse_failed",
          hint,
          ...result,
        });
      }

      if (mimeType.startsWith("image/")) {
        const { result, error } = await parseWithVisionLlm([dataBase64], mimeType);
        if (listHasUsableActivities(result)) {
          return res.json({ ...result, method: "image_vision" });
        }
        const errCode = error || result?.parseError || "vision_parse_failed";
        return res.status(422).json({
          error: errCode,
          hint: errCode === "vision_not_configured" ? visionLlmConfigHint(locale) : undefined,
          activities: result?.activities ?? [],
          parseStatus: "failed",
          parseError: errCode,
        });
      }

      return res.status(422).json({
        error: "parse_unsupported_format",
        activities: [],
        parseStatus: "failed",
        parseError: "parse_unsupported_format",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[activities/parse]", msg);
      return res.status(500).json({ error: msg });
    }
  });
}
