import type { FormState, ReportDiff, ReportPayload, SchoolTier } from "../types";
import { buildFiveDimensionProfile, type ProfileDimensionKey } from "./fiveDimensionProfile";
import type { Locale } from "../i18n/strings";

const TIERS: SchoolTier[] = ["reach", "match", "safety"];

function axisLabel(key: ProfileDimensionKey, locale: Locale): string {
  const zh: Record<ProfileDimensionKey, string> = {
    academic: "学术",
    testing: "标化",
    activities: "活动",
    essays: "文书",
    strategy: "策略",
  };
  const en: Record<ProfileDimensionKey, string> = {
    academic: "Academic",
    testing: "Testing",
    activities: "Activities",
    essays: "Essays",
    strategy: "Strategy",
  };
  return (locale === "en" ? en : zh)[key];
}

function compareDimensions(
  prevForm: FormState,
  nextForm: FormState,
  locale: Locale,
): ReportDiff["dimensionChanges"] {
  const a = buildFiveDimensionProfile(prevForm, locale);
  const b = buildFiveDimensionProfile(nextForm, locale);
  const out: ReportDiff["dimensionChanges"] = [];
  for (const dim of a) {
    const other = b.find((x) => x.key === dim.key);
    if (!other || other.score === dim.score) continue;
    out.push({
      key: dim.key,
      label: axisLabel(dim.key, locale),
      before: dim.score,
      after: other.score,
    });
  }
  return out;
}

function executiveSummaryChanged(prev: ReportPayload, next: ReportPayload): boolean {
  return JSON.stringify(prev.executive_summary ?? []) !== JSON.stringify(next.executive_summary ?? []);
}

function placementMap(report: ReportPayload): Map<string, { tier: SchoolTier; display: string }> {
  const m = new Map<string, { tier: SchoolTier; display: string }>();
  for (const tier of TIERS) {
    for (const row of report[tier] || []) {
      const name = (row.school || "").trim();
      if (!name) continue;
      m.set(name.toLowerCase(), { tier, display: name });
    }
  }
  return m;
}

export function compareReports(
  prev: ReportPayload,
  next: ReportPayload,
  opts?: { prevForm?: FormState; nextForm?: FormState; locale?: Locale },
): ReportDiff {
  const b = placementMap(prev);
  const a = placementMap(next);
  const all = new Set([...b.keys(), ...a.keys()]);
  const tierMoves: ReportDiff["tierMoves"] = [];
  const addedSchools: ReportDiff["addedSchools"] = [];
  const removedSchools: ReportDiff["removedSchools"] = [];

  for (const key of all) {
    const pb = b.get(key);
    const pa = a.get(key);
    if (!pb && pa) {
      addedSchools.push({ school: pa.display, schoolKey: key, tier: pa.tier });
    } else if (pb && !pa) {
      removedSchools.push({ school: pb.display, schoolKey: key, tier: pb.tier });
    } else if (pb && pa && pb.tier !== pa.tier) {
      tierMoves.push({
        school: pa.display,
        schoolKey: key,
        fromTier: pb.tier,
        toTier: pa.tier,
      });
    }
  }

  const bg = (prev.information_gaps || []).map((x) => String(x).trim()).filter(Boolean);
  const ag = (next.information_gaps || []).map((x) => String(x).trim()).filter(Boolean);
  const agSet = new Set(ag);
  const bgSet = new Set(bg);
  const gapsRemovedSamples = bg.filter((x) => !agSet.has(x)).slice(0, 4);
  const gapsAddedSamples = ag.filter((x) => !bgSet.has(x)).slice(0, 4);
  const dimensionChanges =
    opts?.prevForm && opts?.nextForm && opts.locale
      ? compareDimensions(opts.prevForm, opts.nextForm, opts.locale)
      : [];

  return {
    tierMoves,
    addedSchools,
    removedSchools,
    gapsBeforeCount: bg.length,
    gapsAfterCount: ag.length,
    gapsAddedSamples,
    gapsRemovedSamples,
    dimensionChanges,
    executiveSummaryChanged: executiveSummaryChanged(prev, next),
  };
}

export function reportDiffIsEmpty(d: ReportDiff): boolean {
  return (
    d.tierMoves.length === 0 &&
    d.addedSchools.length === 0 &&
    d.removedSchools.length === 0 &&
    d.gapsBeforeCount === d.gapsAfterCount &&
    d.gapsAddedSamples.length === 0 &&
    d.gapsRemovedSamples.length === 0 &&
    d.dimensionChanges.length === 0 &&
    !d.executiveSummaryChanged
  );
}

export function collectHighlightKeys(diff: ReportDiff): Set<string> {
  const s = new Set<string>();
  for (const m of diff.tierMoves) s.add(m.schoolKey);
  for (const x of diff.addedSchools) s.add(x.schoolKey);
  for (const x of diff.removedSchools) s.add(x.schoolKey);
  return s;
}
