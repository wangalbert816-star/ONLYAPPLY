/** Canonicalize report school names against the admit-stats table before calibration. */

import { resolveAdmitStatsSchool } from "./schoolAdmitStats.mjs";

const MAIN_TIERS = ["reach", "match", "safety"];

function canonicalizeRow(row) {
  if (!row || typeof row !== "object") return { row, changed: false, resolved: null };
  const school = String(row.school ?? "").trim();
  if (!school) return { row, changed: false, resolved: null };

  const resolved = resolveAdmitStatsSchool(school);
  if (resolved.confidence === "none" || !resolved.canonicalName) {
    return { row, changed: false, resolved };
  }
  if (resolved.canonicalName === school) {
    return { row, changed: false, resolved };
  }
  return {
    row: { ...row, school: resolved.canonicalName },
    changed: true,
    resolved,
  };
}

/**
 * Rewrite main-tier school names to stats-table canonical spellings when matched confidently.
 * @param {Record<string, unknown>} parsed
 * @param {{ logTag?: string }} [options]
 */
export function canonicalizeReportSchoolNames(parsed, options = {}) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const logTag = options.logTag ?? "[stats/canonicalize]";
  const seen = new Map();

  for (const tier of MAIN_TIERS) {
    const rows = parsed[tier];
    if (!Array.isArray(rows)) continue;

    parsed[tier] = rows.map((row, idx) => {
      const { row: next, changed, resolved } = canonicalizeRow(row);
      if (changed) {
        console.info(`${logTag} ${tier}[${idx}] ${String(row.school)} -> ${next.school}`);
      }

      const key = String(next.school ?? "").trim().toLowerCase();
      if (key) {
        if (seen.has(key) && seen.get(key) !== tier) {
          console.warn(`${logTag} duplicate canonical school "${next.school}" in ${seen.get(key)} and ${tier}`);
        }
        seen.set(key, tier);
      }
      return next;
    });
  }

  return parsed;
}
