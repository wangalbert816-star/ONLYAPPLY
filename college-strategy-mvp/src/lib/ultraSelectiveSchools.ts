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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Penn State / Pennsylvania State ≠ University of Pennsylvania (UPenn). */
function isPennStateUniversityName(normalized: string): boolean {
  if (!normalized) return false;
  return /^penn state\b/.test(normalized) || /^pennsylvania state\b/.test(normalized);
}

export function isUltraSelectiveSchool(name: string): boolean {
  const normalized = normalizeSchoolName(name);
  if (!normalized) return false;
  if (isPennStateUniversityName(normalized)) return false;
  return ULTRA_SELECTIVE_PATTERNS.some((pattern) => {
    const p = normalizeSchoolName(pattern);
    if (normalized === p) return true;
    if (p.includes(" ")) return normalized.includes(p);
    return new RegExp(`\\b${escapeRegExp(p)}\\b`).test(normalized);
  });
}

export type TopReferenceSchool = {
  tier: SchoolTier;
  row: SchoolRow;
};

/** Legacy helper: main tiers are shown in full; structured top_reference is separate. */
export function splitTopReferenceSchools(report: ReportPayload, _includeLockedRows: boolean) {
  return {
    regular: {
      reach: [...(report.reach ?? [])],
      match: [...(report.match ?? [])],
      safety: [...(report.safety ?? [])],
    },
    topReference: [] as TopReferenceSchool[],
  };
}
