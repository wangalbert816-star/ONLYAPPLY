import type { FormState, SchoolRow, SchoolTier, UcAnalysis } from "../types";
import type { Locale } from "../i18n/strings";
import type { UcCampusKey } from "./ucCampusPortfolio";
import { ucCampusKeyFromSchool, ucCampusSelectivity } from "./ucCampusSelectivity";
import {
  allowUcFlagshipReach,
  assessUcProfileSignals,
  isWeakUcProfile,
} from "./ucProfileStrength";
import {
  sanitizeSchoolRowUndergradCopy,
  sanitizeUndergradSchoolMentions,
  containsUndergradFacultyErrors,
} from "./undergradCopySanitize";
import { filterUcTestBlindBullets, sanitizeUcTestBlindCopy } from "./ucTestBlindCopySanitize";

/** selectivity 1–2 不宜作弱档案的「保底」 */
const NOT_TRUE_SAFETY_KEYS = new Set<UcCampusKey>([
  "berkeley",
  "ucla",
  "ucsd",
  "ucsb",
  "uci",
  "ucdavis",
  "ucsc",
]);

function schoolToCampusKey(school: string): UcCampusKey | null {
  return ucCampusKeyFromSchool(school);
}

function tierIndex(tier: SchoolTier): number {
  if (tier === "reach") return 0;
  if (tier === "match") return 1;
  return 2;
}

type Entry = { row: SchoolRow; tier: SchoolTier };

function demoteEasierCampusesWithinTier(entries: Entry[], locale: Locale, notes: string[]) {
  for (const tier of ["reach", "match", "safety"] as const) {
    const inTier = entries
      .filter((e) => e.tier === tier)
      .sort((a, b) => ucCampusSelectivity(a.row.school) - ucCampusSelectivity(b.row.school));
    if (inTier.length < 2) continue;
    const hardestSel = ucCampusSelectivity(inTier[0]!.row.school);
    for (let k = 1; k < inTier.length; k++) {
      const e = inTier[k]!;
      const sel = ucCampusSelectivity(e.row.school);
      if (sel - hardestSel < 2) continue;
      const down: SchoolTier | null = tier === "reach" ? "match" : tier === "match" ? "safety" : null;
      if (!down) continue;
      e.row = moveRowToTier(e.row, e.tier, down);
      e.tier = down;
      notes.push(
        locale === "en"
          ? `${e.row.school} moved to ${down} (less selective than other ${tier} campuses).`
          : `已将 ${e.row.school} 调整为${down === "match" ? "匹配" : "保底"}档（在同档中选择性更低）。`,
      );
    }
  }
}

function whyKeyForTier(tier: SchoolTier): keyof SchoolRow {
  if (tier === "reach") return "why_reach_for_you";
  if (tier === "match") return "why_match_for_you";
  return "why_safety_for_you";
}

function moveRowToTier(row: SchoolRow, from: SchoolTier, to: SchoolTier): SchoolRow {
  if (from === to) return row;
  const why =
    String(row.why_reach_for_you || "") ||
    String(row.why_match_for_you || "") ||
    String(row.why_safety_for_you || "");
  const next: SchoolRow = { ...row };
  delete next.why_reach_for_you;
  delete next.why_match_for_you;
  delete next.why_safety_for_you;
  const key = whyKeyForTier(to);
  if (key === "why_reach_for_you") next.why_reach_for_you = why;
  else if (key === "why_match_for_you") next.why_match_for_you = why;
  else next.why_safety_for_you = why;
  return next;
}

function alignTierLanguage(text: string, tier: SchoolTier, locale: Locale): string {
  let s = text;
  if (tier === "reach") {
    s = s.replace(/匹配档|稳妥主战场|match\s*tier/gi, locale === "en" ? "reach tier" : "冲刺档");
  } else if (tier === "match") {
    s = s.replace(
      /冲刺层|冲刺档|reach\s*层|reach\s*tier|\bUC\s*reach\b|\bUC\s*冲刺\b/gi,
      locale === "en" ? "match tier" : "匹配档",
    );
  } else {
    s = s.replace(/冲刺层|reach\s*层/gi, locale === "en" ? "safety tier" : "保底档");
  }
  return s.trim();
}

function fixSelectivityTierInversions(
  reach: SchoolRow[],
  match: SchoolRow[],
  safety: SchoolRow[],
  locale: Locale,
  flagshipOk: boolean,
): { reach: SchoolRow[]; match: SchoolRow[]; safety: SchoolRow[]; notes: string[] } {
  const notes: string[] = [];
  const entries: Entry[] = [
    ...reach.map((row) => ({ row, tier: "reach" as const })),
    ...match.map((row) => ({ row, tier: "match" as const })),
    ...safety.map((row) => ({ row, tier: "safety" as const })),
  ];

  let changed = true;
  let guard = 0;
  while (changed && guard < 12) {
    changed = false;
    guard += 1;
    for (let i = 0; i < entries.length; i++) {
      for (let j = 0; j < entries.length; j++) {
        if (i === j) continue;
        const harder = entries[i]!;
        const easier = entries[j]!;
        const selHard = ucCampusSelectivity(harder.row.school);
        const selEasy = ucCampusSelectivity(easier.row.school);
        if (selHard >= selEasy || selHard >= 90 || selEasy >= 90) continue;
        if (tierIndex(harder.tier) <= tierIndex(easier.tier)) continue;

        const hardKey = schoolToCampusKey(harder.row.school);
        const blockFlagshipReach =
          !flagshipOk && (hardKey === "berkeley" || hardKey === "ucla");

        if (blockFlagshipReach) {
          const down = harder.tier;
          easier.row = moveRowToTier(easier.row, easier.tier, down);
          easier.tier = down;
          notes.push(
            locale === "en"
              ? `${easier.row.school} moved to ${down}—cannot rank above ${harder.row.school} while flagship campuses stay out of Reach.`
              : `已将 ${easier.row.school} 调整为${down === "match" ? "匹配" : "保底"}档：在顶校不作冲刺时，不应把更易录校区标在更高档。`,
          );
        } else {
          const up = easier.tier;
          harder.row = moveRowToTier(harder.row, harder.tier, up);
          harder.tier = up;
          notes.push(
            locale === "en"
              ? `${harder.row.school} tier adjusted to ${up} (more selective than ${easier.row.school}).`
              : `已将 ${harder.row.school} 调整为${up === "reach" ? "冲刺" : up === "match" ? "匹配" : "保底"}档（录取难度高于 ${easier.row.school}）。`,
          );
        }
        changed = true;
      }
    }
  }

  demoteEasierCampusesWithinTier(entries, locale, notes);

  const outReach: SchoolRow[] = [];
  const outMatch: SchoolRow[] = [];
  const outSafety: SchoolRow[] = [];
  for (const e of entries) {
    const row = e.row;
    if (e.tier === "reach") outReach.push(row);
    else if (e.tier === "match") outMatch.push(row);
    else outSafety.push(row);
  }
  return { reach: outReach, match: outMatch, safety: outSafety, notes };
}

function cleanCampusCopy(text: string, school: string, locale: Locale, weak: boolean, tier: SchoolTier): string {
  let s = sanitizeUndergradSchoolMentions(text, school, locale);
  s = sanitizeUcTestBlindCopy(s, locale);
  if (weak) {
    s = s.replace(
      /很有可能|突破|逆袭|仍有机会冲刺|award.*breakthrough/gi,
      locale === "en" ? "still a very low-probability stretch" : "仍属极低概率冲刺",
    );
    s = s.replace(/匹配度较高|strong fit/gi, locale === "en" ? "needs much stronger evidence" : "仍需大幅补强证据");
  }
  return alignTierLanguage(s.trim(), tier, locale);
}

function sanitizeRow(row: SchoolRow, tier: SchoolTier, locale: Locale, weak: boolean): SchoolRow {
  const base = sanitizeSchoolRowUndergradCopy(row, tier, locale);
  const whyKey =
    tier === "reach" ? "why_reach_for_you" : tier === "match" ? "why_match_for_you" : "why_safety_for_you";
  const school = row.school || "";
  const clean = (t: string, fieldTier: SchoolTier = tier) =>
    cleanCampusCopy(String(t || ""), school, locale, weak, fieldTier);
  return {
    ...base,
    [whyKey]: clean(String(base[whyKey] || "")),
    key_risks: filterUcTestBlindBullets(
      (base.key_risks ?? []).map((r) => clean(r)),
      locale,
    ),
    key_fit_signals: (base.key_fit_signals ?? []).map((r) => clean(r)),
    verification_focus: filterUcTestBlindBullets(
      (base.verification_focus ?? []).map((r) => clean(r)),
      locale,
    ),
    campus_vibe: base.campus_vibe ? clean(base.campus_vibe) : base.campus_vibe,
    differentiation: base.differentiation ? clean(base.differentiation) : base.differentiation,
    context_note: base.context_note ? clean(base.context_note) : base.context_note,
  };
}

function dedupeRows(rows: SchoolRow[]): SchoolRow[] {
  const seen = new Set<string>();
  const out: SchoolRow[] = [];
  for (const r of rows) {
    const k = (r.school || "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function rebalanceTiers(
  reach: SchoolRow[],
  match: SchoolRow[],
  safety: SchoolRow[],
  form: FormState,
  locale: Locale,
): { reach: SchoolRow[]; match: SchoolRow[]; safety: SchoolRow[]; notes: string[] } {
  const signals = assessUcProfileSignals(form);
  const weak = isWeakUcProfile(form, signals);
  const flagshipOk = allowUcFlagshipReach(form, signals);
  const notes: string[] = [];

  let r = [...reach];
  let m = [...match];
  let s = [...safety];

  const demote = (from: SchoolRow[], to: SchoolRow[], row: SchoolRow) => {
    const i = from.findIndex((x) => x.school === row.school);
    if (i >= 0) from.splice(i, 1);
    if (!to.some((x) => x.school === row.school)) to.push(row);
  };

  if (weak) {
    for (const item of [...s]) {
      const key = schoolToCampusKey(item.school);
      if (key && NOT_TRUE_SAFETY_KEYS.has(key)) {
        demote(s, m, item);
        notes.push(
          locale === "en"
            ? `${item.school} is not a true UC safety for this profile—moved to Match.`
            : `${item.school} 对当前背景不宜标为保底，已调整为匹配档。`,
        );
      }
    }
  }

  let fixed = fixSelectivityTierInversions(r, m, s, locale, flagshipOk);
  r = fixed.reach;
  m = fixed.match;
  s = fixed.safety;
  notes.push(...fixed.notes);

  if (!flagshipOk) {
    for (const item of [...r]) {
      const key = schoolToCampusKey(item.school);
      if (key === "berkeley" || key === "ucla") {
        demote(r, m, item);
        notes.push(
          locale === "en"
            ? `${item.school} moved out of Reach—GPA/activities do not support a flagship UC stretch tier.`
            : `已将 ${item.school} 移出冲刺档：以当前成绩/活动，不宜作 UC 顶校冲刺。`,
        );
      }
    }
    fixed = fixSelectivityTierInversions(r, m, s, locale, flagshipOk);
    r = fixed.reach;
    m = fixed.match;
    s = fixed.safety;
    notes.push(...fixed.notes);
  }

  if (r.length === 0 && m.length > 0) {
    const sorted = [...m].sort(
      (a, b) => ucCampusSelectivity(a.school) - ucCampusSelectivity(b.school),
    );
    const pick =
      sorted.find((row) => {
        const key = schoolToCampusKey(row.school);
        if (!flagshipOk && (key === "berkeley" || key === "ucla")) return false;
        return true;
      }) ?? sorted[0]!;
    const idx = m.findIndex((x) => x.school === pick.school);
    if (idx >= 0) r.push(m.splice(idx, 1)[0]!);
  }
  if (s.length === 0 && m.length > 0) {
    const key = schoolToCampusKey(m[m.length - 1]!.school);
    if (key === "ucr" || key === "ucmerced") {
      s.push(m.pop()!);
    }
  }

  fixed = fixSelectivityTierInversions(r, m, s, locale, flagshipOk);
  r = fixed.reach;
  m = fixed.match;
  s = fixed.safety;

  r = r.map((row) => sanitizeRow(row, "reach", locale, weak));
  m = m.map((row) => sanitizeRow(row, "match", locale, weak));
  s = s.map((row) => sanitizeRow(row, "safety", locale, weak));

  r = dedupeRows(r).slice(0, 3);
  m = dedupeRows(m).slice(0, 3);
  s = dedupeRows(s).slice(0, 3);

  return { reach: r, match: m, safety: s, notes };
}

export function ucAnalysisNeedsFallback(uc: UcAnalysis, form: FormState): boolean {
  const blob = JSON.stringify(uc);
  if (containsUndergradFacultyErrors(blob)) return true;
  if (!isWeakUcProfile(form)) return false;
  const reachKeys = (uc.reach ?? []).map((r) => schoolToCampusKey(r.school)).filter(Boolean);
  if (reachKeys.includes("berkeley") && reachKeys.includes("ucla")) return true;
  return false;
}

export function sanitizeUcAnalysis(uc: UcAnalysis, form: FormState, locale: Locale): UcAnalysis {
  const weak = isWeakUcProfile(form);
  const { reach, match, safety, notes } = rebalanceTiers(
    [...(uc.reach ?? [])],
    [...(uc.match ?? [])],
    [...(uc.safety ?? [])],
    form,
    locale,
  );

  let overview = String(uc.overview || "").trim();
  if (weak && /均衡|偏稳|balanced|stable portfolio|名单.*稳/i.test(overview)) {
    overview =
      locale === "en"
        ? "For your current GPA/testing and thin activities, UC tiers below are tightened: flagship campuses are not default Reach, and mid-tier campuses are not labeled as true safeties."
        : "按你目前的成绩/标化与活动厚度，下方 UC 分档已收紧：顶校不会默认作冲刺，中档校区也不会被标成「保底」。";
  }
  if (notes.length) {
    overview += (overview ? " " : "") + notes.join(" ");
  }
  if (weak && !/test-blind|不看\s*SAT/i.test(overview)) {
    overview +=
      locale === "en"
        ? " UC is test-blind—do not plan around SAT for UC admission."
        : " UC 本科为 test-blind，勿把 SAT 当作冲 UC 的策略。";
  }

  return {
    ...uc,
    overview,
    reach,
    match,
    safety,
    test_blind_note: uc.test_blind_note,
    application_note: uc.application_note,
    checklist: uc.checklist,
    piq_directions: uc.piq_directions,
    information_gaps: filterUcTestBlindBullets(uc.information_gaps, locale),
  };
}
