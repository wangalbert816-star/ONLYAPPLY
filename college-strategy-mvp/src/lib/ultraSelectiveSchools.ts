import type { ReportPayload, SchoolRow, SchoolTier } from "../types";

const ULTRA_SELECTIVE_PATTERNS = [
  "mit",
  "massachusetts institute of technology",
  "stanford",
  "stanford university",
  "harvard",
  "harvard university",
  "princeton",
  "princeton university",
  "yale",
  "yale university",
  "caltech",
  "california institute of technology",
  "columbia",
  "columbia university",
  "university of pennsylvania",
  "upenn",
  "penn",
  "duke",
  "duke university",
  "brown",
  "brown university",
  "dartmouth",
  "dartmouth college",
  "cornell",
  "cornell university",
  "university of chicago",
  "uchicago",
];

function normalizeSchoolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isUltraSelectiveSchool(name: string): boolean {
  const normalized = normalizeSchoolName(name);
  if (!normalized) return false;
  return ULTRA_SELECTIVE_PATTERNS.some((pattern) => {
    const p = normalizeSchoolName(pattern);
    return normalized === p || normalized.includes(p);
  });
}

export type TopReferenceSchool = {
  tier: SchoolTier;
  row: SchoolRow;
};

export function splitTopReferenceSchools(report: ReportPayload, includeLockedRows: boolean) {
  const tiers: SchoolTier[] = ["reach", "match", "safety"];
  const topReference: TopReferenceSchool[] = [];
  const regular: Record<SchoolTier, SchoolRow[]> = {
    reach: [],
    match: [],
    safety: [],
  };

  for (const tier of tiers) {
    const rows = report[tier] ?? [];
    const visibleRows = includeLockedRows ? rows : rows.slice(0, 1);
    regular[tier] = rows.filter((row) => !isUltraSelectiveSchool(row.school));
    for (const row of visibleRows) {
      if (isUltraSelectiveSchool(row.school)) topReference.push({ tier, row });
    }
  }

  return { regular, topReference };
}
