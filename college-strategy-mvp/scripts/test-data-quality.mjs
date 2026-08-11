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
  schoolMatchesForbidden,
  validateMainSchoolReport,
} from "../server/topReferenceSchools.mjs";
import { parseSatCell, parseTestPolicyCell, parseAdmitStatsCsv, parseAdmitStatsRow } from "../server/schoolAdmitStatsParse.mjs";
import { findAdmitStatsEntry, listAdmitStatsSchools, resolveAdmitStatsSchool } from "../server/schoolAdmitStats.mjs";
import { canonicalizeReportSchoolNames } from "../server/statsSchoolNameCanonicalize.mjs";
import {
  buildStudentStatsProfile,
  computeSchoolStatsGap,
  effectiveTestPolicy,
  applyTestOptionalTierAdjustment,
} from "../server/statsTierGap.mjs";
import { sanitizeStatsTierReport } from "../server/statsTierSanitize.mjs";
import { parseMajorGuidance, majorGuidanceRankAdjust } from "../server/majorGuidance.mjs";
import { parseGeoPrefs, schoolRegionMatchesPrefs } from "../server/engineIntakeProfile.mjs";
import { isSchoolEligible, buildEngineContext, listSchoolMajorCatalog } from "../server/engineTierRules.mjs";
import { schoolReachBand, reachBandDistance } from "../server/reachTierBand.mjs";
import { runDecisionEngineV2 } from "../server/decisionEngineV2.mjs";
import { scoreFiveDimensions } from "../server/fiveDimensionScore.mjs";
import {
  campusProfilePrefBoost,
  schoolMatchesCommunityPref,
} from "../server/campusProfile.mjs";
import {
  computeChancesAcademicScore,
  evaluateChances,
  normalizeChancesBody,
  searchAdmitStatsSchools,
  engineGapToFitScore,
} from "../server/chances.mjs";
import {
  createReportDeadlineMs,
  resolveLlmTimeoutMs,
  resolveReportWallMs,
  resolveVercelLlmWallMs,
} from "../server/llmBudget.mjs";

const results = [];

function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: e?.message ?? String(e) });
  }
}

check("local report budget default preserves per-call LLM timeout", () => {
  const env = { LLM_TIMEOUT_MS: "290000" };
  const vercelWall = resolveVercelLlmWallMs(env);
  const llmTimeout = resolveLlmTimeoutMs(env, vercelWall);
  const reportWall = resolveReportWallMs(env, { vercelLlmWallMs: vercelWall });
  const deadline = createReportDeadlineMs(1_000, reportWall);

  if (vercelWall !== 0) throw new Error(`expected no Vercel wall clock, got ${vercelWall}`);
  if (llmTimeout !== 290_000) throw new Error(`expected configured timeout, got ${llmTimeout}`);
  if (reportWall !== 0) throw new Error(`expected shared report budget disabled, got ${reportWall}`);
  if (deadline !== undefined) throw new Error(`expected no shared deadline, got ${deadline}`);
});

check("Vercel report budget stays inside function ceiling", () => {
  const env = { VERCEL: "1", VERCEL_FUNCTION_MAX_SEC: "300", LLM_TIMEOUT_MS: "400000" };
  const vercelWall = resolveVercelLlmWallMs(env);
  const llmTimeout = resolveLlmTimeoutMs(env, vercelWall);
  const reportWall = resolveReportWallMs(env, { vercelLlmWallMs: vercelWall });
  const deadline = createReportDeadlineMs(1_000, reportWall);

  if (vercelWall !== 285_000) throw new Error(`expected 285000ms Vercel wall clock, got ${vercelWall}`);
  if (llmTimeout !== 285_000) throw new Error(`expected timeout capped to Vercel wall, got ${llmTimeout}`);
  if (reportWall !== 285_000) throw new Error(`expected shared Vercel budget, got ${reportWall}`);
  if (deadline !== 286_000) throw new Error(`expected deadline 286000, got ${deadline}`);
});

check("REPORT_WALL_MS override enables explicit local shared budget", () => {
  const env = { LLM_TIMEOUT_MS: "290000", REPORT_WALL_MS: "600000" };
  const vercelWall = resolveVercelLlmWallMs(env);
  const reportWall = resolveReportWallMs(env, { vercelLlmWallMs: vercelWall });
  const deadline = createReportDeadlineMs(1_000, reportWall);

  if (reportWall !== 600_000) throw new Error(`expected override budget, got ${reportWall}`);
  if (deadline !== 601_000) throw new Error(`expected override deadline, got ${deadline}`);
});

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

check("plan B: ultra in reach passes validation for strong profile", () => {
  const report = baseNineSchoolReport({
    reach: [
      { school: "Stanford University" },
      { school: "University of Virginia" },
      { school: "University of Michigan" },
    ],
  });
  const v = validateMainSchoolReport(report, strongBody);
  if (!v.ok) throw new Error(v.reason);
});

check("plan B: Penn State in match is not treated as UPenn ultra", () => {
  const report = baseNineSchoolReport({
    match: [
      { school: "University of Texas at Austin" },
      { school: "Penn State University" },
      { school: "Purdue University" },
    ],
  });
  const v = validateMainSchoolReport(report, strongBody);
  if (!v.ok) throw new Error(v.reason);
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

check("plan B: auto-repair strips RISD/UCLA from top_reference_schools", () => {
  const report = baseNineSchoolReport({
    top_reference_schools: [
      { school: "Rhode Island School of Design", why_reference_for_you: "艺术方向" },
      { school: "University of California, Los Angeles", why_reference_for_you: "UC 误填" },
      { school: "Stanford University", why_reference_for_you: "合法顶校" },
    ],
  });
  autoRepairTopReferenceSchools(report, strongBody, "zh");
  const v = validateMainSchoolReport(report, strongBody);
  if (!v.ok) throw new Error(v.reason);
  if (report.top_reference_schools?.length !== 1) throw new Error("expected 1 ultra row");
  if (!/Stanford/i.test(String(report.top_reference_schools?.[0]?.school))) throw new Error("expected Stanford kept");
  if (!/RISD|Rhode Island|UCLA|Los Angeles/.test(String(report.strategy_notes))) throw new Error("expected removal note");
});

check("plan B: auto-repair strips duplicate top_reference overlapping main list", () => {
  const report = baseNineSchoolReport({
    top_reference_schools: [
      { school: "University of North Carolina at Chapel Hill", why_reference_for_you: "重复" },
      { school: "Harvard University", why_reference_for_you: "合法" },
    ],
  });
  autoRepairTopReferenceSchools(report, strongBody, "zh");
  const v = validateMainSchoolReport(report, strongBody);
  if (!v.ok) throw new Error(v.reason);
  if (report.top_reference_schools?.length !== 1) throw new Error("expected 1 row");
  if (!/Harvard/i.test(String(report.top_reference_schools?.[0]?.school))) throw new Error("expected Harvard kept");
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
  if (isUltraSelectiveSchoolName("Penn State University")) throw new Error("Penn State University should not be ultra");
  if (!isUltraSelectiveSchoolName("University of Pennsylvania")) throw new Error("UPenn should be ultra");
});

check("plan B: forbidden Penn does not block Penn State", () => {
  if (schoolMatchesForbidden("Penn State University", ["Penn"])) throw new Error("Penn State should not match forbidden Penn");
  if (!schoolMatchesForbidden("University of Pennsylvania", ["Penn"])) throw new Error("UPenn should match forbidden Penn");
});

check("plan B: allowsTopReferenceSchools strong vs weak", () => {
  if (!allowsTopReferenceSchools(strongBody)) throw new Error("strong should allow");
  if (allowsTopReferenceSchools(weakBody)) throw new Error("weak should deny");
});

check("admit stats: section SAT composite midpoint", () => {
  const sat = parseSatCell("690-750 (English) 720-780 (Math)");
  if (sat.compositeMid !== 1470) throw new Error(`expected 1470, got ${sat.compositeMid}`);
});

check("admit stats: Test-Bilnd typo normalizes", () => {
  const tp = parseTestPolicyCell("Test-Bilnd");
  if (tp.policy !== "test_blind") throw new Error(tp.policy);
});

check("admit stats: table loads 118 schools", () => {
  const rows = listAdmitStatsSchools();
  if (rows.length !== 118) throw new Error(`expected 118 schools, got ${rows.length}`);
});

check("admit stats: CMU CS required policy", () => {
  const cmu = findAdmitStatsEntry("Carnegie Mellon University");
  if (!cmu) throw new Error("CMU not found");
  const student = buildStudentStatsProfile({ majorPrimary: "Computer Science", testing: "will_submit", satScore: "1500" });
  if (effectiveTestPolicy(cmu, student) !== "required") throw new Error("CMU CS should be required");
});

check("admit stats: CMU CS adds strict SAT gap", () => {
  const cmu = findAdmitStatsEntry("Carnegie Mellon University");
  const student = buildStudentStatsProfile({
    majorPrimary: "Computer Science",
    testing: "will_submit",
    satScore: "1500",
  });
  const gap = computeSchoolStatsGap(student, cmu);
  if (!gap.flags.includes("cmu_cs_strict")) throw new Error(JSON.stringify(gap.flags));
});

check("admit stats: UC test-blind skips SAT compare", () => {
  const ucla = findAdmitStatsEntry("University of California, Los Angeles");
  if (!ucla) throw new Error("UCLA not found");
  const student = buildStudentStatsProfile({ testing: "will_submit", satScore: "1200" });
  const gap = computeSchoolStatsGap(student, ucla);
  if (gap.testPolicy !== "test_blind") throw new Error(gap.testPolicy);
  if (gap.testingCompared) throw new Error("should not compare testing for test-blind");
});

check("admit stats: no published GPA skips gpa gap", () => {
  const entry = findAdmitStatsEntry("Cornell University");
  if (!entry) throw new Error("Cornell not found");
  if (entry.gpaPublished) throw new Error("Cornell should have no published GPA in table");
  const student = buildStudentStatsProfile({ gpa: "3.2 UW" });
  const gap = computeSchoolStatsGap(student, entry);
  if (gap.gpaGap != null) throw new Error(`expected null gpaGap, got ${gap.gpaGap}`);
});

check("admit stats sanitize: strips SAT from UC row", () => {
  const parsed = sanitizeStatsTierReport(
    {
      reach: [
        {
          school: "University of California, Los Angeles",
          why_reach_for_you: "Your SAT 1200 is below typical admits.",
          key_risks: ["SAT may hurt"],
        },
      ],
      match: [],
      safety: [],
    },
    { testing: "will_submit", satScore: "1200" },
    "en",
  );
  const why = parsed.reach[0].why_reach_for_you;
  if (/SAT/i.test(why)) throw new Error(`SAT not stripped: ${why}`);
});

const namePairs = [
  ["CMU", "Carnegie Mellon University"],
  ["GT", "Georgia Tech"],
  ["UW", "University of Washington"],
  ["UPenn", "University of Pennsylvania"],
  ["UMich", "University of Michigan"],
  ["UVA", "University of Virginia"],
  ["SJSU", "San José State University"],
  ["San Jose State University", "San José State University"],
  ["University of California, Los Angeles", "UCLA"],
];

for (const [input, expected] of namePairs) {
  check(`admit stats name: ${input}`, () => {
    const hit = findAdmitStatsEntry(input);
    if (!hit || hit.school !== expected) throw new Error(`got ${hit?.school ?? "null"}, want ${expected}`);
  });
}

check("admit stats name: GT not WashU", () => {
  const hit = findAdmitStatsEntry("GT");
  if (!hit || hit.school !== "Georgia Tech") throw new Error(hit?.school ?? "null");
});
check("admit stats name: Penn State in table", () => {
  const hit = findAdmitStatsEntry("Penn State University");
  if (!hit || hit.school !== "Penn State University") throw new Error(hit?.school ?? "null");
});
check("admit stats name: UC Davis Extension not UC Davis", () => {
  const hit = findAdmitStatsEntry("UC Davis Extension");
  if (hit?.school === "UC Davis") throw new Error("extension should not map to main campus stats");
});
check("admit stats name: UW is Seattle not Madison", () => {
  const hit = findAdmitStatsEntry("UW");
  if (!hit || hit.school !== "University of Washington") throw new Error(hit?.school ?? "null");
});

check("admit stats resolve: rejects NYU Stern", () => {
  const r = resolveAdmitStatsSchool("NYU Stern");
  if (r.confidence !== "none" || r.reason !== "qualified_college") {
    throw new Error(JSON.stringify(r));
  }
});

check("admit stats resolve: rejects USC Marshall", () => {
  const r = resolveAdmitStatsSchool("USC Marshall School of Business");
  if (r.confidence !== "none") throw new Error(JSON.stringify(r));
});

check("admit stats resolve: Penn State not UPenn", () => {
  const r = resolveAdmitStatsSchool("Penn State University");
  if (!r.entry || r.entry.school !== "Penn State University") throw new Error(JSON.stringify(r));
  const upenn = resolveAdmitStatsSchool("University of Pennsylvania");
  if (r.entry.school === upenn.entry?.school) throw new Error("confused with UPenn");
});

check("admit stats resolve: Michigan State not UMich", () => {
  const r = resolveAdmitStatsSchool("Michigan State University");
  if (!r.entry || r.entry.school !== "Michigan State University") throw new Error(JSON.stringify(r));
});

check("admit stats canonicalize: UCLA from legal name", () => {
  const parsed = canonicalizeReportSchoolNames({
    reach: [{ school: "University of California, Los Angeles", why_reach_for_you: "x" }],
    match: [],
    safety: [],
  });
  if (parsed.reach[0].school !== "UCLA") throw new Error(parsed.reach[0].school);
});

check("admit stats canonicalize: leaves off-table names unchanged", () => {
  const parsed = canonicalizeReportSchoolNames({
    reach: [{ school: "Penn State University" }],
    match: [],
    safety: [],
  });
  if (parsed.reach[0].school !== "Penn State University") throw new Error(parsed.reach[0].school);
});

const intlBizBody = {
  satScore: "1440",
  gpa: "3.64 UW",
  testing: "will_submit",
  applicantIdentity: "intl",
  majorPrimary: "Business",
};

check("safety band: Purdue capped to match for intl 1440", () => {
  const student = buildStudentStatsProfile(intlBizBody);
  const entry = findAdmitStatsEntry("Purdue University");
  const gap = computeSchoolStatsGap(student, entry);
  if (gap.effectiveTier !== "match") throw new Error(`effectiveTier=${gap.effectiveTier}`);
  if (!gap.flags.includes("cap_prestige_stats_safety")) throw new Error(JSON.stringify(gap.flags));
});

check("safety band: SJSU promoted to stable safety", () => {
  const student = buildStudentStatsProfile(intlBizBody);
  const entry = findAdmitStatsEntry("San José State University");
  const gap = computeSchoolStatsGap(student, entry, "business");
  if (gap.effectiveTier !== "safety") throw new Error(`effectiveTier=${gap.effectiveTier}`);
  if (gap.safetyBand !== "stable") throw new Error(`safetyBand=${gap.safetyBand}`);
});

check("major guidance: business selective bumps tier for business student", () => {
  const student = buildStudentStatsProfile({ ...intlBizBody, majorPrimary: "Business" });
  const entry = findAdmitStatsEntry("University of Pennsylvania");
  const gap = computeSchoolStatsGap(student, entry, "business");
  if (!gap.flags.includes("major_selective")) throw new Error(JSON.stringify(gap.flags));
});

check("major guidance: cs selective ignored for business student", () => {
  const student = buildStudentStatsProfile({ ...intlBizBody, majorPrimary: "Business" });
  const entry = findAdmitStatsEntry("UC Berkeley");
  const gap = computeSchoolStatsGap(student, entry, "business");
  if (!gap.flags.includes("major_selective")) throw new Error(JSON.stringify(gap.flags));
  if (gap.flags.some((f) => f.includes("cs"))) throw new Error("should not apply cs-only flags");
});

check("major guidance: UW intl cs slightly conservative", () => {
  const student = buildStudentStatsProfile({
    majorPrimary: "Computer Science",
    testing: "will_submit",
    satScore: "1400",
    applicantIdentity: "intl",
  });
  const entry = findAdmitStatsEntry("University of Washington");
  const gap = computeSchoolStatsGap(student, entry, "cs");
  if (!gap.flags.includes("major_selective")) throw new Error(JSON.stringify(gap.flags));
  if (!gap.flags.includes("major_intl_limited")) throw new Error(JSON.stringify(gap.flags));
});

check("major guidance: indirect deprioritized in rank adjust", () => {
  const entry = findAdmitStatsEntry("MIT");
  const directBoost = majorGuidanceRankAdjust(findAdmitStatsEntry("Babson College"), "business");
  const indirectPenalty = majorGuidanceRankAdjust(entry, "business");
  if (directBoost <= 0) throw new Error(`directBoost=${directBoost}`);
  if (indirectPenalty >= 0) throw new Error(`indirectPenalty=${indirectPenalty}`);
});

check("admit stats: region and major guidance loaded", () => {
  const entry = findAdmitStatsEntry("University of Michigan");
  if (!entry) throw new Error("UMich not found");
  if (entry.region !== "great_lakes") throw new Error(`region=${entry.region}`);
  if (!entry.majorGuidance?.includes("business")) throw new Error(entry.majorGuidance);
  const parsed = parseMajorGuidance(entry.majorGuidance);
  if (!parsed.segments.business?.selective) throw new Error(JSON.stringify(parsed));
});

check("geo: Great Lakes matches Midwest preference", () => {
  const geo = parseGeoPrefs({ geoPrefs: ["midwest"] });
  if (!schoolRegionMatchesPrefs("Great Lakes", geo)) throw new Error("Great Lakes should match midwest");
});

check("admit stats name: San José accent resolves", () => {
  const hit = findAdmitStatsEntry("San Jose State University");
  if (!hit) throw new Error("San Jose State not resolved");
});

check("admit stats: CSV multiline CMU test policy parses", () => {
  const csv = `Name,SAT,ACT(25%-75%),GPA,Acceptance Rate,Test Policy,Major Guidance,Region
Carnegie Mellon University,770-800(Math) 730-770(English),34-35,3.89(UW),12%,"School of Computer Science:Required 
 Else:Optional","cs: selective",Midwest`;
  const row = parseAdmitStatsCsv(csv)[0];
  const entry = parseAdmitStatsRow(row);
  if (entry.testPolicyCs !== "required") throw new Error(JSON.stringify(entry));
});

check("major guidance: selective clears stale safety band", () => {
  const student = buildStudentStatsProfile({
    majorPrimary: "Business",
    testing: "will_submit",
    satScore: "1540",
    gpa: "3.95 UW",
    applicantIdentity: "domestic",
  });
  const entry = findAdmitStatsEntry("University of Pennsylvania");
  const gap = computeSchoolStatsGap(student, entry, "business");
  if (gap.effectiveTier === "safety") throw new Error(`tier=${gap.effectiveTier}`);
  if (gap.safetyBand != null) throw new Error(`stale safetyBand=${gap.safetyBand}`);
});

check("geo strict: stats table region used for eligibility", () => {
  const body = { geoPrefs: ["west"], majorPrimary: "Business" };
  const context = buildEngineContext(body, [], {
    composite: 70,
    academic: 70,
    testing: 70,
    activities: 70,
    rigor: 70,
    strategy: 70,
  });
  const sjsu = listSchoolMajorCatalog().find((e) => /san jose state/i.test(e.school));
  if (!sjsu) throw new Error("SJSU not in catalog");
  if (!isSchoolEligible(sjsu, context)) throw new Error("SJSU should pass west geo via stats region");
  const babson = listSchoolMajorCatalog().find((e) => /babson/i.test(e.school));
  if (babson && isSchoolEligible(babson, context)) throw new Error("Babson should fail west geo strict");
});

const refIntlBizBody = {
  gpa: "3.7 UW",
  gpaTrend: "upward",
  testing: "test_optional",
  applicantIdentity: "intl",
  citizenship: "China",
  residenceRegion: "United States",
  budget: "full_pay",
  geoPrefs: ["any"],
  majorPrimary: "Business",
};

check("major guidance: Kelley selective does not bump to reach at 78% admit", () => {
  const student = buildStudentStatsProfile({ ...refIntlBizBody, majorPrimary: "Business" });
  const entry = findAdmitStatsEntry("Indiana University Bloomington");
  const gap = computeSchoolStatsGap(student, entry, "business");
  if (!gap.flags.includes("major_selective")) throw new Error(JSON.stringify(gap.flags));
  if (!gap.flags.includes("major_selective_match")) throw new Error(JSON.stringify(gap.flags));
  if (gap.effectiveTier === "reach") throw new Error(`tier=${gap.effectiveTier}`);
});

check("reach band: Indiana D vs CMU A are incompatible bands", () => {
  const indiana = findAdmitStatsEntry("Indiana University Bloomington");
  const cmu = findAdmitStatsEntry("Carnegie Mellon University");
  const b1 = schoolReachBand(indiana);
  const b2 = schoolReachBand(cmu);
  if (b1 !== "D" || b2 !== "A") throw new Error(`${b1} vs ${b2}`);
  if (reachBandDistance(b1, b2) <= 1) throw new Error("should be far apart");
});

check("test optional intl: Babson private 16% not default match", () => {
  const student = buildStudentStatsProfile(refIntlBizBody);
  const entry = findAdmitStatsEntry("Babson College");
  const babsonCatalog = listSchoolMajorCatalog().find((e) => /babson/i.test(e.school));
  const gap = computeSchoolStatsGap(student, entry, "business");
  const adj = applyTestOptionalTierAdjustment("match", babsonCatalog, entry, gap, student);
  if (adj.tier !== "reach") throw new Error(`tier=${adj.tier}`);
  if (!adj.statsGap.flags.includes("test_optional_private_strict")) throw new Error(JSON.stringify(adj.statsGap.flags));
});

check("engine: intl business test-optional reach band coherent", () => {
  const r = runDecisionEngineV2(refIntlBizBody, [], { allowRelaxedGeo: true });
  if (!r.ok) throw new Error(r.reason);
  const reach = r.schools.reach.map((s) => s.school);
  if (reach.some((s) => /indiana/i.test(s))) throw new Error(`Kelley should be match not reach: ${reach.join(",")}`);
  const bands = reach.map((name) => schoolReachBand(findAdmitStatsEntry(name)));
  const anchor = bands[0];
  for (const b of bands.slice(1)) {
    if (reachBandDistance(b, anchor) > 1) throw new Error(`incoherent reach bands: ${bands.join(",")} schools=${reach.join(",")}`);
  }
});

check("engine: safety prefers stats-table schools over Virginia Tech", () => {
  const r = runDecisionEngineV2(refIntlBizBody, [], { allowRelaxedGeo: true });
  if (!r.ok) throw new Error(r.reason);
  const safety = r.schools.safety.map((s) => s.school);
  if (safety.some((s) => /virginia tech/i.test(s))) throw new Error(`VT off-table: ${safety.join(",")}`);
  for (const name of safety) {
    if (!findAdmitStatsEntry(name)) throw new Error(`safety off-table: ${name}`);
  }
});

check("sanitize: off-table safety gets risk bullet", () => {
  const out = sanitizeStatsTierReport(
    { reach: [], match: [], safety: [{ school: "Virginia Tech", why_safety_for_you: "x" }] },
    refIntlBizBody,
    "zh",
  );
  const risks = out.safety[0].key_risks ?? [];
  if (!risks.some((r) => /统计表|admit-stats/i.test(String(r)))) throw new Error(JSON.stringify(risks));
});

check("campus profile: Size and Community loaded from stats table", () => {
  const entry = findAdmitStatsEntry("Harvard University");
  if (entry.campusSize !== "small" || entry.community !== "academic") {
    throw new Error(JSON.stringify({ campusSize: entry.campusSize, community: entry.community }));
  }
});

check("campus profile: social schools list matches table", () => {
  const socialSchools = [
    "Vanderbilt University",
    "USC",
    "University of Florida",
    "Indiana University Bloomington",
  ];
  for (const name of socialSchools) {
    const entry = findAdmitStatsEntry(name);
    if (entry.community !== "social") throw new Error(`${name}=${entry.community}`);
  }
});

check("campus profile: academic pref matches balanced bridge", () => {
  if (!schoolMatchesCommunityPref("balanced", "academic")) throw new Error("balanced should match academic pref");
  if (schoolMatchesCommunityPref("social", "academic")) throw new Error("social should not match academic pref");
});

check("campus profile: no_party dealbreaker penalizes social not balanced", () => {
  const socialEntry = findAdmitStatsEntry("Penn State University");
  const balancedEntry = findAdmitStatsEntry("Ohio State University");
  const ctx = {
    schoolSize: "any",
    campusCulture: "any",
    dealbreakers: { themes: ["no_party"] },
  };
  const socialBoost = campusProfilePrefBoost(socialEntry, ctx);
  const balancedBoost = campusProfilePrefBoost(balancedEntry, ctx);
  if (socialBoost >= balancedBoost) throw new Error(`social=${socialBoost} balanced=${balancedBoost}`);
});

check("chances: academic score uses GPA value + testing only", () => {
  const score = computeChancesAcademicScore({ gpa: "3.7", satScore: "1500", testing: "will_submit" });
  if (score < 78 || score > 92) throw new Error(String(score));
  // A near-perfect profile should land high, not mid-pack.
  const elite = computeChancesAcademicScore({ gpa: "3.95", satScore: "1550", testing: "will_submit" });
  if (elite < 88) throw new Error(`elite=${elite}`);
});

check("chances: Wisconsin match for 3.7 test-optional profile", () => {
  const result = evaluateChances({ gpa: "3.7", testing: "test_optional" }, ["University of Wisconsin-Madison"]);
  const wi = result.schools[0];
  if (!wi?.inTable) throw new Error("Wisconsin not in table");
  if (wi.tier !== "match") throw new Error(JSON.stringify(wi));
});

check("chances: Harvard reach for moderate profile", () => {
  const result = evaluateChances({ gpa: "3.7", testing: "test_optional" }, ["Harvard University"]);
  const hu = result.schools[0];
  if (hu.tier !== "reach") throw new Error(JSON.stringify(hu));
});

check("chances: search returns stats-table schools only", () => {
  const hits = searchAdmitStatsSchools("florida", 5);
  if (!hits.some((h) => h.school.includes("Florida"))) throw new Error(JSON.stringify(hits));
  if (hits.some((h) => /virginia tech/i.test(h.school))) throw new Error("VT not in table");
});

check("chances: fit score decreases as engine gap rises", () => {
  const low = engineGapToFitScore(-5);
  const high = engineGapToFitScore(15);
  if (low <= high) throw new Error(`${low} vs ${high}`);
});

check("chances: test mode clears inactive score", () => {
  const sat = normalizeChancesBody({ gpa: "3.7", testMode: "sat", satScore: "1400", actScore: "32" });
  if (sat.actScore) throw new Error(JSON.stringify(sat));
  const act = normalizeChancesBody({ gpa: "3.7", testMode: "act", satScore: "1400", actScore: "32" });
  if (act.satScore) throw new Error(JSON.stringify(act));
});

let failed = 0;
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed += 1;
  console.log(`${mark}  ${r.name}${r.err ? `: ${r.err}` : ""}`);
}

process.exit(failed ? 1 : 0);
