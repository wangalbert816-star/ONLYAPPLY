/** Parse raw CSV cells into normalized admit-stats fields. */

const EXTRA_ALIASES = {
  "carnegie mellon university": ["cmu", "carnegie mellon"],
  "massachusetts institute of technology": ["mit"],
  "university of southern california": ["usc"],
  "university of california berkeley": ["uc berkeley", "berkeley"],
  "university of california los angeles": ["ucla"],
  "university of california san diego": ["uc san diego", "ucsd"],
  "university of california santa barbara": ["uc santa barbara", "ucsb"],
  "university of california irvine": ["uc irvine", "uci"],
  "university of california davis": ["uc davis", "ucd"],
  "university of california santa cruz": ["uc santa cruz", "ucsc"],
  "university of california riverside": ["uc riverside", "ucr"],
  "university of california merced": ["uc merced", "ucm"],
  "university of illinois urbana champaign": ["uiuc", "illinois urbana"],
  "georgia institute of technology": ["georgia tech", "gatech", "gt"],
  "university of michigan": ["umich", "michigan"],
  "university of notre dame": ["notre dame"],
  "university of virginia": ["uva", "virginia"],
  "university of pennsylvania": ["upenn", "penn"],
  "johns hopkins university": ["jhu", "john hopkins"],
  "university of texas at austin": ["ut austin"],
  "university of washington": ["uw seattle"],
  "university of wisconsin madison": ["uw madison", "wisconsin madison"],
  "university of north carolina at chapel hill": ["unc chapel hill", "unc"],
  "washington university in st louis": ["washu", "wustl"],
  "california institute of technology": ["caltech"],
  "new york university": ["nyu"],
  "boston university": ["bu"],
  "cal poly san luis obispo": ["cal poly slo", "cal poly slo"],
  "san jose state university": ["san jose state", "sjsu"],
};

export function normalizeSchoolKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function midpoint(lo, hi) {
  return (Number(lo) + Number(hi)) / 2;
}

function parseRangePair(text, re) {
  const m = String(text || "").match(re);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return { lo, hi, mid: midpoint(lo, hi) };
}

export function parseAcceptanceRate(raw) {
  const t = String(raw ?? "").replace(/%/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

export function parseSatCell(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { mode: "missing" };
  if (/test-blind/i.test(s)) return { mode: "test_blind" };

  const eng = parseRangePair(s, /(\d{3,4})\s*-\s*(\d{3,4})\s*[\(（]?\s*English/i);
  const math = parseRangePair(s, /(\d{3,4})\s*-\s*(\d{3,4})\s*[\(（]?\s*Math/i);
  if (eng && math) {
    const mid = Math.round(eng.mid + math.mid);
    return {
      mode: "composite_from_sections",
      composite25: mid - 40,
      composite75: mid + 40,
      compositeMid: mid,
    };
  }

  const range = parseRangePair(s, /^(\d{3,4})\s*-\s*(\d{3,4})/);
  if (range) {
    return {
      mode: "range",
      composite25: range.lo,
      composite75: range.hi,
      compositeMid: Math.round(range.mid),
    };
  }

  const avg = s.match(/(\d{3,4})\s*\(\s*(AVG|MEAN)\s*\)/i);
  if (avg) {
    const mid = Number(avg[1]);
    return {
      mode: "avg",
      composite25: mid - 40,
      composite75: mid + 40,
      compositeMid: mid,
    };
  }

  return { mode: "unparsed", raw: s };
}

export function parseActCell(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { mode: "missing" };
  if (/test-blind/i.test(s)) return { mode: "test_blind" };

  const range = parseRangePair(s, /^(\d{1,2})\s*-\s*(\d{1,2})/);
  if (range) {
    return { act25: range.lo, act75: range.hi, actMid: range.mid };
  }

  const avg = s.match(/(\d{1,2})\s*\(\s*(AVG|MEAN)\s*\)/i);
  if (avg) {
    const mid = Number(avg[1]);
    return { act25: mid - 1, act75: mid + 1, actMid: mid };
  }

  const single = s.match(/^(\d{1,2})$/);
  if (single) {
    const mid = Number(single[1]);
    return { act25: mid - 1, act75: mid + 1, actMid: mid };
  }

  return { mode: "unparsed", raw: s };
}

function parseGpaBand(text, label) {
  const re = new RegExp(
    `(\\d\\.\\d{1,2})\\s*-\\s*(\\d\\.\\d{1,2})\\s*\\(\\s*${label}\\s*\\)`,
    "i",
  );
  const range = parseRangePair(text, re);
  if (range) return { lo: range.lo, hi: range.hi, mid: range.mid };

  const single = text.match(new RegExp(`(\\d\\.\\d{1,2})\\s*[\\(（]\\s*${label}\\s*[\\)）]`, "i"));
  if (single) {
    const mid = Number(single[1]);
    return { lo: mid, hi: mid, mid };
  }

  const plainRange = parseRangePair(text, /^(\d\.\d{1,2})\s*-\s*(\d\.\d{1,2})$/);
  if (plainRange && label === "UW") {
    return { lo: plainRange.lo, hi: plainRange.hi, mid: plainRange.mid };
  }

  const plainSingle = text.match(/^(\d\.\d{1,2})$/);
  if (plainSingle) {
    const mid = Number(plainSingle[1]);
    return { lo: mid, hi: mid, mid };
  }

  return null;
}

export function parseGpaCell(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { published: false };

  const uw =
    parseGpaBand(s, "UW") ||
    (/\(UW\)|（UW）/i.test(s) ? parseGpaBand(s.replace(/[（）]/g, (c) => (c === "（" ? "(" : ")")), "UW") : null);
  const w = parseGpaBand(s, "W");

  if (!uw && !w) {
    const avg = s.match(/(\d\.\d{1,2})\s*\(\s*AVG\s*\)/i);
    if (avg) {
      const mid = Number(avg[1]);
      return { published: true, gpaWMid: mid, gpaWMidOnly: true };
    }
    const unlabeled = parseGpaBand(s, "UW");
    if (unlabeled) {
      return { published: true, gpaUwMid: unlabeled.mid, unlabeled: true };
    }
    return { published: false, raw: s };
  }

  return {
    published: true,
    gpaUwMid: uw?.mid ?? null,
    gpaUw25: uw?.lo ?? null,
    gpaUw75: uw?.hi ?? null,
    gpaWMid: w?.mid ?? null,
    gpaW25: w?.lo ?? null,
    gpaW75: w?.hi ?? null,
  };
}

export function parseTestPolicyCell(raw, schoolName = "") {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  const lower = s.toLowerCase();
  if (!s) return { policy: "unknown" };
  if (/test-bilnd|test-blind/i.test(lower)) return { policy: "test_blind" };
  if (/computer science.*required/i.test(lower)) {
    return { policy: "optional", policyCs: "required", policyDefault: "optional" };
  }
  if (lower === "required") return { policy: "required" };
  if (lower === "optional") return { policy: "optional" };
  return { policy: "unknown", raw: s };
}

export function selectivityFromAcceptanceRate(rate) {
  if (rate == null || !Number.isFinite(rate)) return 70;
  return Math.min(99, Math.max(5, Math.round((1 - rate) * 100 + 4)));
}

export function buildAliasesForSchool(name) {
  const key = normalizeSchoolKey(name);
  const aliases = new Set();
  if (key.startsWith("uc ")) {
    aliases.add(key);
    aliases.add(key.replace(/^uc /, "university of california "));
  }
  for (const [canonical, extras] of Object.entries(EXTRA_ALIASES)) {
    if (key === canonical || extras.some((a) => normalizeSchoolKey(a) === key)) {
      aliases.add(canonical);
      for (const a of extras) aliases.add(normalizeSchoolKey(a));
    }
  }
  return [...aliases].filter(Boolean);
}

export function parseAdmitStatsRow(row) {
  const name = String(row.Name ?? row.name ?? "").trim();
  if (!name) return null;

  const sat = parseSatCell(row.SAT);
  const act = parseActCell(row["ACT(25%-75%)"] ?? row.ACT);
  const gpa = parseGpaCell(row.GPA);
  const acceptanceRate = parseAcceptanceRate(row["Acceptance Rate"] ?? row.acceptanceRate);
  const testMeta = parseTestPolicyCell(row["Test Policy"] ?? row.testPolicy, name);

  let testPolicy = testMeta.policy;
  if (sat.mode === "test_blind" || act.mode === "test_blind") {
    testPolicy = "test_blind";
  }

  const entry = {
    school: name,
    aliases: buildAliasesForSchool(name),
    dataYear: 2026,
    source: "official_website",
    statPopulation: "admitted",
    acceptanceRate,
    selectivity: selectivityFromAcceptanceRate(acceptanceRate),
    testPolicy,
    testPolicyCs: testMeta.policyCs ?? null,
    testPolicyDefault: testMeta.policyDefault ?? testPolicy,
    gpaPublished: gpa.published,
    gpaUwMid: gpa.gpaUwMid ?? null,
    gpaUw25: gpa.gpaUw25 ?? null,
    gpaUw75: gpa.gpaUw75 ?? null,
    gpaWMid: gpa.gpaWMid ?? null,
    gpaW25: gpa.gpaW25 ?? null,
    gpaW75: gpa.gpaW75 ?? null,
    satComposite25: sat.composite25 ?? null,
    satComposite75: sat.composite75 ?? null,
    satCompositeMid: sat.compositeMid ?? null,
    act25: act.act25 ?? null,
    act75: act.act75 ?? null,
    actMid: act.actMid ?? null,
    satMode: sat.mode ?? null,
    actMode: act.mode ?? null,
  };

  return entry;
}
