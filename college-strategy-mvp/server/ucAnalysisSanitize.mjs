import {
  allowUcFlagshipReach,
  assessUcProfileSignals,
  isWeakUcProfile,
  schoolToCampusKey,
} from "./ucProfileStrength.mjs";
import { ucCampusSelectivity } from "./ucCampusSelectivity.mjs";
import {
  sanitizeSchoolRowUndergradCopy,
  sanitizeUndergradSchoolMentions,
  containsUndergradFacultyErrors,
} from "./undergradCopySanitize.mjs";
import { filterUcTestBlindBullets, sanitizeUcTestBlindCopy } from "./ucTestBlindCopySanitize.mjs";

const NOT_TRUE_SAFETY = new Set(["berkeley", "ucla", "ucsd", "ucsb", "uci", "ucdavis", "ucsc"]);

function tierIndex(tier) {
  if (tier === "reach") return 0;
  if (tier === "match") return 1;
  return 2;
}

function whyKeyForTier(tier) {
  if (tier === "reach") return "why_reach_for_you";
  if (tier === "match") return "why_match_for_you";
  return "why_safety_for_you";
}

function moveRowToTier(row, from, to) {
  if (from === to) return row;
  const why = String(row.why_reach_for_you || row.why_match_for_you || row.why_safety_for_you || "");
  const next = { ...row };
  delete next.why_reach_for_you;
  delete next.why_match_for_you;
  delete next.why_safety_for_you;
  next[whyKeyForTier(to)] = why;
  return next;
}

function alignTierLanguage(text, tier, locale) {
  let s = String(text || "");
  if (tier === "match") {
    s = s.replace(
      /冲刺层|冲刺档|reach\s*层|reach\s*tier|\bUC\s*reach\b|\bUC\s*冲刺\b/gi,
      locale === "en" ? "match tier" : "匹配档",
    );
  }
  return s.trim();
}

function stripPromptLeak(text) {
  return String(text || "")
    .replace(/偏好[^。]*?(campus_vibe\/differentiation|社区气质偏好)[^。]*[。]?/gi, "")
    .replace(/Prefers[^.]*?(campus_vibe\/differentiation|campus community preference)[^.]*\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fixUcTierOrder(reach, match, safety, locale, flagshipOk) {
  const notes = [];
  const entries = [
    ...reach.map((row) => ({ row, tier: "reach" })),
    ...match.map((row) => ({ row, tier: "match" })),
    ...safety.map((row) => ({ row, tier: "safety" })),
  ];

  let changed = true;
  let guard = 0;
  while (changed && guard < 12) {
    changed = false;
    guard += 1;
    for (let i = 0; i < entries.length; i++) {
      for (let j = 0; j < entries.length; j++) {
        if (i === j) continue;
        const harder = entries[i];
        const easier = entries[j];
        const selHard = ucCampusSelectivity(harder.row.school);
        const selEasy = ucCampusSelectivity(easier.row.school);
        if (selHard >= selEasy || selHard >= 90 || selEasy >= 90) continue;
        if (tierIndex(harder.tier) <= tierIndex(easier.tier)) continue;

        const hardKey = schoolToCampusKey(harder.row.school);
        const blockFlagshipReach = !flagshipOk && (hardKey === "berkeley" || hardKey === "ucla");

        if (blockFlagshipReach) {
          const down = harder.tier;
          easier.row = moveRowToTier(easier.row, easier.tier, down);
          easier.tier = down;
          notes.push(
            `已将 ${easier.row.school} 调整为${down === "match" ? "匹配" : "保底"}档：在顶校不作冲刺时，不应把更易录校区标在更高档。`,
          );
        } else {
          const up = easier.tier;
          harder.row = moveRowToTier(harder.row, harder.tier, up);
          harder.tier = up;
          notes.push(`已将 ${harder.row.school} 调整为${up === "reach" ? "冲刺" : up === "match" ? "匹配" : "保底"}档（录取难度高于 ${easier.row.school}）。`);
        }
        changed = true;
      }
    }
  }

  for (const tier of ["reach", "match", "safety"]) {
    const inTier = entries
      .filter((e) => e.tier === tier)
      .sort((a, b) => ucCampusSelectivity(a.row.school) - ucCampusSelectivity(b.row.school));
    if (inTier.length < 2) continue;
    const hardestSel = ucCampusSelectivity(inTier[0].row.school);
    for (let k = 1; k < inTier.length; k++) {
      const e = inTier[k];
      const sel = ucCampusSelectivity(e.row.school);
      if (sel - hardestSel < 2) continue;
      const down = tier === "reach" ? "match" : tier === "match" ? "safety" : null;
      if (!down) continue;
      e.row = moveRowToTier(e.row, e.tier, down);
      e.tier = down;
    }
  }

  const out = { reach: [], match: [], safety: [] };
  for (const e of entries) {
    out[e.tier].push(e.row);
  }
  return { ...out, notes };
}

function cleanCopy(text, school, weak, locale, tier) {
  let s = sanitizeUndergradSchoolMentions(String(text || ""), school, locale);
  s = sanitizeUcTestBlindCopy(s, locale);
  if (weak) {
    s = s.replace(/很有可能|突破|逆袭|仍有机会冲刺/gi, "仍属极低概率冲刺");
    s = s.replace(/匹配度较高/gi, "仍需大幅补强证据");
  }
  return alignTierLanguage(s, tier, locale);
}

function sanitizeRow(row, tier, weak, locale = "zh") {
  const base = sanitizeSchoolRowUndergradCopy(row, tier, locale);
  const whyKey = whyKeyForTier(tier);
  const school = String(row.school || "");
  return {
    ...base,
    [whyKey]: cleanCopy(base[whyKey], school, weak, locale, tier),
    key_risks: filterUcTestBlindBullets(
      (base.key_risks || []).map((r) => cleanCopy(r, school, weak, locale, tier)),
      locale,
    ),
    key_fit_signals: (base.key_fit_signals || []).map((r) => cleanCopy(r, school, weak, locale, tier)),
    verification_focus: filterUcTestBlindBullets(
      (base.verification_focus || []).map((r) => cleanCopy(r, school, weak, locale, tier)),
      locale,
    ),
    campus_vibe: cleanCopy(base.campus_vibe, school, weak, locale, tier),
    differentiation: cleanCopy(stripPromptLeak(base.differentiation), school, weak, locale, tier),
    context_note: cleanCopy(base.context_note, school, weak, locale, tier),
  };
}

function dedupe(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const k = String(r.school || "").toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sanitizeUcAnalysisFromBody(uc, body, locale = "zh") {
  const weak = isWeakUcProfile(body);
  const flagshipOk = allowUcFlagshipReach(body);
  let reach = [...(uc.reach || [])];
  let match = [...(uc.match || [])];
  let safety = [...(uc.safety || [])];
  const notes = [];

  const demote = (from, to, row) => {
    const i = from.findIndex((x) => x.school === row.school);
    if (i >= 0) from.splice(i, 1);
    if (!to.some((x) => x.school === row.school)) to.push(row);
  };

  if (weak) {
    for (const row of [...safety]) {
      const key = schoolToCampusKey(row.school);
      if (key && NOT_TRUE_SAFETY.has(key)) {
        demote(safety, match, row);
        notes.push(`${row.school} 不宜标为保底，已调整为匹配档。`);
      }
    }
  }

  let fixed = fixUcTierOrder(reach, match, safety, locale, flagshipOk);
  reach = fixed.reach;
  match = fixed.match;
  safety = fixed.safety;
  notes.push(...fixed.notes);

  if (!flagshipOk) {
    for (const row of [...reach]) {
      const key = schoolToCampusKey(row.school);
      if (key === "berkeley" || key === "ucla") {
        demote(reach, match, row);
        notes.push(`已将 ${row.school} 移出冲刺档（成绩/活动不支持顶校冲刺）。`);
      }
    }
    fixed = fixUcTierOrder(reach, match, safety, locale, flagshipOk);
    reach = fixed.reach;
    match = fixed.match;
    safety = fixed.safety;
    notes.push(...fixed.notes);
  }

  if (reach.length === 0 && match.length > 0) {
    const sorted = [...match].sort(
      (a, b) => ucCampusSelectivity(a.school) - ucCampusSelectivity(b.school),
    );
    const pick =
      sorted.find((row) => {
        const key = schoolToCampusKey(row.school);
        if (!flagshipOk && (key === "berkeley" || key === "ucla")) return false;
        return true;
      }) ?? sorted[0];
    const idx = match.findIndex((x) => x.school === pick.school);
    if (idx >= 0) reach.push(match.splice(idx, 1)[0]);
  }

  fixed = fixUcTierOrder(reach, match, safety, locale, flagshipOk);
  reach = fixed.reach;
  match = fixed.match;
  safety = fixed.safety;
  notes.push(...fixed.notes);

  reach = dedupe(reach.map((r) => sanitizeRow(r, "reach", weak, locale))).slice(0, 3);
  match = dedupe(match.map((r) => sanitizeRow(r, "match", weak, locale))).slice(0, 3);
  safety = dedupe(safety.map((r) => sanitizeRow(r, "safety", weak, locale))).slice(0, 3);

  let overview = String(uc.overview || "").trim();
  overview = sanitizeUndergradSchoolMentions(overview, "University of California, Los Angeles", locale);
  if (weak && /均衡|偏稳|balanced|stable/i.test(overview)) {
    overview =
      "按你目前的成绩/标化与活动厚度，下方 UC 分档已收紧：顶校不会默认作冲刺，中档校区也不会被标成「保底」。";
  }
  if (notes.length) overview += (overview ? " " : "") + notes.join(" ");

  return {
    ...uc,
    overview,
    reach,
    match,
    safety,
    information_gaps: filterUcTestBlindBullets(uc.information_gaps, locale),
  };
}

export function ucAnalysisNeedsFallbackFromBody(uc, body) {
  if (!isWeakUcProfile(body)) {
    const blob = JSON.stringify(uc);
    if (containsUndergradFacultyErrors(blob)) return true;
    return false;
  }
  const keys = (uc.reach || []).map((r) => schoolToCampusKey(r.school));
  if (keys.includes("berkeley") && keys.includes("ucla")) return true;
  const blob = JSON.stringify(uc);
  return containsUndergradFacultyErrors(blob);
}

export { containsUndergradFacultyErrors };
