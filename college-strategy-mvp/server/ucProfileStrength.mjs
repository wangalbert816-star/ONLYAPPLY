const CAMPUS_PATTERNS = [
  ["berkeley", /berkeley|伯克利/i],
  ["ucla", /\bucla\b|洛杉矶分校/i],
];

function parseGpaNumbers(gpaText) {
  const t = String(gpaText || "").trim();
  if (!t) return { unweighted: null, weighted: null };
  let unweighted = null;
  let weighted = null;
  const uw = t.match(/(?:unweighted|UW|未加权|非加权)[^\d]*(\d(?:\.\d{1,2})?)/i);
  const w = t.match(/(?:weighted|W|加权)[^\d]*(\d(?:\.\d{1,2})?)/i);
  if (uw) unweighted = Number(uw[1]);
  if (w) weighted = Number(w[1]);
  const all = [...t.matchAll(/\b([1-4]\.\d{1,2})\b/g)].map((m) => Number(m[1]));
  if (unweighted == null && all.length) unweighted = Math.min(...all);
  if (weighted == null && all.length > 1) weighted = Math.max(...all);
  if (weighted == null && all.length === 1) weighted = all[0];
  return { unweighted, weighted };
}

function parseSatFromBody(body) {
  const d = String(body?.satScore || "").replace(/\D/g, "");
  if (d.length < 3) return null;
  const n = Number(d.slice(0, 4));
  return n >= 400 && n <= 1600 ? n : null;
}

export function isActivityThin(activities) {
  const t = String(activities || "").trim();
  if (t.length < 60) return true;
  if (/暂无|没有|无活动|empty|none|n\/a|几乎|很少|偏少|几乎为空/i.test(t)) return true;
  return t.split(/\n|；|;|•|·/).filter((x) => x.trim().length > 12).length < 2;
}

export function assessUcProfileSignals(body) {
  const { unweighted, weighted } = parseGpaNumbers(body?.gpa);
  const sat = parseSatFromBody(body);
  const activityThin = isActivityThin(body?.activities);
  let band = "mid";
  const uw = unweighted ?? weighted;
  const w = weighted ?? unweighted;
  if ((uw != null && uw <= 3.25) || (w != null && w <= 3.45) || (sat != null && sat <= 1280)) band = "weak";
  else if ((uw != null && uw >= 3.75) || (w != null && w >= 4.0) || (sat != null && sat >= 1420)) band = "strong";
  if (activityThin && band === "strong") band = "mid";
  if (activityThin && band === "mid") band = "weak";
  return { band, activityThin, unweightedGpa: unweighted, weightedGpa: weighted, sat };
}

export function allowUcFlagshipReach(body, signals = assessUcProfileSignals(body)) {
  if (signals.band === "weak" || signals.activityThin) return false;
  if (signals.band === "strong" && !signals.activityThin) return true;
  if (body?.riskStyle === "aggressive" && signals.band === "mid" && !signals.activityThin) {
    const satOk = signals.sat == null || signals.sat >= 1350;
    const gpaOk =
      (signals.unweightedGpa != null && signals.unweightedGpa >= 3.5) ||
      (signals.weightedGpa != null && signals.weightedGpa >= 3.7);
    return satOk && gpaOk;
  }
  return false;
}

export function isWeakUcProfile(body, signals = assessUcProfileSignals(body)) {
  return signals.band === "weak" || signals.activityThin;
}

export function schoolToCampusKey(school) {
  const s = String(school || "");
  for (const [key, re] of CAMPUS_PATTERNS) {
    if (re.test(s)) return key;
  }
  if (/uc\s*san\s*diego|ucsd/i.test(s)) return "ucsd";
  if (/uc\s*santa\s*barbara|ucsb/i.test(s)) return "ucsb";
  if (/uc\s*irvine|uci/i.test(s)) return "uci";
  if (/uc\s*davis/i.test(s)) return "ucdavis";
  if (/uc\s*santa\s*cruz|ucsc/i.test(s)) return "ucsc";
  if (/uc\s*riverside|ucr/i.test(s)) return "ucr";
  if (/uc\s*merced/i.test(s)) return "ucmerced";
  return null;
}
