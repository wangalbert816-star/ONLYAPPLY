import type { UcCampusKey } from "./ucCampusPortfolio";

/** 1 = 最难录 */
export const UC_CAMPUS_SELECTIVITY: Record<UcCampusKey, number> = {
  berkeley: 1,
  ucla: 1,
  ucsd: 2,
  ucsb: 2,
  uci: 2,
  ucdavis: 3,
  ucsc: 3,
  ucr: 4,
  ucmerced: 5,
};

/**
 * Match official names (e.g. "University of California, Davis") and abbreviations.
 * Order: more specific campus tokens before generic "California".
 */
const CAMPUS_PATTERNS: Array<{ key: UcCampusKey; re: RegExp }> = [
  { key: "berkeley", re: /berkeley|伯克利/i },
  { key: "ucla", re: /california,?\s*los\s*angeles|\bucla\b|洛杉矶分校/i },
  { key: "ucsd", re: /california,?\s*san\s*diego|uc\s*san\s*diego|ucsd|圣地亚哥/i },
  { key: "ucsb", re: /california,?\s*santa\s*barbara|uc\s*santa\s*barbara|ucsb|圣巴巴拉/i },
  { key: "uci", re: /california,?\s*irvine|uc\s*irvine|uci|尔湾/i },
  { key: "ucdavis", re: /california,?\s*davis|uc\s*davis|ucdavis|戴维斯/i },
  { key: "ucsc", re: /california,?\s*santa\s*cruz|uc\s*santa\s*cruz|ucsc|圣克鲁斯/i },
  { key: "ucr", re: /california,?\s*riverside|uc\s*riverside|ucr|河滨/i },
  { key: "ucmerced", re: /california,?\s*merced|uc\s*merced|ucmerced|默塞德/i },
];

export function ucCampusKeyFromSchool(school: string): UcCampusKey | null {
  for (const { key, re } of CAMPUS_PATTERNS) {
    if (re.test(school)) return key;
  }
  return null;
}

export function ucCampusSelectivity(school: string): number {
  const key = ucCampusKeyFromSchool(school);
  return key ? UC_CAMPUS_SELECTIVITY[key] : 99;
}
