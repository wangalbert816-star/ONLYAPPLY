/** Chances explorer — GPA + testing academic score vs admit-stats selectivity (no LLM). */

import { scoreFiveDimensions } from "./fiveDimensionScore.mjs";
import { buildStudentStatsProfile } from "./statsTierGap.mjs";
import { computeSchoolStatsGap } from "./statsTierGap.mjs";
import { resolveMajorBucket } from "./majorBucket.mjs";
import { listAdmitStatsSchools, resolveAdmitStatsSchool } from "./schoolAdmitStats.mjs";
import { normalizeSchoolKey } from "./schoolAdmitStatsParse.mjs";

const MAX_SCHOOLS = 8;
const SEARCH_MIN = 2;

export function normalizeChancesBody(raw) {
  const b = raw && typeof raw === "object" ? raw : {};
  const gpaRaw = String(b.gpa ?? b.uwGpa ?? "").trim();
  const gpa = gpaRaw.includes(".") ? gpaRaw : gpaRaw ? `${gpaRaw} UW` : "";
  const testMode = String(b.testMode ?? b.testing ?? "sat").trim().toLowerCase();
  const satScore = String(b.satScore ?? "").trim();
  const actScore = String(b.actScore ?? "").trim();
  const hasScore = Boolean(satScore || actScore);

  let testing = "test_optional";
  if (hasScore) testing = "will_submit";

  const identityRaw = String(b.applicantIdentity ?? "domestic").trim().toLowerCase();
  const applicantIdentity = identityRaw === "international" ? "intl" : identityRaw || "domestic";

  return {
    gpa: gpa || gpaRaw,
    testing,
    satScore: testMode === "act" ? "" : satScore,
    actScore: testMode === "act" ? actScore : "",
    applicantIdentity,
    majorPrimary: String(b.majorPrimary ?? "").trim(),
  };
}

/** Parse a clean numeric GPA (e.g. "3.95", "3.95 UW", "4/4.0") to a number. */
function parsePlainGpa(raw) {
  const m = String(raw ?? "").trim().match(/\d(?:\.\d{1,3})?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 && n <= 5.5 ? n : null;
}

/** Map a GPA value to the same 34–94 academic band used for verified transcripts. */
function academicScoreFromGpaValue(gpaNum) {
  const ratio = Math.min(1, Math.max(0, (gpaNum - 2.4) / (4.0 - 2.4)));
  return Math.round(Math.min(94, Math.max(34, 34 + ratio * 60)));
}

/** Option A: GPA + testing only (0–100). */
export function computeChancesAcademicScore(body) {
  const normalized = normalizeChancesBody(body);
  const scores = scoreFiveDimensions(normalized);
  // Chances collects a clean numeric GPA, so score academics by GPA value.
  // The free-text path scores how richly the GPA is *described* (rank/AP/UW keywords),
  // which badly understates a bare number like "3.95" — and disagrees with the
  // tier engine, which already reads the numeric GPA.
  const gpaNum = parsePlainGpa(body?.gpa ?? body?.uwGpa ?? normalized.gpa);
  const academic = gpaNum != null ? academicScoreFromGpaValue(gpaNum) : scores.academic;
  const blend = academic * 0.55 + scores.testing * 0.45;
  return Math.round(blend * 10) / 10;
}

export function engineGapToFitScore(engineGap) {
  const n = 50 - Number(engineGap ?? 0) * 2.5;
  return Math.round(Math.min(95, Math.max(5, n)) * 10) / 10;
}

const ABBREV_OVERRIDES = {
  "harvard university": "HU",
  "stanford university": "SU",
  "university of florida": "UF",
  "carnegie mellon university": "CMU",
  "massachusetts institute of technology": "MIT",
  "georgia institute of technology": "GT",
  "university of california berkeley": "UCB",
  "university of california los angeles": "UCLA",
  "new york university": "NYU",
  "university of pennsylvania": "UPenn",
  "university of michigan": "UMich",
  "ohio state university": "OSU",
  "penn state university": "PSU",
};

export function abbreviateSchool(name) {
  const key = normalizeSchoolKey(name);
  if (ABBREV_OVERRIDES[key]) return ABBREV_OVERRIDES[key];
  const words = key.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  const skip = new Set(["university", "of", "the", "college", "at"]);
  const sig = words.filter((w) => !skip.has(w));
  if (sig.length >= 2) return sig.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (sig[0] ?? words[0] ?? "?").slice(0, 3).toUpperCase();
}

export function searchAdmitStatsSchools(query, limit = 10) {
  const q = normalizeSchoolKey(query);
  if (!q || q.length < SEARCH_MIN) return [];

  const hits = [];
  for (const entry of listAdmitStatsSchools()) {
    const key = normalizeSchoolKey(entry.school);
    const aliasHit = (entry.aliases ?? []).some((a) => normalizeSchoolKey(a).includes(q));
    if (!key.includes(q) && !aliasHit && !key.startsWith(q)) continue;
    const rank = key === q ? 0 : key.startsWith(q) ? 1 : 2;
    hits.push({ school: entry.school, selectivity: entry.selectivity ?? null, rank });
  }

  hits.sort((a, b) => a.rank - b.rank || a.school.localeCompare(b.school));
  return hits.slice(0, limit).map(({ school, selectivity }) => ({ school, selectivity }));
}

export function evaluateChances(body, schoolNames = []) {
  const normalized = normalizeChancesBody(body);
  const academicScore = computeChancesAcademicScore(body);
  const student = buildStudentStatsProfile(normalized);
  const majorBucket = resolveMajorBucket(normalized);

  const unique = [];
  const seen = new Set();
  for (const name of schoolNames) {
    const label = String(name ?? "").trim();
    if (!label) continue;
    const key = normalizeSchoolKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(label);
    if (unique.length >= MAX_SCHOOLS) break;
  }

  const schools = unique.map((name) => {
    const resolved = resolveAdmitStatsSchool(name);
    if (!resolved.entry) {
      return {
        school: name,
        inTable: false,
        reason: resolved.reason ?? "not_in_table",
      };
    }

    const entry = resolved.entry;
    const gap = computeSchoolStatsGap(student, entry, majorBucket);
    const tier = gap.effectiveTier ?? gap.suggestedTier ?? "match";

    return {
      school: entry.school,
      abbreviation: abbreviateSchool(entry.school),
      inTable: true,
      selectivity: Number(entry.selectivity ?? 70),
      fitScore: engineGapToFitScore(gap.engineGap),
      tier,
      engineGap: gap.engineGap,
      flags: gap.flags ?? [],
      campusSize: entry.campusSize ?? null,
      community: entry.community ?? null,
      acceptanceRate: entry.acceptanceRate ?? null,
    };
  });

  return {
    academicScore,
    student: {
      uwGpa: student.uwGpa,
      sat: student.sat,
      act: student.act,
      testOptionalNoScore: student.testOptionalNoScore,
      intl: student.intl,
    },
    schools,
  };
}

export function registerChancesRoutes(app, express) {
  app.get("/api/chances/schools", (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    if (q.length < SEARCH_MIN) {
      return res.json({ schools: [] });
    }
    return res.json({ schools: searchAdmitStatsSchools(q, limit) });
  });

  app.post("/api/chances/evaluate", express.json({ limit: "32kb" }), (req, res) => {
    try {
      const body = req.body ?? {};
      const schoolNames = Array.isArray(body.schools) ? body.schools : [];
      const result = evaluateChances(body, schoolNames);
      return res.json(result);
    } catch (e) {
      console.error("[api/chances/evaluate]", e instanceof Error ? e.message : e);
      return res.status(500).json({ error: "chances_evaluate_failed" });
    }
  });
}
