import type { FormState, SchoolTier } from "../types";
import { structuredActivityBlob } from "./activityEvidence";
import { allowUcFlagshipReach, assessUcProfileSignals, isWeakUcProfile } from "./ucProfileStrength";

export type UcCampusKey =
  | "berkeley"
  | "ucla"
  | "ucsd"
  | "ucsb"
  | "uci"
  | "ucdavis"
  | "ucsc"
  | "ucr"
  | "ucmerced";

type CampusDef = {
  key: UcCampusKey;
  en: string;
  zh: string;
  /** 1 = most selective */
  selectivity: number;
  /** substring tokens in major/activities for fit */
  majorTokens: string[];
};

const CAMPUSES: CampusDef[] = [
  {
    key: "berkeley",
    en: "UC Berkeley",
    zh: "UC Berkeley（伯克利）",
    selectivity: 1,
    majorTokens: [
      "computer",
      "cs",
      "工程",
      "engineering",
      "econ",
      "经济",
      "math",
      "数学",
      "data",
      "物理",
      "physics",
      "化学",
      "chemistry",
    ],
  },
  {
    key: "ucla",
    en: "UCLA",
    zh: "UCLA",
    selectivity: 1,
    majorTokens: [
      "econ",
      "经济",
      "business",
      "商",
      "bio",
      "生物",
      "psych",
      "心理",
      "film",
      "电影",
      "pre-med",
      "医学",
      "political",
      "政治",
      "cs",
      "computer",
    ],
  },
  {
    key: "ucsd",
    en: "UC San Diego",
    zh: "UC San Diego（UCSD）",
    selectivity: 2,
    majorTokens: ["cs", "computer", "bio", "生物", "engineering", "工程", "data", "cognitive", "认知"],
  },
  {
    key: "ucsb",
    en: "UC Santa Barbara",
    zh: "UC Santa Barbara（UCSB）",
    selectivity: 2,
    majorTokens: ["physics", "物理", "cs", "computer", "engineering", "工程", "env", "环境", "media"],
  },
  {
    key: "uci",
    en: "UC Irvine",
    zh: "UC Irvine（UCI）",
    selectivity: 2,
    majorTokens: ["cs", "computer", "business", "商", "bio", "生物", "psych", "心理", "nursing", "护理"],
  },
  {
    key: "ucdavis",
    en: "UC Davis",
    zh: "UC Davis（戴维斯）",
    selectivity: 3,
    majorTokens: [
      "bio",
      "生物",
      "agric",
      "农",
      "vet",
      "兽医",
      "env",
      "环境",
      "psych",
      "心理",
      "design",
      "未定",
      "explor",
    ],
  },
  {
    key: "ucsc",
    en: "UC Santa Cruz",
    zh: "UC Santa Cruz（UCSC）",
    selectivity: 3,
    majorTokens: ["cs", "computer", "game", "游戏", "art", "艺术", "env", "环境", "bio", "生物"],
  },
  {
    key: "ucr",
    en: "UC Riverside",
    zh: "UC Riverside（河滨）",
    selectivity: 4,
    majorTokens: ["business", "商", "cs", "computer", "engineering", "工程", "bio", "生物"],
  },
  {
    key: "ucmerced",
    en: "UC Merced",
    zh: "UC Merced（默塞德）",
    selectivity: 5,
    majorTokens: ["engineering", "工程", "cs", "computer", "bio", "生物", "未定", "explor"],
  },
];

function profileBlob(form: FormState): string {
  return [form.majorPrimary, form.majorSecondary, structuredActivityBlob(form), form.gpa, form.dealbreakers]
    .join(" ")
    .toLowerCase();
}

function campusFitScore(campus: CampusDef, blob: string): number {
  let score = 0.15;
  for (const token of campus.majorTokens) {
    if (token && blob.includes(token.toLowerCase())) score += 0.22;
  }
  return Math.min(1, score);
}

function isConservativeList(form: FormState): boolean {
  return form.riskStyle === "conservative";
}

function isAggressiveList(form: FormState): boolean {
  return form.riskStyle === "aggressive";
}

function gpaEvidenceThin(form: FormState): boolean {
  return form.gpa.trim().length < 40 || isWeakUcProfile(form);
}

function bySelectivityThenFit(a: CampusDef, b: CampusDef, scores: Map<UcCampusKey, number>) {
  if (a.selectivity !== b.selectivity) return a.selectivity - b.selectivity;
  return (scores.get(b.key) ?? 0) - (scores.get(a.key) ?? 0);
}

export type UcCampusPick = {
  campus: CampusDef;
  tier: SchoolTier;
  fitScore: number;
};

/** 按问卷生成 UC 校区组合，避免固定「Berkeley + UCLA 冲刺」模板 */
export function pickUcCampusPortfolio(form: FormState): UcCampusPick[] {
  const blob = profileBlob(form);
  const scores = new Map<UcCampusKey, number>();
  for (const c of CAMPUSES) scores.set(c.key, campusFitScore(c, blob));

  const ranked = [...CAMPUSES].sort((a, b) => bySelectivityThenFit(a, b, scores));
  const conservative = isConservativeList(form);
  const aggressive = isAggressiveList(form);
  const signals = assessUcProfileSignals(form);
  const thin = gpaEvidenceThin(form) || signals.activityThin;
  const weak = isWeakUcProfile(form, signals);
  const flagshipOk = allowUcFlagshipReach(form, signals);

  const topTier = ranked.filter((c) => c.selectivity <= 1);
  const upperMid = ranked.filter((c) => c.selectivity === 2);
  const mid = ranked.filter((c) => c.selectivity === 3);
  const safetyPool = ranked.filter((c) => c.selectivity >= 4);

  const sortByFit = (list: CampusDef[]) =>
    [...list].sort((a, b) => (scores.get(b.key) ?? 0) - (scores.get(a.key) ?? 0));

  const reach: CampusDef[] = [];
  const match: CampusDef[] = [];
  const safety: CampusDef[] = [];

  const bestTop = sortByFit(topTier)[0];
  const secondTop = sortByFit(topTier)[1];
  const bestUpper = sortByFit(upperMid)[0];
  const secondUpper = sortByFit(upperMid)[1];
  const bestMid = sortByFit(mid)[0];

  const topFit = bestTop ? scores.get(bestTop.key) ?? 0 : 0;

  if (weak) {
    if (bestUpper) reach.push(bestUpper);
    if (secondUpper && !reach.includes(secondUpper) && reach.length < 2) reach.push(secondUpper);
    if (reach.length === 0 && bestMid) reach.push(bestMid);
    for (const c of sortByFit(mid)) {
      if (match.length >= 3) break;
      if (!reach.includes(c)) match.push(c);
    }
    for (const c of sortByFit(upperMid)) {
      if (match.length >= 3) break;
      if (!reach.includes(c) && !match.includes(c)) match.push(c);
    }
    if (flagshipOk && bestTop && !reach.includes(bestTop) && !match.includes(bestTop)) {
      match.push(bestTop);
    }
    if (flagshipOk && secondTop && secondTop !== bestTop && !reach.includes(secondTop) && !match.includes(secondTop)) {
      match.push(secondTop);
    }
  } else if (conservative || thin) {
    if (bestTop && topFit >= 0.45 && flagshipOk) reach.push(bestTop);
    if (reach.length < 2 && bestUpper) reach.push(bestUpper);
    if (reach.length === 0 && bestUpper) reach.push(bestUpper);
    if (secondUpper && !reach.includes(secondUpper)) match.push(secondUpper);
    if (bestMid && !reach.includes(bestMid) && !match.includes(bestMid)) match.push(bestMid);
    if (match.length < 2 && sortByFit(upperMid).find((c) => !reach.includes(c) && !match.includes(c))) {
      const extra = sortByFit(upperMid).find((c) => !reach.includes(c) && !match.includes(c));
      if (extra) match.push(extra);
    }
  } else if (aggressive && topFit >= 0.5 && flagshipOk) {
    if (bestTop) reach.push(bestTop);
    if (secondTop && scores.get(secondTop.key)! >= 0.4 && reach.length < 2) reach.push(secondTop);
    if (reach.length < 2 && bestUpper && !reach.includes(bestUpper)) reach.push(bestUpper);
    if (bestUpper && !reach.includes(bestUpper)) match.push(bestUpper);
    if (secondUpper && !reach.includes(secondUpper) && !match.includes(secondUpper)) match.push(secondUpper);
  } else {
    if (bestTop && topFit >= 0.55 && flagshipOk) reach.push(bestTop);
    else if (bestUpper) reach.push(bestUpper);
    if (reach.length < 2) {
      const reach2 =
        bestTop && !reach.includes(bestTop) && topFit >= 0.45
          ? bestTop
          : secondUpper && !reach.includes(secondUpper)
            ? secondUpper
            : bestUpper && !reach.includes(bestUpper)
              ? bestUpper
              : null;
      if (reach2) reach.push(reach2);
    }
    if (bestUpper && !reach.includes(bestUpper)) match.push(bestUpper);
    if (secondUpper && !reach.includes(secondUpper) && !match.includes(secondUpper)) match.push(secondUpper);
    if (match.length < 2 && bestMid) match.push(bestMid);
  }

  for (const c of sortByFit(safetyPool)) {
    if (safety.length >= 2) break;
    if (!reach.includes(c) && !match.includes(c)) safety.push(c);
  }
  if (weak) {
    safety.splice(0, safety.length, ...safety.filter((c) => c.selectivity >= 4));
  }
  if (safety.length < 2) {
    for (const c of sortByFit(safetyPool)) {
      if (safety.length >= 2) break;
      if (!safety.includes(c)) safety.push(c);
    }
  }

  const used = new Set<UcCampusKey>();
  const out: UcCampusPick[] = [];
  const pushTier = (list: CampusDef[], tier: SchoolTier) => {
    for (const c of list.slice(0, tier === "reach" ? 2 : 3)) {
      if (used.has(c.key)) continue;
      used.add(c.key);
      out.push({ campus: c, tier, fitScore: scores.get(c.key) ?? 0 });
    }
  };
  pushTier(reach, "reach");
  pushTier(match, "match");
  pushTier(safety, "safety");

  return out;
}

export function getCampusDef(key: UcCampusKey): CampusDef | undefined {
  return CAMPUSES.find((c) => c.key === key);
}
