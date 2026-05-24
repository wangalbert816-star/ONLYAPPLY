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
    activities: "暂无详细活动描述，活动列表偏少。",
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

let failed = 0;
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed += 1;
  console.log(`${mark}  ${r.name}${r.err ? `: ${r.err}` : ""}`);
}

process.exit(failed ? 1 : 0);
