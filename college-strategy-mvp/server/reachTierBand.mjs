/** Reach portfolio banding — keep selectivity coherent within the 3-school Reach tier. */

export function schoolReachBand(statsEntry, catalogEntry) {
  const rate = statsEntry?.acceptanceRate;
  const sel = Number(statsEntry?.selectivity ?? catalogEntry?.selectivity ?? 70);
  if (rate != null && Number.isFinite(rate)) {
    if (rate < 0.15) return "A";
    if (rate < 0.35) return "B";
    if (rate < 0.55) return "C";
    return "D";
  }
  if (sel >= 85) return "A";
  if (sel >= 65) return "B";
  if (sel >= 45) return "C";
  return "D";
}

const BAND_ORDER = { A: 0, B: 1, C: 2, D: 3 };

export function reachBandDistance(a, b) {
  return Math.abs(BAND_ORDER[a] - BAND_ORDER[b]);
}

export function classifyReachKind(candidate) {
  const flags = candidate.statsGap?.flags ?? [];
  const band = schoolReachBand(candidate.statsEntry, candidate.entry);

  if (flags.includes("major_selective_match") || flags.includes("major_selective_match_hard")) {
    return "reach_major";
  }
  if (flags.includes("reach_major_bump") && band === "D") return "reach_major";
  if (band === "A" || band === "B") return "reach_elite";
  return "reach_stretch";
}

export function reachOutlierPenalty(candidate, anchorBand) {
  const band = schoolReachBand(candidate.statsEntry, candidate.entry);
  const dist = reachBandDistance(band, anchorBand);
  if (dist === 0) return 0;
  if (dist === 1) return -10;
  return -32 - dist * 14;
}

function normalizeSchoolKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick Reach schools within a coherent selectivity band; max 1 major-selective high-admit bump.
 */
export function pickReachWithBandSpread(candidates, count = 3) {
  const rows = candidates
    .filter((c) => c.tier === "reach")
    .map((c) => ({
      ...c,
      reachBand: schoolReachBand(c.statsEntry, c.entry),
      reachKind: classifyReachKind(c),
    }))
    .sort((a, b) => b.rank - a.rank || b.fit - a.fit || a.entry.school.localeCompare(b.entry.school));

  const picked = [];
  const seen = new Set();
  let anchorBand = null;
  let majorSelectiveUsed = 0;

  const canPick = (row) => {
    if (row.reachKind === "reach_major" && majorSelectiveUsed >= 1) return false;
    if (!anchorBand) return true;
    return reachBandDistance(row.reachBand, anchorBand) <= 1;
  };

  const push = (row) => {
    const key = normalizeSchoolKey(row.entry.school);
    if (seen.has(key) || !canPick(row)) return false;
    seen.add(key);
    picked.push(row);
    if (row.reachKind === "reach_major") majorSelectiveUsed += 1;
    if (!anchorBand) anchorBand = row.reachBand;
    return true;
  };

  const eliteFirst = rows.filter((r) => r.reachBand === "A" || r.reachBand === "B");
  const stretchPool = rows.filter((r) => r.reachBand === "C");
  const seedPool = eliteFirst.length ? eliteFirst : stretchPool.length ? stretchPool : rows;

  for (const row of seedPool) {
    if (picked.length >= count) break;
    push(row);
  }

  if (picked.length < count && anchorBand) {
    const remaining = rows
      .filter((r) => !seen.has(normalizeSchoolKey(r.entry.school)))
      .map((r) => ({ ...r, adjustedRank: r.rank + reachOutlierPenalty(r, anchorBand) }))
      .sort((a, b) => b.adjustedRank - a.adjustedRank);
    for (const row of remaining) {
      if (picked.length >= count) break;
      push(row);
    }
  }

  for (const row of rows) {
    if (picked.length >= count) break;
    push(row);
  }

  return picked.slice(0, count);
}
