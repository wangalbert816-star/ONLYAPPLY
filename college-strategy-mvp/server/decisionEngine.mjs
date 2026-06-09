/**
 * OnlyApply Decision Engine — benchmark match (v1) + scored catalog/rules (v2).
 * LLM writes prose only; school names/tiers come from engine when it runs.
 */

import {
  findBestBenchmark,
  listDraftBenchmarks,
  listLiveBenchmarks,
  normalizeApprovedSchools,
  profileSignatureFromBody,
} from "./engineStandards.mjs";
import { BENCHMARK_STRONG_SCORE, runDecisionEngineV2 } from "./decisionEngineV2.mjs";

function decisionEngineEnabled() {
  const raw = (process.env.DECISION_ENGINE_ENABLED ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function useDraftBenchmarks() {
  const raw = (process.env.DECISION_ENGINE_USE_DRAFT ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function scoringEngineEnabled() {
  const raw = (process.env.DECISION_ENGINE_V2_ENABLED ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function similarityScore(query, entry) {
  let score = 0;
  for (const tag of query.tags) {
    if ((entry.profile?.tags ?? []).includes(tag)) score += 4;
  }
  if (query.major && query.major === entry.profile?.major) score += 6;
  if (query.applicantIdentity && query.applicantIdentity === entry.profile?.applicantIdentity) score += 3;
  if (query.testing && query.testing === entry.profile?.testing) score += 2;
  if (query.gpaBand !== "unknown" && query.gpaBand === entry.profile?.gpaBand) score += 4;
  return score;
}

function tryBenchmarkMatch(body, tags) {
  const query = profileSignatureFromBody(body, tags);
  const live = listLiveBenchmarks();
  const draft = useDraftBenchmarks() ? listDraftBenchmarks() : [];

  let hit = findBestBenchmark(live, body, tags);
  let source = "live";
  if (!hit && draft.length) {
    hit = findBestBenchmark(draft, body, tags);
    source = "draft";
  }
  if (!hit) return { ok: false, reason: "no_benchmark_match" };

  const schools = normalizeApprovedSchools(hit.approvedSchools);
  const score = similarityScore(query, hit);

  return {
    ok: true,
    mode: score >= BENCHMARK_STRONG_SCORE ? "benchmark" : "benchmark_weak",
    source,
    benchmarkId: hit.sourceCaseKey,
    benchmarkTitle: hit.title,
    matchScore: score,
    schools,
    notes: hit.notes ?? schools.notes ?? null,
    profile: hit.profile,
  };
}

function formatTierLine(tier, locale) {
  return tier
    .map((r) => (r.note ? `${r.school}（${r.note}）` : r.school))
    .join(locale === "en" ? ", " : "、");
}

/**
 * @param {Record<string, unknown>} body
 * @param {string[]} [tags]
 */
export function runDecisionEngine(body, tags = []) {
  if (!decisionEngineEnabled()) {
    return { ok: false, reason: "disabled" };
  }

  const benchmark = tryBenchmarkMatch(body, tags);
  if (benchmark.ok && benchmark.mode === "benchmark") {
    return benchmark;
  }

  if (scoringEngineEnabled()) {
    const scored = runDecisionEngineV2(body, tags);
    if (scored.ok) {
      return {
        ...scored,
        benchmarkFallback: benchmark.ok ? benchmark : null,
      };
    }
  }

  if (benchmark.ok) {
    return benchmark;
  }

  return { ok: false, reason: "no_engine_match", benchmarkAttempt: benchmark };
}

export function buildDecisionEnginePromptBlock(decision, locale = "zh") {
  if (!decision?.ok) return "";
  const s = decision.schools;
  const modeLine =
    decision.mode === "scored"
      ? locale === "en"
        ? "Source: five-dimension scoring + school×major catalog + tier rules (no exact counselor case match)."
        : "来源：五维算分 + 校专业表 + 档位规则（无完全一致的顾问 benchmark）。"
      : locale === "en"
        ? `Reference benchmark: ${decision.benchmarkTitle || decision.benchmarkId}`
        : `参考 benchmark：${decision.benchmarkTitle || decision.benchmarkId}`;

  if (locale === "en") {
    return `

[OnlyApply Decision Engine — MANDATORY school skeleton]
The following 9 schools are engine-approved. Do NOT rename, remove, swap tiers, or add different schools in reach/match/safety.
${modeLine}
- Reach: ${formatTierLine(s.reach, "en")}
- Match: ${formatTierLine(s.match, "en")}
- Safety: ${formatTierLine(s.safety, "en")}
${decision.notes ? `- Engine note: ${decision.notes}\n` : ""}Write why_reach_for_you / why_match_for_you / why_safety_for_you, key_risks, and other prose fields for THESE schools only.
`;
  }

  return `

【OnlyApply Decision Engine — 以下 9 校为引擎判定，禁止更改】
reach / match / safety 必须使用下列校名与档位，不得替换、删除或新增其它学校。
${modeLine}
- 冲：${formatTierLine(s.reach, "zh")}
- 稳：${formatTierLine(s.match, "zh")}
- 保：${formatTierLine(s.safety, "zh")}
${decision.notes ? `- 引擎要点：${decision.notes}\n` : ""}请仅为上述学校撰写 why_*、key_risks 等说明字段。
`;
}

export function mergeDecisionSchoolsIntoReport(parsed, decision, locale = "zh") {
  if (!parsed || typeof parsed !== "object" || !decision?.ok) return parsed;
  const s = decision.schools;

  for (const tier of ["reach", "match", "safety"]) {
    const approved = s[tier] ?? [];
    const whyKey =
      tier === "reach" ? "why_reach_for_you" : tier === "match" ? "why_match_for_you" : "why_safety_for_you";
    const existing = Array.isArray(parsed[tier]) ? parsed[tier] : [];
    parsed[tier] = approved.map((row, i) => {
      const prev = existing[i] && typeof existing[i] === "object" ? existing[i] : {};
      const note = String(row.note ?? "").trim();
      const whyFromLlm = String(prev[whyKey] ?? "").trim();
      return {
        ...prev,
        school: row.school,
        [whyKey]: whyFromLlm || note || (locale === "en" ? "Engine benchmark fit." : "引擎 benchmark 匹配。"),
      };
    });
  }

  parsed.decision_engine = {
    version: decision.mode === "scored" ? "2" : "1",
    mode: decision.mode ?? "benchmark",
    source: decision.source,
    benchmark_id: decision.benchmarkId,
    benchmark_title: decision.benchmarkTitle,
    match_score: decision.matchScore,
    profile_composite: decision.profile?.composite ?? null,
    major_bucket: decision.profile?.majorBucket ?? null,
  };

  return parsed;
}

export { runDecisionEngineV2 };
