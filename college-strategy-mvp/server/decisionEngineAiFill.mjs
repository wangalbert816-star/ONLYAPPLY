/**
 * When catalog + rules cannot fill 9 schools under user preferences, LLM suggests gap schools.
 */

import { normalizeApprovedSchools } from "./engineStandards.mjs";
import { intakeProfileSummaryForPrompt, isUcSchoolName } from "./engineIntakeProfile.mjs";
import { forbiddenSchoolsFromBody, schoolMatchesForbidden } from "./topReferenceSchools.mjs";
import { normalizeSchoolKey } from "./engineTierRules.mjs";
import { resolveGpaTextForAnalysis } from "./transcriptSheetReport.mjs";

function tierSchoolNames(tierRows) {
  return (tierRows ?? []).map((r) => String(r.school ?? "").trim()).filter(Boolean);
}

function collectUsedKeys(schools) {
  const keys = new Set();
  for (const tier of ["reach", "match", "safety"]) {
    for (const name of tierSchoolNames(schools[tier])) {
      keys.add(normalizeSchoolKey(name));
    }
  }
  return keys;
}

function buildAiFillPrompt(body, intake, partialSchools, gaps, locale) {
  const prefBlock = intakeProfileSummaryForPrompt(intake, locale);
  const existing = {
    reach: tierSchoolNames(partialSchools.reach),
    match: tierSchoolNames(partialSchools.match),
    safety: tierSchoolNames(partialSchools.safety),
  };

  const gapDesc =
    locale === "en"
      ? `Reach need ${gaps.reach} more, Match need ${gaps.match} more, Safety need ${gaps.safety} more.`
      : `冲还需 ${gaps.reach} 所，稳还需 ${gaps.match} 所，保还需 ${gaps.safety} 所。`;

  const major = [body?.majorPrimary, body?.majorSecondary].filter(Boolean).join(" / ") || "undecided";
  const gpa = resolveGpaTextForAnalysis(body) || "not provided";
  const testing = String(body?.testing ?? "").trim() || "unknown";

  if (locale === "en") {
    return `You are an OnlyApply counselor engine assistant. Suggest ONLY additional U.S. bachelor's-granting institutions to complete a 9-school list.

${prefBlock}

Student major: ${major}. GPA notes: ${gpa}. Testing: ${testing}.

Already selected (do NOT repeat):
- Reach: ${existing.reach.join(", ") || "none"}
- Match: ${existing.match.join(", ") || "none"}
- Safety: ${existing.safety.join(", ") || "none"}

${gapDesc}

Rules:
- Respect geography as HARD when listed — new schools must be in allowed region(s) unless geography was "any".
- Respect budget: if budget cap / need aid, prefer public or value-friendly options; avoid expensive private unless already consistent with list.
- Respect dealbreakers and forbidden schools absolutely.
- If UC interest is NO: do NOT suggest any University of California campus in reach/match/safety (UC belongs in uc_analysis only when user has UC intent).
- Reach = realistic stretch; Match = plausible fit; Safety = realistic admit floor for this profile.
- Use official English school names only.

Return JSON only:
{
  "reach": [{"school": "Name", "note": "short fit reason"}],
  "match": [...],
  "safety": [...]
}
Include ONLY the missing slots (${gaps.reach} reach, ${gaps.match} match, ${gaps.safety} safety).`;
  }

  return `你是 OnlyApply 选校引擎助手。只需补充「还缺的美国本科院校」，完成 9 校名单。

${prefBlock}

专业：${major}。GPA：${gpa}。标化策略：${testing}。

已选定（不得重复）：
- 冲：${existing.reach.join("、") || "无"}
- 稳：${existing.match.join("、") || "无"}
- 保：${existing.safety.join("、") || "无"}

${gapDesc}

规则：
- 若地理为硬约束，新增学校必须在允许地区内。
- 预算紧/需奖助：优先公立或性价比校，避免明显超预算私立。
- 底线与禁止学校绝对不可违反。
- 若无 UC 意向：reach/match/safety 不得推荐任何 UC 校区（有 UC 意向时 UC 只出现在 uc_analysis，不进主名单）。
- 冲=现实可冲；稳=匹配；保=真实保底。

仅返回 JSON：
{
  "reach": [{"school": "校名", "note": "简短匹配理由"}],
  "match": [...],
  "safety": [...]
}
只填缺口（冲 ${gaps.reach} / 稳 ${gaps.match} / 保 ${gaps.safety} 所）。`;
}

function parseAiFillResponse(parsed, gaps) {
  const out = { reach: [], match: [], safety: [] };
  if (!parsed || typeof parsed !== "object") return out;
  for (const tier of ["reach", "match", "safety"]) {
    const rows = parsed[tier];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (out[tier].length >= gaps[tier]) break;
      const school = String(row?.school ?? row ?? "").trim();
      if (!school) continue;
      const note = String(row?.note ?? "").trim();
      out[tier].push(note ? { school, note } : { school });
    }
  }
  return out;
}

function mergePartialWithFill(partial, fill, gaps) {
  const merged = normalizeApprovedSchools({
    reach: [...(partial.reach ?? [])],
    match: [...(partial.match ?? [])],
    safety: [...(partial.safety ?? [])],
    notes: partial.notes ?? null,
  });

  for (const tier of ["reach", "match", "safety"]) {
    const need = gaps[tier];
    if (need <= 0) continue;
    const add = (fill[tier] ?? []).slice(0, need);
    merged[tier] = [...merged[tier], ...add].slice(0, 3);
  }
  return merged;
}

function sanitizeFillRows(fill, body, usedKeys, forbidden, intake) {
  const clean = { reach: [], match: [], safety: [] };
  for (const tier of ["reach", "match", "safety"]) {
    for (const row of fill[tier] ?? []) {
      const school = String(row.school ?? "").trim();
      if (!school) continue;
      if (!intake?.ucIntent && isUcSchoolName(school)) continue;
      const key = normalizeSchoolKey(school);
      if (!key || usedKeys.has(key)) continue;
      if (schoolMatchesForbidden(school, forbidden)) continue;
      if (/^(mit|stanford|harvard|yale|princeton|caltech)$/i.test(school.replace(/\s+/g, " "))) {
        // allow only if not forbidden — ultra names ok if counselor-level profile
      }
      usedKeys.add(key);
      clean[tier].push(row.note ? { school, note: row.note } : { school });
    }
  }
  return clean;
}

/**
 * @param {object} params
 * @param {Record<string, unknown>} params.body
 * @param {object} params.intake full questionnaire profile from buildEngineIntakeProfile
 * @param {object} params.partialSchools normalized tiers (may be incomplete)
 * @param {{ reach: number, match: number, safety: number }} params.gaps
 * @param {string} params.locale
 * @param {(messages: object[]) => Promise<{ parsed: object }>} params.generateJson
 */
export async function fillDecisionGapsWithAi({ body, intake, partialSchools, gaps, locale, generateJson }) {
  const totalGap = gaps.reach + gaps.match + gaps.safety;
  if (totalGap <= 0) {
    return { ok: true, schools: partialSchools, aiFilled: 0 };
  }

  const forbidden = intake?.forbidden?.length ? intake.forbidden : forbiddenSchoolsFromBody(body);
  const usedKeys = collectUsedKeys(partialSchools);
  const userContent = buildAiFillPrompt(body, intake, partialSchools, gaps, locale);

  const messages = [
    {
      role: "system",
      content:
        locale === "en"
          ? "Return valid JSON only. U.S. bachelor's institutions only."
          : "仅返回合法 JSON。仅限美国本科院校。",
    },
    { role: "user", content: userContent },
  ];

  const { parsed } = await generateJson(messages);
  let fill = parseAiFillResponse(parsed, gaps);
  fill = sanitizeFillRows(fill, body, usedKeys, forbidden, intake);

  const merged = mergePartialWithFill(partialSchools, fill, gaps);
  const complete =
    merged.reach.length >= 3 && merged.match.length >= 3 && merged.safety.length >= 3;

  const aiFilled =
    (fill.reach?.length ?? 0) + (fill.match?.length ?? 0) + (fill.safety?.length ?? 0);

  return {
    ok: complete,
    schools: merged,
    aiFilled,
    reason: complete ? null : "ai_fill_incomplete",
  };
}

export function computeTierGaps(reachRows, matchRows, safetyRows) {
  return {
    reach: Math.max(0, 3 - reachRows.length),
    match: Math.max(0, 3 - matchRows.length),
    safety: Math.max(0, 3 - safetyRows.length),
  };
}
