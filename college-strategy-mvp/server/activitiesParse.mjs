/** POST /api/activities/parse — draft activity list from upload or text. */

import { resolveVisionLlmClient, visionLlmConfigHint } from "./llmVisionConfig.mjs";
import { extractPdfText, renderPdfPagesToPngBase64 } from "./pdfExtract.mjs";

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

function isLikelyGarbageActivity(item) {
  const name = String(item?.name || "").trim();
  if (!name) return true;
  if (/^(activities|activity type|organization name|position)/i.test(name)) return true;
  if (/activity type.*organization name/i.test(name)) return true;
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

const VISION_PROMPT = `Extract extracurricular activities from a student activity list into JSON only. Schema:
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
Return at most 20 activities. Use empty strings when unknown. JSON only.`;

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
  if (!cfg) return { result: null, error: "vision_not_configured" };
  const { client, model, provider } = cfg;

  const images = Array.isArray(imageBase64List) ? imageBase64List : [imageBase64List];
  const totalBytes = images.reduce((n, b64) => n + Math.ceil((b64.length * 3) / 4), 0);
  console.info(
    `[activities/parse] vision_start model=${model} images=${images.length} bytes≈${Math.round(totalBytes / 1024)}KB thinking=disabled`,
  );

  const content = [
    { type: "text", text: VISION_PROMPT },
    ...images.map((b64) => ({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${b64}` },
    })),
  ];

  try {
    const request = {
      model,
      messages: [
        { role: "system", content: "You extract structured activity list data. Output valid JSON only." },
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
    console.info(`[activities/parse] vision_done model=${model} chars=${raw.length}`);
    const parsed = JSON.parse(raw);
    const activities = normalizeParsedActivities(parsed.activities);
    const result = {
      activities,
      parseStatus: activities.length ? "ready" : "failed",
      parseError: activities.length ? "" : "no_activities_detected",
    };
    return { result, error: listHasUsableActivities(result) ? "" : "no_activities_detected" };
  } catch (e) {
    const code = visionApiErrorCode(e);
    console.warn("[activities/parse] vision_failed", e instanceof Error ? e.message : e);
    return {
      result: { activities: [], parseStatus: "failed", parseError: code },
      error: code,
    };
  }
}

async function parsePdfBuffer(buffer) {
  let text = "";
  try {
    text = await extractPdfText(buffer);
  } catch (e) {
    console.warn("[activities/parse] pdf_text_extract_failed", e instanceof Error ? e.message : e);
  }

  if (text.length >= 20) {
    const fromText = heuristicParseActivitiesText(text);
    if (listHasUsableActivities(fromText)) {
      return { result: fromText, method: "pdf_text" };
    }
  }

  const cfg = resolveVisionLlmClient();
  if (!cfg) {
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
    const pages = await renderPdfPagesToPngBase64(buffer, 2);
    if (!pages.length) {
      return {
        result: { activities: [], parseStatus: "failed", parseError: "pdf_render_failed" },
        method: "pdf_vision",
      };
    }
    const { result, error } = await parseWithVisionLlm(pages, "image/png");
    if (listHasUsableActivities(result)) {
      return { result, method: "pdf_vision" };
    }
    return {
      result: result ?? { activities: [], parseStatus: "failed", parseError: error || "vision_parse_failed" },
      method: "pdf_vision",
    };
  } catch (e) {
    console.warn("[activities/parse] pdf_vision_failed", e instanceof Error ? e.message : e);
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
        const { result, method } = await parsePdfBuffer(buffer);
        if (listHasUsableActivities(result)) {
          return res.json({ ...result, method });
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
