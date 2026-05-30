import type { ProfileDimensionKey } from "./fiveDimensionProfile";
import { normalizeSchoolNameInput, schoolNameMatchesAny } from "./schoolNameResolve";
import type { ReportPayload, SchoolTier } from "../types";

export type SchoolBenchmarkScores = Record<ProfileDimensionKey, number>;

type BenchmarkEntry = { patterns: RegExp[]; scores: SchoolBenchmarkScores };

/** 典型录取者五维参考分（0–100），用于与同档学校 CDS / 官方画像对齐的示意对比，非录取预测。 */
const CURATED: BenchmarkEntry[] = [
  {
    patterns: [/stanford/i, /斯坦福/],
    scores: { academic: 96, testing: 94, activities: 95, rigor: 92, strategy: 90 },
  },
  {
    patterns: [/harvard/i, /哈佛/],
    scores: { academic: 97, testing: 95, activities: 94, rigor: 93, strategy: 91 },
  },
  {
    patterns: [/massachusetts institute|^\s*mit\s*$|麻省理工/i],
    scores: { academic: 98, testing: 97, activities: 90, rigor: 86, strategy: 88 },
  },
  {
    patterns: [/yale/i, /耶鲁/],
    scores: { academic: 96, testing: 93, activities: 93, rigor: 94, strategy: 90 },
  },
  {
    patterns: [/princeton/i, /普林斯顿/],
    scores: { academic: 97, testing: 95, activities: 92, rigor: 92, strategy: 90 },
  },
  {
    patterns: [/columbia/i, /哥伦比亚/],
    scores: { academic: 95, testing: 92, activities: 92, rigor: 91, strategy: 88 },
  },
  {
    patterns: [/upenn|university of pennsylvania|宾夕法|宾大/i],
    scores: { academic: 94, testing: 90, activities: 91, rigor: 89, strategy: 87 },
  },
  {
    patterns: [/\bduke\b/i, /杜克/],
    scores: { academic: 94, testing: 91, activities: 92, rigor: 88, strategy: 87 },
  },
  {
    patterns: [/northwestern/i, /西北大学/],
    scores: { academic: 93, testing: 90, activities: 91, rigor: 89, strategy: 86 },
  },
  {
    patterns: [/cornell/i, /康奈尔/],
    scores: { academic: 92, testing: 88, activities: 90, rigor: 87, strategy: 85 },
  },
  {
    patterns: [/\bbrown\b/i, /布朗/],
    scores: { academic: 91, testing: 86, activities: 91, rigor: 92, strategy: 86 },
  },
  {
    patterns: [/dartmouth/i, /达特茅斯/],
    scores: { academic: 93, testing: 90, activities: 90, rigor: 89, strategy: 86 },
  },
  {
    patterns: [/uchicago|university of chicago|芝加哥大学/i],
    scores: { academic: 95, testing: 92, activities: 89, rigor: 91, strategy: 87 },
  },
  {
    patterns: [/berkeley|伯克利/i],
    scores: { academic: 94, testing: 82, activities: 90, rigor: 87, strategy: 85 },
  },
  {
    patterns: [/\bucla\b|洛杉矶分校/i],
    scores: { academic: 91, testing: 80, activities: 89, rigor: 85, strategy: 83 },
  },
  {
    patterns: [/uc san diego|ucsd/i],
    scores: { academic: 88, testing: 78, activities: 84, rigor: 82, strategy: 80 },
  },
  {
    patterns: [/uc irvine|uci/i],
    scores: { academic: 86, testing: 76, activities: 82, rigor: 80, strategy: 78 },
  },
  {
    patterns: [/uc davis/i],
    scores: { academic: 84, testing: 74, activities: 80, rigor: 78, strategy: 76 },
  },
  {
    patterns: [/uc santa barbara|ucsb/i],
    scores: { academic: 85, testing: 75, activities: 81, rigor: 79, strategy: 77 },
  },
  {
    patterns: [/michigan|umich/i, /密歇根/],
    scores: { academic: 90, testing: 86, activities: 88, rigor: 84, strategy: 82 },
  },
  {
    patterns: [/\bnyu\b|new york university|纽约大学/i],
    scores: { academic: 88, testing: 84, activities: 87, rigor: 86, strategy: 83 },
  },
  {
    patterns: [/\busc\b|southern california|南加州/i],
    scores: { academic: 89, testing: 85, activities: 90, rigor: 85, strategy: 84 },
  },
  {
    patterns: [/texas at austin|ut austin|德州奥斯汀/i],
    scores: { academic: 88, testing: 84, activities: 86, rigor: 82, strategy: 81 },
  },
  {
    patterns: [/\bunc\b|chapel hill|北卡罗来纳/i],
    scores: { academic: 87, testing: 82, activities: 85, rigor: 83, strategy: 80 },
  },
  {
    patterns: [/georgia tech|georgia institute|佐治亚理工/i],
    scores: { academic: 92, testing: 90, activities: 84, rigor: 80, strategy: 82 },
  },
  {
    patterns: [/university of illinois|uiuc|伊利诺伊/i],
    scores: { academic: 90, testing: 88, activities: 82, rigor: 79, strategy: 80 },
  },
  {
    patterns: [/university of washington|\buw\b/i],
    scores: { academic: 86, testing: 80, activities: 83, rigor: 81, strategy: 78 },
  },
  {
    patterns: [/\bpurdue\b/i, /普渡/],
    scores: { academic: 87, testing: 85, activities: 80, rigor: 77, strategy: 78 },
  },
  {
    patterns: [/carnegie mellon|\bcmu\b/i, /卡内基梅隆/],
    scores: { academic: 93, testing: 91, activities: 85, rigor: 82, strategy: 84 },
  },
  {
    patterns: [/vanderbilt/i, /范德堡/],
    scores: { academic: 91, testing: 88, activities: 88, rigor: 86, strategy: 84 },
  },
  {
    patterns: [/\brice\b/i, /莱斯/],
    scores: { academic: 92, testing: 89, activities: 87, rigor: 85, strategy: 83 },
  },
  {
    patterns: [/\bemory\b/i, /埃默里/],
    scores: { academic: 90, testing: 87, activities: 87, rigor: 85, strategy: 82 },
  },
];

type SelectivityBand = "ultra" | "high" | "selective" | "moderate" | "accessible";

const BAND_DEFAULTS: Record<SelectivityBand, SchoolBenchmarkScores> = {
  ultra: { academic: 95, testing: 92, activities: 93, rigor: 91, strategy: 89 },
  high: { academic: 88, testing: 84, activities: 86, rigor: 84, strategy: 82 },
  selective: { academic: 80, testing: 76, activities: 78, rigor: 76, strategy: 74 },
  moderate: { academic: 72, testing: 68, activities: 70, rigor: 68, strategy: 66 },
  accessible: { academic: 64, testing: 60, activities: 62, rigor: 62, strategy: 60 },
};

function tierToBand(tier: SchoolTier): SelectivityBand {
  if (tier === "reach") return "high";
  if (tier === "match") return "selective";
  return "moderate";
}

export type SchoolBenchmarkResult = {
  scores: SchoolBenchmarkScores;
  source: "curated" | "tier";
};

export function lookupSchoolBenchmark(school: string, tierHint?: SchoolTier): SchoolBenchmarkResult {
  for (const entry of CURATED) {
    if (schoolNameMatchesAny(school, entry.patterns)) {
      return { scores: { ...entry.scores }, source: "curated" };
    }
  }
  const band = tierHint ? tierToBand(tierHint) : "selective";
  return { scores: { ...BAND_DEFAULTS[band] }, source: "tier" };
}

export type ReportSchoolOption = { school: string; tier: SchoolTier };

export function collectReportSchoolOptions(report: ReportPayload): ReportSchoolOption[] {
  const seen = new Set<string>();
  const out: ReportSchoolOption[] = [];

  const add = (school: string, tier: SchoolTier) => {
    const key = normalizeSchoolNameInput(school).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ school: school.trim(), tier });
  };

  for (const row of report.reach ?? []) add(row.school, "reach");
  for (const row of report.match ?? []) add(row.school, "match");
  for (const row of report.safety ?? []) add(row.school, "safety");
  for (const row of report.top_reference_schools ?? []) add(row.school, "reach");

  return out;
}

export const PROFILE_DIMENSION_KEYS: ProfileDimensionKey[] = [
  "academic",
  "testing",
  "activities",
  "rigor",
  "strategy",
];

export function benchmarkScoresToOrderedList(scores: SchoolBenchmarkScores): number[] {
  return PROFILE_DIMENSION_KEYS.map((k) => scores[k]);
}
