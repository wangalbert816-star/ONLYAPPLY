import { coerceStringArray } from "./coerceStringArray.mjs";

const ULTRA_SELECTIVE_SCHOOLS = [
  "mit",
  "massachusetts institute of technology",
  "stanford",
  "stanford university",
  "harvard",
  "harvard university",
  "princeton",
  "princeton university",
  "yale",
  "yale university",
  "caltech",
  "california institute of technology",
  "columbia",
  "columbia university",
  "university of pennsylvania",
  "upenn",
  "penn",
  "duke",
  "duke university",
  "brown",
  "brown university",
  "dartmouth",
  "dartmouth college",
  "cornell",
  "cornell university",
  "university of chicago",
  "uchicago",
];

const STRONG_EVIDENCE_RE =
  /national|international|国际|全国|IMO|IOI|ISEF|olympiad|奥赛|国家队|gold medal|金牌|regeneron|sts finalist|intel finalist/i;

function normalizeSchoolName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isUltraSelectiveSchoolName(name) {
  const normalized = normalizeSchoolName(name);
  if (!normalized) return false;
  return ULTRA_SELECTIVE_SCHOOLS.some((pattern) => {
    const p = normalizeSchoolName(pattern);
    if (normalized === p) return true;
    if (p.includes(" ")) return normalized.includes(p);
    return new RegExp(`\\b${escapeRegExp(p)}\\b`).test(normalized);
  });
}

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

function isActivityThin(activities) {
  const t = String(activities || "").trim();
  if (t.length < 60) return true;
  if (/暂无|没有|无活动|empty|none|n\/a|几乎|很少|偏少|几乎为空/i.test(t)) return true;
  return t.split(/\n|；|;|•|·/).filter((x) => x.trim().length > 12).length < 2;
}

/** 是否允许输出 top_reference_schools（强背景或罕见证据） */
export function allowsTopReferenceSchools(body) {
  const { unweighted, weighted } = parseGpaNumbers(body?.gpa);
  const uw = unweighted ?? weighted;
  const w = weighted ?? unweighted;
  const thin = isActivityThin(body?.activities);
  const weakGpa = (uw != null && uw <= 3.35) || (w != null && w <= 3.55);
  const strongGpa = (uw != null && uw >= 3.75) || (w != null && w >= 4.0);
  const blob = [
    body?.gpa,
    body?.activities,
    body?.majorPrimary,
    body?.majorSecondary,
    body?.dealbreakers,
    JSON.stringify(body?.supplementaryNotes || []),
  ].join("\n");
  if (STRONG_EVIDENCE_RE.test(blob)) return true;
  if (strongGpa && !thin) return true;
  if (!weakGpa && !thin) return true;
  return false;
}

function schoolNamesFromMainTiers(o) {
  const names = [];
  for (const tier of ["reach", "match", "safety"]) {
    const rows = o[tier];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const name = String(row?.school || "").trim();
      if (name) names.push(name);
    }
  }
  return names;
}

function validateMainNineSchools(o) {
  const tiers = ["reach", "match", "safety"];
  const seen = new Set();
  for (const t of tiers) {
    const rows = o[t];
    if (!Array.isArray(rows) || rows.length !== 3) {
      return {
        ok: false,
        repairable: true,
        reason: `${t} 须恰好 3 所学校，实际为 ${Array.isArray(rows) ? rows.length : "非数组"}`,
      };
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== "object") {
        return { ok: false, repairable: true, reason: `${t}[${i}] 条目无效` };
      }
      const name = String(row.school || "").trim();
      if (!name) {
        return { ok: false, repairable: true, reason: `${t} 中存在空 school` };
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        return { ok: false, repairable: true, reason: `重复校名：${name}` };
      }
      seen.add(key);
    }
  }
  return { ok: true, seen };
}

function findUltraInMainTiers(o) {
  const found = [];
  for (const tier of ["reach", "match", "safety"]) {
    for (const row of o[tier] || []) {
      const name = String(row?.school || "").trim();
      if (name && isUltraSelectiveSchoolName(name)) found.push(name);
    }
  }
  return found;
}

function validateTopReferenceBlock(o, body) {
  const raw = o.top_reference_schools;
  if (raw == null) return { ok: true };
  if (!Array.isArray(raw)) {
    return { ok: false, repairable: true, reason: "top_reference_schools 必须是数组" };
  }
  if (raw.length > 2) {
    return { ok: false, repairable: true, reason: `top_reference_schools 最多 2 所，实际 ${raw.length}` };
  }
  if (raw.length === 0) return { ok: true };

  if (!allowsTopReferenceSchools(body)) {
    return {
      ok: false,
      repairable: true,
      reason: "当前背景不宜使用 top_reference_schools，请留空并在 strategy_notes 中说明顶校仅为参考",
    };
  }

  const mainKeys = new Set(schoolNamesFromMainTiers(o).map((n) => n.toLowerCase()));
  const topSeen = new Set();
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") {
      return { ok: false, repairable: true, reason: `top_reference_schools[${i}] 无效` };
    }
    const name = String(row.school || "").trim();
    if (!name) {
      return { ok: false, repairable: true, reason: "top_reference_schools 中存在空 school" };
    }
    if (!isUltraSelectiveSchoolName(name)) {
      return {
        ok: false,
        repairable: true,
        reason: `${name} 不属于顶级参考校，请放入 reach/match/safety 主名单`,
      };
    }
    const key = name.toLowerCase();
    if (topSeen.has(key)) {
      return { ok: false, repairable: true, reason: `top_reference_schools 重复校名：${name}` };
    }
    topSeen.add(key);
    if (mainKeys.has(key)) {
      return { ok: false, repairable: true, reason: `${name} 不得同时出现在主名单 9 校与 top_reference_schools` };
    }
  }
  return { ok: true };
}

/** 主名单 + 顶校参考块校验 */
export function validateMainSchoolReport(parsed, body) {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, repairable: false, reason: "根对象无效" };
  }
  const o = /** @type {Record<string, unknown>} */ (parsed);

  const nine = validateMainNineSchools(o);
  if (!nine.ok) return nine;

  const ultraInMain = findUltraInMainTiers(o);
  if (ultraInMain.length > 0) {
    return {
      ok: false,
      repairable: true,
      reason: `主名单 9 校不得含顶级彩票校：${ultraInMain.join("、")}。请移入 top_reference_schools（0–2 所）并在 reach 保留 3 所现实可冲学校。`,
    };
  }

  const topRef = validateTopReferenceBlock(o, body);
  if (!topRef.ok) return topRef;

  return { ok: true };
}

export function buildValidationRepairMessage(reason, locale = "zh") {
  if (locale === "en") {
    return `[Validation failed] ${reason}

Return ONLY one corrected JSON object. Rules:
- reach, match, safety: exactly 3 distinct U.S. bachelor's schools each (9 total).
- MIT/Stanford/Harvard/Princeton/Yale/Caltech/Columbia/UPenn/Duke/Brown/Dartmouth/Cornell/UChicago must NOT appear in reach/match/safety.
- Put those ultra-selective schools in top_reference_schools (0–2 items) only when the profile supports it; never duplicate a main-list school.
- Each top_reference_schools row uses why_reference_for_you (not why_reach_for_you).`;
  }
  return `【校验未通过】${reason}

请只输出一份修正后的完整 JSON。规则：
- reach、match、safety 各恰好 3 所、9 校互不重复；
- MIT/Stanford/Harvard/Princeton/Yale/Caltech/Columbia/UPenn/Duke/Brown/Dartmouth/Cornell/UChicago 不得出现在主名单三档；
- 上述顶校如需提及，仅可放入 top_reference_schools（0–2 所），且不得与主名单重复；
- top_reference_schools 每行使用 why_reference_for_you 字段。`;
}

export function normalizeTopReferenceSchoolRows(raw, locale = "zh") {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const row = /** @type {Record<string, unknown>} */ (r);
      const school = String(row.school || "").trim();
      if (!school) return null;
      return {
        school,
        why_reference_for_you: String(row.why_reference_for_you || row.why_reach_for_you || "").trim(),
        campus_vibe: String(row.campus_vibe || "").trim(),
        context_note: String(row.context_note || "").trim(),
        key_fit_signals: coerceStringArray(row.key_fit_signals),
        key_risks: coerceStringArray(row.key_risks),
        verification_focus: coerceStringArray(row.verification_focus),
      };
    })
    .filter(Boolean)
    .slice(0, 2);
}
