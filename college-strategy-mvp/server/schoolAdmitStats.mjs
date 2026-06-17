/** Load and lookup 2026 official admit stats (68-school table). */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSchoolKey, parseAdmitStatsRow } from "./schoolAdmitStatsParse.mjs";
import { schoolNameLookupVariants } from "./schoolNameResolve.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_FILE = path.join(__dirname, "..", "data", "engine", "school-admit-stats-2026.json");
const CSV_FILE = path.join(__dirname, "..", "data", "engine", "school-admit-stats-2026.csv");

/** Inputs that must never map to a main-campus stats row. */
const INPUT_REJECT_RE =
  /\b(extension|online|continuing|community college|satellite|regional|honors college|summer session)\b/i;

/** School/college subdivisions — stats table is main undergraduate campus only. */
const QUALIFIED_CAMPUS_REJECT_RE =
  /\b(school of|college of|faculty of|department of|stern|marshall|ross|haas|wharton|anderson|sloan|booth|kellogg|dyson|scheller|mccombs|carey|olin|heinz|tepper|foster|ischool)\b/i;

/**
 * Block alias hits when the raw input clearly refers to a different institution.
 * Each rule: if input matches `input`, reject entries whose canonical key matches `blockEntry`.
 */
const CONFLICT_GUARDS = [
  {
    input: /\bpenn\s+state\b|\bpennsylvania\s+state\b|\bpsu\b/i,
    blockEntry: /^(university of )?pennsylvania$|^upenn$|^penn$/,
  },
  {
    input: /\bmichigan\s+state\b|\bmsu\b/i,
    blockEntry: /^university of michigan$|^umich$|^michigan$/,
  },
  {
    input: /\bvirginia\s+tech\b|\bvt\b/i,
    blockEntry: /^university of virginia$|^uva$|^virginia$/,
  },
  {
    input: /\bgeorgia\s+state\b|\bgsu\b/i,
    blockEntry: /^georgia tech$|^georgia institute of technology$|^gatech$|^gt$/,
  },
  {
    input: /\bflorida\s+state\b|\bfsu\b/i,
    blockEntry: /^university of florida$|^florida$/,
  },
  {
    input: /\bwashington\s+state\b|\bwazzu\b|\bwsu\b/i,
    blockEntry: /^university of washington$|^uw$/,
  },
  {
    input: /\bnorth\s+carolina\s+state\b|\bncsu\b/i,
    blockEntry: /^university of north carolina|^unc$/,
  },
  {
    input: /\bwashington\s+university\s+in\s+st\.?\s*louis\b|\bwashu\b|\bwustl\b/i,
    blockEntry: /^university of washington$|^uw$/,
  },
  {
    input: /\buniversity of washington\b(?!.*st\.?\s*louis)/i,
    blockEntry: /^washington university in st louis$|^washu$|^wustl$/,
  },
  {
    input: /\buniversity of wisconsin\b|\buw\s*madison\b|\bwisconsin\s*madison\b/i,
    blockEntry: /^university of washington$|^uw$/,
  },
];

let statsCache = null;
let keyIndex = null;

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function loadFromCsv() {
  if (!fs.existsSync(CSV_FILE)) return [];
  const text = fs.readFileSync(CSV_FILE, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = cols[j] ?? "";
    }
    const parsed = parseAdmitStatsRow(row);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

function readStatsFile() {
  if (statsCache) return statsCache;
  if (fs.existsSync(JSON_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
      statsCache = Array.isArray(raw) ? raw : [];
    } catch {
      statsCache = loadFromCsv();
    }
  } else {
    statsCache = loadFromCsv();
  }
  return statsCache;
}

function lookupKeysForName(name, { forInput = false } = {}) {
  const keys = new Set();
  const raw = String(name || "").trim();
  const direct = normalizeSchoolKey(raw);
  if (direct) keys.add(direct);

  const skipAliasExpand =
    forInput &&
    /\b(extension|online|continuing|community college|satellite|regional|honors college|school of)\b/i.test(raw);
  if (skipAliasExpand) return keys;

  for (const variant of schoolNameLookupVariants(raw)) {
    const key = normalizeSchoolKey(variant);
    if (key) keys.add(key);
  }
  return keys;
}

function entryKeys(entry) {
  return new Set([
    normalizeSchoolKey(entry.school),
    ...(entry.aliases ?? []).map(normalizeSchoolKey),
  ].filter(Boolean));
}

function passesConflictGuard(rawInput, entry, matchedKey) {
  const entryKeySet = entryKeys(entry);
  for (const guard of CONFLICT_GUARDS) {
    if (!guard.input.test(rawInput)) continue;
    for (const ek of entryKeySet) {
      if (guard.blockEntry.test(ek)) return false;
    }
    if (guard.blockEntry.test(matchedKey)) return false;
  }
  return true;
}

function rejectQualifiedInput(raw) {
  if (INPUT_REJECT_RE.test(raw)) return "qualified_campus";
  if (QUALIFIED_CAMPUS_REJECT_RE.test(raw)) return "qualified_college";
  return null;
}

function rebuildIndex() {
  if (keyIndex) return keyIndex;
  keyIndex = new Map();
  for (const entry of readStatsFile()) {
    const names = new Set([entry.school, ...(entry.aliases ?? [])]);
    const keys = new Set();
    for (const name of names) {
      for (const key of lookupKeysForName(name)) keys.add(key);
    }
    for (const k of keys) {
      if (!k) continue;
      if (keyIndex.has(k)) {
        const prev = keyIndex.get(k);
        if (normalizeSchoolKey(prev.school) !== normalizeSchoolKey(entry.school)) {
          console.warn(
            `[schoolAdmitStats] alias key collision "${k}": ${prev.school} vs ${entry.school} — keeping first`,
          );
          continue;
        }
      }
      keyIndex.set(k, entry);
    }
  }
  return keyIndex;
}

export function listAdmitStatsSchools() {
  return readStatsFile();
}

/**
 * Resolve a free-form school label to a stats-table row with explicit confidence.
 * @returns {{ entry: object|null, canonicalName: string|null, confidence: "exact"|"alias"|"none", matchedKey: string|null, reason?: string }}
 */
export function resolveAdmitStatsSchool(name) {
  const raw = String(name ?? "").trim();
  if (!raw) {
    return { entry: null, canonicalName: null, confidence: "none", matchedKey: null, reason: "empty" };
  }

  const rejectReason = rejectQualifiedInput(raw);
  if (rejectReason) {
    return { entry: null, canonicalName: raw, confidence: "none", matchedKey: null, reason: rejectReason };
  }

  const index = rebuildIndex();
  const direct = normalizeSchoolKey(raw);

  if (direct && index.has(direct)) {
    const entry = index.get(direct);
    if (passesConflictGuard(raw, entry, direct)) {
      return { entry, canonicalName: entry.school, confidence: "exact", matchedKey: direct };
    }
  }

  for (const key of lookupKeysForName(raw, { forInput: true })) {
    if (!key || key === direct || !index.has(key)) continue;
    const entry = index.get(key);
    if (!passesConflictGuard(raw, entry, key)) continue;
    return { entry, canonicalName: entry.school, confidence: "alias", matchedKey: key };
  }

  return { entry: null, canonicalName: raw, confidence: "none", matchedKey: null, reason: "not_in_table" };
}

export function findAdmitStatsEntry(name) {
  return resolveAdmitStatsSchool(name).entry;
}

export function isAdmitStatsTableSchool(name) {
  return resolveAdmitStatsSchool(name).confidence !== "none";
}

export function admitStatsKeysForSchool(name) {
  const entry = findAdmitStatsEntry(name);
  if (!entry) return [];
  return [normalizeSchoolKey(entry.school), ...(entry.aliases ?? []).map(normalizeSchoolKey)].filter(Boolean);
}
