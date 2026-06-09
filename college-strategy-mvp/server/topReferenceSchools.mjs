import { coerceStringArray } from "./coerceStringArray.mjs";
import { isActivityThinFromBody, structuredActivityBlob } from "./activityEvidence.mjs";

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

export function forbiddenSchoolsFromBody(body) {
  const raw = body?.forbiddenSchools ?? body?.forbidden_schools;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
}

export function schoolMatchesForbidden(name, forbiddenList) {
  const normalized = normalizeSchoolName(name);
  if (!normalized || !Array.isArray(forbiddenList) || forbiddenList.length === 0) return false;
  return forbiddenList.some((entry) => {
    const needle = normalizeSchoolName(entry);
    if (!needle) return false;
    if (
      isPennStateUniversityName(normalized) &&
      (needle === "penn" || needle === "upenn" || needle === "university of pennsylvania")
    ) {
      return false;
    }
    if (normalized === needle) return true;
    if (needle.length >= 4 && normalized.includes(needle)) return true;
    if (normalized.length >= 4 && needle.includes(normalized)) return true;
    return false;
  });
}

function findForbiddenInMainTiers(o, forbiddenList) {
  const hits = [];
  for (const tier of ["reach", "match", "safety"]) {
    const rows = o[tier];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const name = String(row?.school || "").trim();
      if (name && schoolMatchesForbidden(name, forbiddenList)) hits.push(name);
    }
  }
  return [...new Set(hits)];
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Penn State / Pennsylvania State ≠ University of Pennsylvania (UPenn). */
function isPennStateUniversityName(normalized) {
  if (!normalized) return false;
  return /^penn state\b/.test(normalized) || /^pennsylvania state\b/.test(normalized);
}

export function isUltraSelectiveSchoolName(name) {
  const normalized = normalizeSchoolName(name);
  if (!normalized) return false;
  if (isPennStateUniversityName(normalized)) return false;
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

/** 是否允许输出 top_reference_schools（强背景或罕见证据） */
export function allowsTopReferenceSchools(body) {
  const { unweighted, weighted } = parseGpaNumbers(body?.gpa);
  const uw = unweighted ?? weighted;
  const w = weighted ?? unweighted;
  const thin = isActivityThinFromBody(body);
  const weakGpa = (uw != null && uw <= 3.35) || (w != null && w <= 3.55);
  const strongGpa = (uw != null && uw >= 3.75) || (w != null && w >= 4.0);
  const blob = [
    body?.gpa,
    structuredActivityBlob(body),
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

const TOP_REF_STRIPPED_NOTE_ZH =
  "顶级彩票校（如 MIT/Stanford/Harvard 等）在本方案中仅作方向参考，未列入主名单 reach/match/safety；请以可执行的冲稳保三档为主。";
const TOP_REF_STRIPPED_NOTE_EN =
  "Ultra-selective schools (e.g. MIT, Stanford, Harvard) are reference-only for this profile and are not listed in the main reach/match/safety tiers.";

function appendStrategyNote(o, note) {
  const existing = String(o.strategy_notes || "").trim();
  const fingerprint = note.slice(0, Math.min(24, note.length));
  if (fingerprint && existing.includes(fingerprint)) return;
  o.strategy_notes = existing ? `${existing}\n\n${note}` : note;
}

/**
 * 模型误填 top_reference_schools 时服务端自动修正并写入 strategy_notes，避免整份报告 502。
 */
export function autoRepairTopReferenceSchools(parsed, body, locale = "zh") {
  if (!parsed || typeof parsed !== "object") return parsed;
  const o = /** @type {Record<string, unknown>} */ (parsed);
  const raw = o.top_reference_schools;
  if (!Array.isArray(raw) || raw.length === 0) return parsed;

  if (!allowsTopReferenceSchools(body)) {
    o.top_reference_schools = [];
    appendStrategyNote(o, locale === "en" ? TOP_REF_STRIPPED_NOTE_EN : TOP_REF_STRIPPED_NOTE_ZH);
    return parsed;
  }

  const mainKeys = new Set(schoolNamesFromMainTiers(o).map((n) => n.toLowerCase()));
  const kept = [];
  const removed = [];
  const seen = new Set();

  for (const row of raw) {
    if (!row || typeof row !== "object") {
      removed.push("(invalid row)");
      continue;
    }
    const name = String(row.school || "").trim();
    if (!name) {
      removed.push("(empty school)");
      continue;
    }
    if (schoolMatchesForbidden(name, forbiddenSchoolsFromBody(body))) {
      removed.push(name);
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      removed.push(name);
      continue;
    }
    if (mainKeys.has(key)) {
      removed.push(name);
      continue;
    }
    if (!isUltraSelectiveSchoolName(name)) {
      removed.push(name);
      continue;
    }
    seen.add(key);
    kept.push(row);
  }

  const trimmed = kept.length > 2;
  o.top_reference_schools = kept.slice(0, 2);

  if (trimmed) {
    removed.push("(more than 2 ultra-selective references)");
  }

  if (removed.length === 0 && !trimmed) return parsed;

  const uniqueRemoved = [...new Set(removed.filter((n) => n !== "(more than 2 ultra-selective references)"))];
  if (uniqueRemoved.length > 0 || trimmed) {
    const names = uniqueRemoved.join(locale === "en" ? ", " : "、");
    const note =
      locale === "en"
        ? `Removed from top_reference_schools (not ultra-selective reference tier, duplicated main list, or over limit): ${names || "extra entries"}. Place those schools in reach/match/safety or UC analysis as appropriate.`
        : `已从 top_reference_schools 移除（非顶级参考校、与主名单重复或超过 2 所）：${names || "多余条目"}。请在 reach/match/safety 或 UC 分析中体现这些学校。`;
    appendStrategyNote(o, note);
  }

  return parsed;
}

/** 主名单 + 顶校参考块校验 */
export function validateMainSchoolReport(parsed, body) {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, repairable: false, reason: "根对象无效" };
  }
  const o = /** @type {Record<string, unknown>} */ (parsed);

  const nine = validateMainNineSchools(o);
  if (!nine.ok) return nine;

  const topRef = validateTopReferenceBlock(o, body);
  if (!topRef.ok) return topRef;

  const forbidden = forbiddenSchoolsFromBody(body);
  const forbiddenInMain = findForbiddenInMainTiers(o, forbidden);
  if (forbiddenInMain.length > 0) {
    const isEn = body?.locale === "en";
    return {
      ok: false,
      repairable: true,
      reason: isEn
        ? `Main list must not include forbidden schools: ${forbiddenInMain.join(", ")}. Replace each with a different U.S. bachelor's institution not on the forbidden list.`
        : `主名单不得含用户禁止的学校：${forbiddenInMain.join("、")}。请各替换为一所不在禁校名单内的美国本科院校。`,
    };
  }

  return { ok: true };
}

export function buildValidationRepairMessage(reason, locale = "zh") {
  if (locale === "en") {
    return `[Validation failed] ${reason}

Return ONLY one corrected JSON object. Rules:
- reach, match, safety: exactly 3 distinct U.S. bachelor's schools each (9 total).
- Ultra-selective schools (MIT/Stanford/Harvard/UPenn/etc.) may appear in reach when the profile supports a defensible stretch case; do not duplicate the same school in top_reference_schools.
- top_reference_schools is optional (0–2 items) for extra reference-only schools not already in the main 9.
- If validation mentions forbidden schools, remove them everywhere and replace with different institutions not on the forbidden list.
- Each top_reference_schools row uses why_reference_for_you (not why_reach_for_you).`;
  }
  return `【校验未通过】${reason}

请只输出一份修正后的完整 JSON。规则：
- reach、match、safety 各恰好 3 所、9 校互不重复；
- 顶级彩票校（MIT/Stanford/Harvard/UPenn 等）可在 reach 中出现（背景有充分理由时）；不得与 top_reference_schools 重复；
- top_reference_schools 为可选补充（0–2 所），用于主名单未覆盖的额外顶校参考；
- 若校验提示禁校名单，须从全报告移除并在主名单替换为禁校名单外的其它美国本科院校；
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
