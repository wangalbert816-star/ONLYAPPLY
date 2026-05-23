const UC_CAMPUS_SELECTIVITY = {
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

const PATTERNS = [
  ["berkeley", /berkeley|伯克利/i],
  ["ucla", /california,?\s*los\s*angeles|\bucla\b|洛杉矶分校/i],
  ["ucsd", /california,?\s*san\s*diego|uc\s*san\s*diego|ucsd|圣地亚哥/i],
  ["ucsb", /california,?\s*santa\s*barbara|uc\s*santa\s*barbara|ucsb|圣巴巴拉/i],
  ["uci", /california,?\s*irvine|uc\s*irvine|uci|尔湾/i],
  ["ucdavis", /california,?\s*davis|uc\s*davis|ucdavis|戴维斯/i],
  ["ucsc", /california,?\s*santa\s*cruz|uc\s*santa\s*cruz|ucsc|圣克鲁斯/i],
  ["ucr", /california,?\s*riverside|uc\s*riverside|ucr|河滨/i],
  ["ucmerced", /california,?\s*merced|uc\s*merced|ucmerced|默塞德/i],
];

export function ucCampusKeyFromSchool(school) {
  for (const [key, re] of PATTERNS) {
    if (re.test(String(school || ""))) return key;
  }
  return null;
}

export function ucCampusSelectivity(school) {
  const key = ucCampusKeyFromSchool(school);
  return key ? UC_CAMPUS_SELECTIVITY[key] : 99;
}
