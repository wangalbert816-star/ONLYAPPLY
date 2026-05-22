import {
  allowUcFlagshipReach,
  assessUcProfileSignals,
  isWeakUcProfile,
  schoolToCampusKey,
} from "./ucProfileStrength.mjs";

const NOT_TRUE_SAFETY = new Set(["berkeley", "ucla", "ucsd", "ucsb", "uci", "ucdavis", "ucsc"]);

function cleanCopy(text, weak) {
  let s = String(text || "");
  s = s.replace(/UCLA\s+Anderson(\s+School)?/gi, "UCLA 本科相关专业");
  s = s.replace(/Anderson\s+School/gi, "本科项目");
  s = s.replace(/Haas\s+School\s+of\s+Business/gi, "Berkeley 商科相关本科方向");
  if (weak) {
    s = s.replace(/很有可能|突破|逆袭|仍有机会冲刺/gi, "仍属极低概率冲刺");
    s = s.replace(/匹配度较高/gi, "仍需大幅补强证据");
  }
  return s.trim();
}

function sanitizeRow(row, tier, weak) {
  const whyKey =
    tier === "reach" ? "why_reach_for_you" : tier === "match" ? "why_match_for_you" : "why_safety_for_you";
  return {
    ...row,
    [whyKey]: cleanCopy(row[whyKey], weak),
    key_risks: (row.key_risks || []).map((r) => cleanCopy(r, weak)),
    key_fit_signals: row.key_fit_signals || [],
    verification_focus: row.verification_focus || [],
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

export function sanitizeUcAnalysisFromBody(uc, body) {
  const weak = isWeakUcProfile(body);
  const flagshipOk = allowUcFlagshipReach(body);
  let reach = (uc.reach || []).map((r) => sanitizeRow(r, "reach", weak));
  let match = (uc.match || []).map((r) => sanitizeRow(r, "match", weak));
  let safety = (uc.safety || []).map((r) => sanitizeRow(r, "safety", weak));
  const notes = [];

  const demote = (from, to, row) => {
    const i = from.findIndex((x) => x.school === row.school);
    if (i >= 0) from.splice(i, 1);
    if (!to.some((x) => x.school === row.school)) to.push(row);
  };

  if (!flagshipOk) {
    for (const row of [...reach]) {
      const key = schoolToCampusKey(row.school);
      if (key === "berkeley" || key === "ucla") {
        demote(reach, match, row);
        notes.push(`已将 ${row.school} 移出冲刺档（成绩/活动不支持顶校冲刺）。`);
      }
    }
  }

  if (weak) {
    for (const row of [...safety]) {
      const key = schoolToCampusKey(row.school);
      if (key && NOT_TRUE_SAFETY.has(key)) {
        demote(safety, match, row);
        notes.push(`${row.school} 不宜标为保底，已调整为匹配档。`);
      }
    }
  }

  if (reach.length === 0 && match.length > 0) reach.push(match.shift());
  reach = dedupe(reach).slice(0, 3);
  match = dedupe(match).slice(0, 3);
  safety = dedupe(safety).slice(0, 3);

  let overview = String(uc.overview || "").trim();
  if (weak && /均衡|偏稳|balanced|stable/i.test(overview)) {
    overview =
      "按你目前的成绩/标化与活动厚度，下方 UC 分档已收紧：顶校不会默认作冲刺，中档校区也不会被标成「保底」。";
  }
  if (notes.length) overview += (overview ? " " : "") + notes.join(" ");

  return { ...uc, overview, reach, match, safety };
}

export function ucAnalysisNeedsFallbackFromBody(uc, body) {
  if (!isWeakUcProfile(body)) return false;
  const keys = (uc.reach || []).map((r) => schoolToCampusKey(r.school));
  if (keys.includes("berkeley") && keys.includes("ucla")) return true;
  const blob = (uc.reach || []).map((r) => `${r.school} ${r.why_reach_for_you}`).join(" ");
  return /Anderson|Haas.*商学院|突破.*Berkeley/i.test(blob);
}
