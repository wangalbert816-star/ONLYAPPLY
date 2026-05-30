/**
 * Data-quality regression: school name resolution, grad-faculty sanitization, link matching.
 * Run: node scripts/test-data-quality.mjs
 */
import {
  CANONICAL_SCHOOL_NAME_FIXTURES,
  matchesCuratedLinkLibrary,
  schoolNameLookupVariants,
} from "../server/schoolNameResolve.mjs";
import {
  containsUndergradFacultyErrors,
  sanitizeUndergradSchoolMentions,
} from "../server/undergradCopySanitize.mjs";
import {
  filterUcTestBlindBullets,
  isUcTestBlindSatGapBullet,
  sanitizeUcTestBlindCopy,
} from "../server/ucTestBlindCopySanitize.mjs";
import { ucCampusKeyFromSchool, ucCampusSelectivity } from "../server/ucCampusSelectivity.mjs";
import { sanitizeUcAnalysisFromBody } from "../server/ucAnalysisSanitize.mjs";
import {
  sanitizeCrossTierDifferentiation,
  sanitizeReportTierDifferentiation,
} from "../server/tierDifferentiationSanitize.mjs";
import {
  allowsTopReferenceSchools,
  autoRepairTopReferenceSchools,
  buildValidationRepairMessage,
  isUltraSelectiveSchoolName,
  normalizeTopReferenceSchoolRows,
  validateMainSchoolReport,
} from "../server/topReferenceSchools.mjs";

const results = [];

function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: e?.message ?? String(e) });
  }
}

check("UCLA full legal name resolves to curated links", () => {
  const id = matchesCuratedLinkLibrary("University of California, Los Angeles");
  if (id !== "ucla") throw new Error(`expected ucla, got ${id}`);
});

check("all canonical school name fixtures resolve", () => {
  for (const fx of CANONICAL_SCHOOL_NAME_FIXTURES) {
    const variants = schoolNameLookupVariants(fx.input);
    if (!variants.some((v) => fx.mustMatch.test(v))) {
      throw new Error(`${fx.input} → ${variants.join(" | ")}`);
    }
  }
});

const GRAD_SANITIZE_CASES = [
  {
    school: "University of California, Los Angeles",
    input: "强商学院 (Anderson) 对国际生友好",
    mustNot: /Anderson/i,
  },
  {
    school: "University of California, Berkeley",
    input: "核实 Haas School of Business 本科路径",
    mustNot: /Haas School/i,
  },
  {
    school: "University of Pennsylvania",
    input: "Wharton is the default undergraduate business path",
    mustNot: /Wharton\s+is\s+the\s+default/i,
  },
  {
    school: "Massachusetts Institute of Technology",
    input: "Verify Sloan admissions requirements",
    mustNot: /verify\s+Sloan/i,
  },
  {
    school: "Stanford University",
    input: "GSB pipeline for undergraduates",
    mustNot: /\bGSB\b\s+pipeline/i,
  },
  {
    school: "New York University",
    input: "Stern School is the main path",
    mustNot: /Stern School/i,
  },
];

for (const [i, c] of GRAD_SANITIZE_CASES.entries()) {
  check(`grad-faculty sanitize case ${i + 1} (${c.school})`, () => {
    const out = sanitizeUndergradSchoolMentions(c.input, c.school, "en");
    if (c.mustNot.test(out)) throw new Error(`still contains forbidden term: ${out}`);
    if (containsUndergradFacultyErrors(out)) throw new Error(`containsUndergradFacultyErrors: ${out}`);
  });
}

check("sanitize strips Anderson from verification_focus-style line", () => {
  const out = sanitizeUndergradSchoolMentions("核实 Anderson 本科奖助", "UCLA", "zh");
  if (/Anderson/.test(out)) throw new Error(out);
});

const UC_SAT_GAP_CASES = [
  "标化 optional（无 SAT/ACT 可能会被视为信息缺口）",
  "无 SAT/ACT 可能会被视为信息缺口",
  "未提交 SAT/ACT，招生官可能视为信息缺口",
];

for (const [i, raw] of UC_SAT_GAP_CASES.entries()) {
  check(`UC test-blind strips SAT gap bullet ${i + 1}`, () => {
    if (!isUcTestBlindSatGapBullet(raw)) throw new Error("expected gap bullet detection");
    const out = sanitizeUcTestBlindCopy(raw, "zh");
    if (out) throw new Error(`expected empty, got: ${out}`);
  });
}

check("UC test-blind keeps GPA risk but drops SAT gap segment", () => {
  const raw = "GPA 与课程强度偏弱；标化 optional（无 SAT/ACT 可能会被视为信息缺口）";
  const out = sanitizeUcTestBlindCopy(raw, "zh");
  if (/SAT|信息缺口|标化\s*optional/i.test(out)) throw new Error(out);
  if (!/GPA/i.test(out)) throw new Error(`GPA segment removed: ${out}`);
});

check("UC legal campus names resolve for selectivity", () => {
  if (ucCampusKeyFromSchool("University of California, Davis") !== "ucdavis") {
    throw new Error("Davis legal name not recognized");
  }
  if (ucCampusKeyFromSchool("University of California, Berkeley") !== "berkeley") {
    throw new Error("Berkeley legal name not recognized");
  }
  if (ucCampusSelectivity("University of California, Davis") <= ucCampusSelectivity("University of California, Berkeley")) {
    throw new Error("Davis should be less selective than Berkeley");
  }
});

check("UC tier sanitize fixes Davis reach + Berkeley match inversion", () => {
  const body = {
    gpa: "GPA 3.6 unweighted",
    structuredActivities: [],
    satScore: "",
    riskStyle: "balanced",
  };
  const raw = {
    overview: "test",
    reach: [
      {
        school: "University of California, Davis",
        why_reach_for_you: "test",
        differentiation: "相较于UCB，UCD的竞争度更低。",
      },
    ],
    match: [
      {
        school: "University of California, Berkeley",
        why_match_for_you: "test",
        differentiation: "相较于其他 UC reach，Berkeley 资源突出。",
      },
    ],
    safety: [],
  };
  const out = sanitizeUcAnalysisFromBody(raw, body, "zh");
  const reachKeys = (out.reach || []).map((r) => ucCampusKeyFromSchool(r.school));
  const matchKeys = (out.match || []).map((r) => ucCampusKeyFromSchool(r.school));
  if (reachKeys.includes("ucdavis") && matchKeys.includes("berkeley")) {
    throw new Error(`still inverted: reach=${reachKeys.join(",")} match=${matchKeys.join(",")}`);
  }
  const berkeleyRow = (out.match || []).find((r) => ucCampusKeyFromSchool(r.school) === "berkeley");
  if (berkeleyRow && /UC\s*reach|UC\s*冲刺/i.test(String(berkeleyRow.differentiation || ""))) {
    throw new Error(`Berkeley match row still says UC reach: ${berkeleyRow.differentiation}`);
  }
});

check("filterUcTestBlindBullets removes SAT-only risks", () => {
  const out = filterUcTestBlindBullets(
    ["活动证据偏薄", "无 SAT/ACT 可能会被视为信息缺口", "专业竞争极强"],
    "zh",
  );
  if (out.length !== 2) throw new Error(`expected 2 items, got ${out.length}: ${JSON.stringify(out)}`);
  if (out.some((x) => /SAT|信息缺口/i.test(x))) throw new Error(out.join(" | "));
});

check("McCombs sanitize is idempotent (no nested duplication)", () => {
  const raw = "GPA 符合 McCombs School of Business 要求";
  const once = sanitizeUndergradSchoolMentions(raw, "University of Texas at Austin", "zh");
  const twice = sanitizeUndergradSchoolMentions(once, "University of Texas at Austin", "zh");
  if (/McCombs.*McCombs|本科极难.*本科极难.*本科极难/i.test(twice)) {
    throw new Error(`nested duplication: ${twice}`);
  }
  if (once !== twice) throw new Error(`not idempotent: ${once} -> ${twice}`);
});

check("tier sanitize tolerates string key_fit_signals", () => {
  const report = {
    reach: [{ school: "UNC", key_fit_signals: "GPA 3.6 符合" }],
    match: [],
    safety: [],
  };
  const out = sanitizeReportTierDifferentiation(report, "zh");
  if (!Array.isArray(out.reach[0].key_fit_signals) || out.reach[0].key_fit_signals.length !== 1) {
    throw new Error(JSON.stringify(out.reach[0].key_fit_signals));
  }
});

check("cross-tier differentiation fixes UNC reach vs UT Austin match", () => {
  const report = {
    reach: [{ school: "University of North Carolina at Chapel Hill", differentiation: "与同档的 UT Austin 相比，UNC 社区更紧密。" }],
    match: [{ school: "University of Texas at Austin", differentiation: "与同档其它校相比学费更低。" }],
    safety: [],
  };
  const out = sanitizeReportTierDifferentiation(report, "zh");
  const uncDiff = out.reach[0].differentiation;
  if (/与同档.*UT Austin/i.test(uncDiff)) throw new Error(`still same-tier wording: ${uncDiff}`);
  if (!/匹配档.*UT Austin/i.test(uncDiff)) throw new Error(`expected match tier ref: ${uncDiff}`);
});

function baseNineSchoolReport(overrides = {}) {
  return {
    reach: [
      { school: "University of North Carolina at Chapel Hill" },
      { school: "University of Virginia" },
      { school: "University of Michigan" },
    ],
    match: [
      { school: "University of Texas at Austin" },
      { school: "University of Wisconsin-Madison" },
      { school: "Purdue University" },
    ],
    safety: [
      { school: "Pennsylvania State University" },
      { school: "Ohio State University" },
      { school: "University of Minnesota" },
    ],
    ...overrides,
  };
}

const strongBody = {
  gpa: "UW 3.85 / W 4.2",
  structuredActivities: [
    {
      name: "Robotics team",
      description: "Led school robotics team for three years and built competition robots with documented outcomes.",
      role: "Captain",
      outcome: "Regional finalist",
      award: "National math olympiad training camp",
    },
    {
      name: "ML research project",
      description: "ISEF finalist project on machine learning with reproducible experiments and mentor verification.",
      role: "Lead researcher",
      outcome: "ISEF finalist",
    },
  ],
};

const weakBody = {
  gpa: "UW 3.1",
  structuredActivities: [],
};

check("plan B: ultra in reach fails validation (repairable)", () => {
  const report = baseNineSchoolReport({
    reach: [
      { school: "Stanford University" },
      { school: "University of Virginia" },
      { school: "University of Michigan" },
    ],
  });
  const v = validateMainSchoolReport(report, strongBody);
  if (v.ok) throw new Error("expected failure");
  if (!v.repairable) throw new Error("expected repairable");
  if (!/Stanford/i.test(v.reason)) throw new Error(v.reason);
});

check("plan B: valid main nine + top_reference for strong profile", () => {
  const report = baseNineSchoolReport({
    top_reference_schools: [{ school: "Stanford University", why_reference_for_you: "ISEF 背景可解释" }],
  });
  const v = validateMainSchoolReport(report, strongBody);
  if (!v.ok) throw new Error(v.reason);
});

check("plan B: weak profile auto-strips top_reference_schools", () => {
  const report = baseNineSchoolReport({
    top_reference_schools: [{ school: "MIT" }],
    strategy_notes: "原有说明",
  });
  autoRepairTopReferenceSchools(report, weakBody, "zh");
  const v = validateMainSchoolReport(report, weakBody);
  if (!v.ok) throw new Error(v.reason);
  if ((report.top_reference_schools?.length ?? 0) !== 0) throw new Error("expected empty top_reference");
  if (!/顶级彩票校/.test(String(report.strategy_notes))) throw new Error("expected strategy note");
});

check("plan B: weak profile rejects top_reference_schools before repair", () => {
  const report = baseNineSchoolReport({
    top_reference_schools: [{ school: "MIT" }],
  });
  const v = validateMainSchoolReport(report, weakBody);
  if (v.ok) throw new Error("expected weak profile rejection");
  if (!/不宜/.test(v.reason)) throw new Error(v.reason);
});

check("plan B: duplicate across main and top_reference fails", () => {
  const report = baseNineSchoolReport({
    top_reference_schools: [{ school: "University of North Carolina at Chapel Hill" }],
  });
  const v = validateMainSchoolReport(report, strongBody);
  if (v.ok) throw new Error("expected overlap failure");
});

check("plan B: normalizeTopReferenceSchoolRows coerces string bullets", () => {
  const rows = normalizeTopReferenceSchoolRows(
    [{ school: "Harvard University", key_fit_signals: "national award", why_reach_for_you: "legacy field" }],
    "zh",
  );
  if (rows.length !== 1) throw new Error("expected 1 row");
  if (!Array.isArray(rows[0].key_fit_signals)) throw new Error("expected array");
  if (rows[0].why_reference_for_you !== "legacy field") throw new Error(rows[0].why_reference_for_you);
});

check("plan B: repair message mentions top_reference_schools", () => {
  const msg = buildValidationRepairMessage("test", "zh");
  if (!/top_reference_schools/.test(msg)) throw new Error(msg);
});

check("plan B: isUltraSelectiveSchoolName recognizes MIT", () => {
  if (!isUltraSelectiveSchoolName("Massachusetts Institute of Technology")) throw new Error("MIT not ultra");
  if (isUltraSelectiveSchoolName("Purdue University")) throw new Error("Purdue should not be ultra");
  if (isUltraSelectiveSchoolName("Pennsylvania State University")) throw new Error("Penn State should not be ultra");
});

check("plan B: allowsTopReferenceSchools strong vs weak", () => {
  if (!allowsTopReferenceSchools(strongBody)) throw new Error("strong should allow");
  if (allowsTopReferenceSchools(weakBody)) throw new Error("weak should deny");
});

let failed = 0;
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed += 1;
  console.log(`${mark}  ${r.name}${r.err ? `: ${r.err}` : ""}`);
}

process.exit(failed ? 1 : 0);
