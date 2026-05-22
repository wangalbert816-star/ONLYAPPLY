import type { FormState, SchoolRow, SchoolTier, UcAnalysis } from "../types";
import type { Locale } from "../i18n/strings";
import type { UcCampusKey } from "./ucCampusPortfolio";
import {
  allowUcFlagshipReach,
  assessUcProfileSignals,
  isWeakUcProfile,
} from "./ucProfileStrength";

const CAMPUS_PATTERNS: Array<{ key: UcCampusKey; re: RegExp }> = [
  { key: "berkeley", re: /berkeley|伯克利/i },
  { key: "ucla", re: /\bucla\b|洛杉矶分校/i },
  { key: "ucsd", re: /uc\s*san\s*diego|ucsd|圣地亚哥/i },
  { key: "ucsb", re: /uc\s*santa\s*barbara|ucsb|圣巴巴拉/i },
  { key: "uci", re: /uc\s*irvine|uci|尔湾/i },
  { key: "ucdavis", re: /uc\s*davis|戴维斯/i },
  { key: "ucsc", re: /uc\s*santa\s*cruz|ucsc|圣克鲁斯/i },
  { key: "ucr", re: /uc\s*riverside|ucr|河滨/i },
  { key: "ucmerced", re: /uc\s*merced|默塞德/i },
];

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
  for (const { key, re } of CAMPUS_PATTERNS) {
    if (re.test(school)) return key;
  }
  return null;
}

function cleanCampusCopy(text: string, locale: Locale, weak: boolean): string {
  let s = text;
  s = s.replace(/UCLA\s+Anderson(\s+School)?/gi, locale === "en" ? "UCLA undergraduate majors" : "UCLA 本科相关专业");
  s = s.replace(/Anderson\s+School/gi, locale === "en" ? "undergraduate programs" : "本科项目");
  s = s.replace(/Haas\s+School\s+of\s+Business/gi, locale === "en" ? "Berkeley business-related majors" : "Berkeley 商科相关本科方向");
  s = s.replace(/商学院(?:研究生院)?/g, locale === "en" ? "undergraduate path" : "本科路径");
  if (weak) {
    s = s.replace(
      /很有可能|突破|逆袭|仍有机会冲刺|award.*breakthrough/gi,
      locale === "en" ? "still a very low-probability stretch" : "仍属极低概率冲刺",
    );
    s = s.replace(/匹配度较高|strong fit/gi, locale === "en" ? "needs much stronger evidence" : "仍需大幅补强证据");
  }
  return s.trim();
}

function sanitizeRow(row: SchoolRow, tier: SchoolTier, locale: Locale, weak: boolean): SchoolRow {
  const whyKey =
    tier === "reach" ? "why_reach_for_you" : tier === "match" ? "why_match_for_you" : "why_safety_for_you";
  const why = cleanCampusCopy(String(row[whyKey] || ""), locale, weak);
  return {
    ...row,
    [whyKey]: why,
    key_risks: (row.key_risks ?? []).map((r) => cleanCampusCopy(r, locale, weak)),
    key_fit_signals: row.key_fit_signals ?? [],
    verification_focus: row.verification_focus ?? [],
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

  let r = reach.map((row) => sanitizeRow(row, "reach", locale, weak));
  let m = match.map((row) => sanitizeRow(row, "match", locale, weak));
  let s = safety.map((row) => sanitizeRow(row, "safety", locale, weak));

  const demote = (from: SchoolRow[], to: SchoolRow[], row: SchoolRow) => {
    const i = from.findIndex((x) => x.school === row.school);
    if (i >= 0) from.splice(i, 1);
    if (!to.some((x) => x.school === row.school)) to.push(row);
  };

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
  }

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

  if (r.length === 0 && m.length > 0) {
    r.push(m.shift()!);
  }
  if (s.length === 0 && m.length > 0) {
    const key = schoolToCampusKey(m[m.length - 1]!.school);
    if (key === "ucr" || key === "ucmerced") {
      s.push(m.pop()!);
    }
  }

  r = dedupeRows(r).slice(0, 3);
  m = dedupeRows(m).slice(0, 3);
  s = dedupeRows(s).slice(0, 3);

  return { reach: r, match: m, safety: s, notes };
}

export function ucAnalysisNeedsFallback(uc: UcAnalysis, form: FormState): boolean {
  if (!isWeakUcProfile(form)) return false;
  const reachKeys = (uc.reach ?? []).map((r) => schoolToCampusKey(r.school)).filter(Boolean);
  if (reachKeys.includes("berkeley") && reachKeys.includes("ucla")) return true;
  const blob = (uc.reach ?? [])
    .map((r) => `${r.school} ${r.why_reach_for_you}`)
    .join(" ");
  if (/Anderson|Haas.*商学院|突破.*Berkeley|Berkeley.*突破/i.test(blob)) return true;
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
    information_gaps: uc.information_gaps,
  };
}
