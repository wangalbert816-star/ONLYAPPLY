/** Campus size + community from admit stats table — preference matching for engine rank. */

export const CAMPUS_SIZES = new Set(["small", "medium", "large"]);
export const COMMUNITIES = new Set(["academic", "balanced", "social"]);

export function normalizeCampusSize(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (v === "small" || v === "medium" || v === "large") return v;
  return null;
}

export function normalizeCommunity(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (COMMUNITIES.has(v)) return v;
  return null;
}

/** User small/large both accept medium as bridge; medium pref accepts all. */
export function schoolMatchesCampusSizePref(campusSize, pref) {
  if (!pref || pref === "any") return true;
  if (!campusSize) return true;
  if (pref === "medium") return true;
  if (pref === "small") return campusSize === "small" || campusSize === "medium";
  if (pref === "large") return campusSize === "large" || campusSize === "medium";
  return campusSize === pref;
}

/** Academic/social both accept balanced; balanced pref accepts all. */
export function schoolMatchesCommunityPref(community, pref) {
  if (!pref || pref === "any") return true;
  if (!community) return true;
  if (pref === "balanced") return true;
  if (pref === "academic") return community === "academic" || community === "balanced";
  if (pref === "social") return community === "social" || community === "balanced";
  return community === pref;
}

/** Soft rank adjust (×100 scale in rankCandidate): match boost, mismatch penalty, no_party + social. */
export function campusProfilePrefBoost(statsEntry, context) {
  const campusSize = statsEntry?.campusSize;
  const community = statsEntry?.community;
  if (!campusSize && !community) return 0;

  let boost = 0;
  const sizePref = context.schoolSize;
  const culturePref = context.campusCulture;

  if (sizePref && sizePref !== "any") {
    boost += schoolMatchesCampusSizePref(campusSize, sizePref) ? 0.06 : -0.04;
  }
  if (culturePref && culturePref !== "any") {
    boost += schoolMatchesCommunityPref(community, culturePref) ? 0.05 : -0.04;
  }
  if (context.dealbreakers?.themes.includes("no_party") && community === "social") {
    boost -= 0.14;
  }
  return boost;
}

export function campusProfilePromptNote(statsEntry, locale = "zh") {
  const isEn = locale === "en";
  const size = statsEntry?.campusSize;
  const community = statsEntry?.community;
  if (!size && !community) return null;
  const sizeLabel = size
    ? isEn
      ? { small: "small campus", medium: "medium campus", large: "large campus" }[size]
      : { small: "小型", medium: "中型", large: "大型" }[size]
    : null;
  const commLabel = community
    ? isEn
      ? { academic: "academic", balanced: "balanced", social: "social-forward" }[community]
      : { academic: "学术导向", balanced: "平衡", social: "社交活跃" }[community]
    : null;
  return [sizeLabel, commLabel].filter(Boolean).join(isEn ? "; " : "；") || null;
}
