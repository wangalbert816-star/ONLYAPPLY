import type { ActivityItem, ActivityKind, ActivityScope } from "../types";

export type ActivitiesParseResult = {
  activities: ActivityItem[];
  parseStatus: "ready" | "failed";
  parseError: string;
};

const VALID_KINDS = new Set<ActivityKind>([
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

const VALID_SCOPES = new Set<ActivityScope>([
  "school",
  "local",
  "regional",
  "state",
  "national",
  "international",
]);

const CA_TYPE_TO_KIND: Record<string, ActivityKind> = {
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

function newActivityId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeKind(raw: string): ActivityItem["kind"] {
  const key = String(raw || "")
    .trim()
    .toLowerCase();
  if (!key) return "";
  if (VALID_KINDS.has(key as ActivityKind)) return key as ActivityKind;
  return CA_TYPE_TO_KIND[key] ?? "";
}

function normalizeScope(raw: string): ActivityScope {
  const key = String(raw || "")
    .trim()
    .toLowerCase();
  if (VALID_SCOPES.has(key as ActivityScope)) return key as ActivityScope;
  const zhMap: Record<string, ActivityScope> = {
    校内: "school",
    本地: "local",
    区域: "regional",
    州级: "state",
    全国: "national",
    国际: "international",
  };
  return zhMap[key] ?? "";
}

function normalizeMajorRelated(raw: string): ActivityItem["majorRelated"] {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "yes" || v === "相关" || v === "y") return "yes";
  if (v === "no" || v === "不直接相关" || v === "n") return "no";
  if (v === "unsure" || v === "不确定") return "unsure";
  return "";
}

function emptyActivityItem(partial: Partial<ActivityItem> = {}): ActivityItem {
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

function isRowEmpty(item: ActivityItem): boolean {
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

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
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

function splitCsvRows(text: string): string[][] {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return lines.map(parseCsvLine).filter((row) => row.some((c) => c.trim()));
}

function headerIndex(headers: string[], ...names: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = normalized.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function activityFromCsvRow(headers: string[], row: string[]): ActivityItem | null {
  const kindIdx = headerIndex(headers, "activity type", "type", "活动类型");
  const roleIdx = headerIndex(headers, "position / leadership", "position", "role", "职位", "角色");
  const nameIdx = headerIndex(headers, "organization name", "organization", "name", "活动名称", "组织");
  const descIdx = headerIndex(headers, "description", "描述", "说明");
  const gradesIdx = headerIndex(headers, "grade levels", "grades", "年级");
  const hoursIdx = headerIndex(headers, "hours per week", "hours", "每周小时");
  const scopeIdx = headerIndex(headers, "scope (reference)", "scope", "范围");
  const majorIdx = headerIndex(headers, "major related (reference)", "major related", "专业相关");
  const proofIdx = headerIndex(headers, "proof (reference)", "proof", "证明");

  const pick = (idx: number) => (idx >= 0 && idx < row.length ? row[idx] : "");
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

function parseActivitiesCsv(text: string): ActivityItem[] {
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
    .filter((item): item is ActivityItem => Boolean(item && !isRowEmpty(item)))
    .slice(0, 20);
}

const CA_ACTIVITY_ROW_TYPE_RE =
  /^(Extracurricular Activity|Community Service|Academic \/ Competition|Research|Internship \/ Work|School Club \/ Organization|Art \/ Performance|Athletics|Other Club \/ Activity)\b/i;

function isLikelyGarbageActivity(item: ActivityItem): boolean {
  const name = item.name.trim();
  if (!name) return true;
  if (/^(activities|activity type|organization name|position)/i.test(name)) return true;
  if (/activity type.*organization name/i.test(name)) return true;
  if (name.length > 140 && !item.description.trim()) return true;
  return false;
}

function filterQualityActivities(activities: ActivityItem[]): ActivityItem[] {
  return activities.filter((item) => !isLikelyGarbageActivity(item));
}

function finalizeActivitiesParseResult(activities: ActivityItem[]): ActivitiesParseResult {
  const cleaned = filterQualityActivities(activities);
  if (cleaned.length === 0) {
    return { activities: [], parseStatus: "failed", parseError: "no_activities_detected" };
  }
  return { activities: cleaned, parseStatus: "ready", parseError: "" };
}

function parseCommonAppActivityLine(line: string): ActivityItem | null {
  const raw = line.trim();
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

function parseCommonAppActivityBlocks(text: string): ActivityItem[] {
  const lines = text
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
      const activities: ActivityItem[] = [];
      for (let i = headerIdx + 1; i < lines.length; i += 1) {
        const row = lines[i].split(delimiter).map((c) => c.trim());
        if (row.length < 2) continue;
        const item = activityFromCsvRow(headers, row);
        if (item && !isRowEmpty(item) && !isLikelyGarbageActivity(item)) activities.push(item);
      }
      if (activities.length > 0) return activities.slice(0, 20);
    }
  }

  const blocks: string[] = [];
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
    .filter((item): item is ActivityItem => Boolean(item && !isRowEmpty(item) && !isLikelyGarbageActivity(item)))
    .slice(0, 20);
}

function parseFreeformLine(line: string): ActivityItem | null {
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

export function parseActivitiesTextHeuristic(raw: string): ActivitiesParseResult {
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
    .filter((item): item is ActivityItem => Boolean(item && !isRowEmpty(item) && !isLikelyGarbageActivity(item)))
    .slice(0, 20);

  return finalizeActivitiesParseResult(activities);
}

export function normalizeParsedActivities(raw: unknown[]): ActivityItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const item = emptyActivityItem({
        name: String(o.name ?? o.organization ?? "").trim(),
        kind: normalizeKind(String(o.kind ?? o.type ?? "")),
        grades: String(o.grades ?? o.gradeLevels ?? "").trim(),
        hours: String(o.hours ?? o.hoursPerWeek ?? "").trim(),
        role: String(o.role ?? o.position ?? "").trim(),
        description: String(o.description ?? "").trim(),
        outcome: String(o.outcome ?? "").trim(),
        award: String(o.award ?? o.honor ?? "").trim(),
        scope: normalizeScope(String(o.scope ?? "")),
        majorRelated: normalizeMajorRelated(String(o.majorRelated ?? "")),
        proof: String(o.proof ?? "").trim(),
      });
      return isRowEmpty(item) ? null : item;
    })
    .filter((item): item is ActivityItem => Boolean(item))
    .slice(0, 20);
}
