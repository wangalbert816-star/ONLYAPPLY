/**
 * OnlyApply training corpus — gold cases from counselor-approved eval reviews.
 * Powers few-shot retrieval at report generation and SFT JSONL export for LoRA.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPORT_PROMPT_VERSION } from "./evalConstants.mjs";
import { getIntakeHorizon } from "./intakeHorizon.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CORPUS_PATH = path.join(__dirname, "..", "data", "training-corpus", "gold-cases.jsonl");

function corpusFilePath() {
  const custom = (process.env.TRAINING_CORPUS_FILE || "").trim();
  if (!custom) return DEFAULT_CORPUS_PATH;
  return path.isAbsolute(custom) ? custom : path.join(__dirname, "..", custom);
}

function corpusEnabled() {
  const raw = (process.env.TRAINING_CORPUS_ENABLED || "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function fewShotCount() {
  const n = Number(process.env.TRAINING_CORPUS_FEWSHOT || "2");
  if (!Number.isFinite(n) || n < 0) return 2;
  return Math.min(3, Math.floor(n));
}

function ensureCorpusDir() {
  const file = corpusFilePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return file;
}

function parseSchoolEntry(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const school = raw.trim();
    return school ? { school } : null;
  }
  if (typeof raw === "object") {
    const school = String(raw.school ?? "").trim();
    if (!school) return null;
    const note = String(raw.note ?? "").trim();
    return note ? { school, note } : { school };
  }
  return null;
}

function normalizeTier(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseSchoolEntry).filter(Boolean).slice(0, 3);
}

function normalizeApprovedSchools(raw) {
  if (!raw || typeof raw !== "object") {
    return { reach: [], match: [], safety: [], notes: null };
  }
  return {
    reach: normalizeTier(raw.reach),
    match: normalizeTier(raw.match),
    safety: normalizeTier(raw.safety),
    notes: String(raw.notes ?? "").trim() || null,
  };
}

function tierSchoolNames(tier) {
  return (tier ?? []).map((r) => r.school).filter(Boolean);
}

function isGoldReviewStatus(status) {
  return status === "submitted" || status === "approved";
}

function hasCompleteSchools(schools) {
  return (
    tierSchoolNames(schools.reach).length >= 3 &&
    tierSchoolNames(schools.match).length >= 3 &&
    tierSchoolNames(schools.safety).length >= 3
  );
}

/** @typedef {object} GoldCase
 * @property {string} id
 * @property {string} caseKey
 * @property {string} title
 * @property {string[]} tags
 * @property {string} locale
 * @property {Record<string, unknown>} reportBody
 * @property {{ reach: object[], match: object[], safety: object[], notes: string|null }} approvedSchools
 * @property {Record<string, unknown>|null} approvedReport
 * @property {string|null} overallNotes
 * @property {string} reviewedAt
 * @property {string|null} reviewedBy
 * @property {string} source
 * @property {string} promptVersion
 * @property {string|null} runId
 */

export function loadGoldCases() {
  const file = corpusFilePath();
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim());
  const cases = [];
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row?.caseKey && row?.reportBody) cases.push(row);
    } catch {
      /* skip bad line */
    }
  }
  return cases;
}

function writeGoldCases(cases) {
  const file = ensureCorpusDir();
  const content = cases.map((c) => JSON.stringify(c)).join("\n");
  fs.writeFileSync(file, content ? `${content}\n` : "", "utf8");
}

export function getCorpusStats() {
  const cases = loadGoldCases();
  const tags = new Set();
  for (const c of cases) {
    for (const t of c.tags ?? []) tags.add(t);
  }
  return {
    enabled: corpusEnabled(),
    fewShotCount: fewShotCount(),
    corpusFile: corpusFilePath(),
    goldCaseCount: cases.length,
    tagCount: tags.size,
    tags: [...tags].sort(),
    promptVersion: REPORT_PROMPT_VERSION,
  };
}

function patchSchoolsIntoReport(reportPayload, approvedSchools) {
  if (!reportPayload || typeof reportPayload !== "object") return null;
  const out = structuredClone(reportPayload);
  for (const tier of ["reach", "match", "safety"]) {
    const approved = approvedSchools[tier] ?? [];
    const existing = Array.isArray(out[tier]) ? out[tier] : [];
    out[tier] = approved.map((row, i) => {
      const prev = existing[i] && typeof existing[i] === "object" ? existing[i] : {};
      const whyKey =
        tier === "reach" ? "why_reach_for_you" : tier === "match" ? "why_match_for_you" : "why_safety_for_you";
      return {
        ...prev,
        school: row.school,
        [whyKey]: String(prev[whyKey] ?? row.note ?? "").trim(),
      };
    });
  }
  return out;
}

function extractFeatures(reportBody, tags = []) {
  const body = reportBody && typeof reportBody === "object" ? reportBody : {};
  const gpa = String(body.gpa ?? "").toLowerCase();
  const weakGpa =
    tags.includes("weak-gpa") ||
    /3\.[0-4]\b|2\.\d|unweighted 3\.[0-5]/i.test(gpa) ||
    /偏低|较弱|weak/i.test(gpa);
  const blob = [
    body.majorPrimary,
    body.majorSecondary,
    body.applicantIdentity,
    body.testing,
    body.riskStyle,
    structuredActivityText(body),
  ]
    .join(" ")
    .toLowerCase();

  return {
    tags: [...new Set((tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))],
    locale: body.locale === "en" ? "en" : "zh",
    major: String(body.majorPrimary ?? "").trim().toLowerCase(),
    majorSecondary: String(body.majorSecondary ?? "").trim().toLowerCase(),
    applicantIdentity: String(body.applicantIdentity ?? "").trim().toLowerCase(),
    testing: String(body.testing ?? "").trim().toLowerCase(),
    riskStyle: String(body.riskStyle ?? "").trim().toLowerCase(),
    weakGpa,
    athlete: tags.includes("d3-athlete") || tags.includes("athlete") || /d3|recruit|运动员|校队/i.test(blob),
    architecture:
      tags.includes("architecture") ||
      tags.includes("portfolio") ||
      /architect|建筑|risd|pratt|portfolio/i.test(blob),
    intl: tags.includes("intl") || body.applicantIdentity === "intl",
    cs: /computer science|cs|数据科学|data science/i.test(blob),
  };
}

function structuredActivityText(body) {
  const rows = body?.structuredActivities;
  if (!Array.isArray(rows)) return "";
  return rows
    .map((r) => [r?.name, r?.role, r?.description, r?.outcome].filter(Boolean).join(" "))
    .join(" ");
}

function similarityScore(queryFeatures, goldCase) {
  const f = extractFeatures(goldCase.reportBody, goldCase.tags);
  let score = 0;

  for (const tag of queryFeatures.tags) {
    if (f.tags.includes(tag)) score += 4;
  }
  if (queryFeatures.major && f.major && queryFeatures.major === f.major) score += 6;
  if (
    queryFeatures.majorSecondary &&
    f.majorSecondary &&
    queryFeatures.majorSecondary === f.majorSecondary
  ) {
    score += 2;
  }
  if (queryFeatures.applicantIdentity && queryFeatures.applicantIdentity === f.applicantIdentity) {
    score += 3;
  }
  if (queryFeatures.testing && queryFeatures.testing === f.testing) score += 2;
  if (queryFeatures.riskStyle && queryFeatures.riskStyle === f.riskStyle) score += 1;
  if (queryFeatures.weakGpa && f.weakGpa) score += 5;
  if (queryFeatures.athlete && f.athlete) score += 8;
  if (queryFeatures.architecture && f.architecture) score += 8;
  if (queryFeatures.intl && f.intl) score += 2;
  if (queryFeatures.cs && f.cs) score += 3;

  return score;
}

export function findSimilarGoldCases(reportBody, tags = [], limit = fewShotCount()) {
  if (!corpusEnabled() || limit <= 0) return [];
  const queryFeatures = extractFeatures(reportBody, tags);
  const ranked = loadGoldCases()
    .map((gold) => ({ gold, score: similarityScore(queryFeatures, gold) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return loadGoldCases().slice(0, limit);
  }
  return ranked.slice(0, limit).map((r) => r.gold);
}

function formatTierLine(tier, locale) {
  return tier
    .map((r) => (r.note ? `${r.school}（${r.note}）` : r.school))
    .join(locale === "en" ? ", " : "、");
}

export function buildFewShotPromptBlock(reportBody, tags = [], locale = "zh") {
  const matches = findSimilarGoldCases(reportBody, tags, fewShotCount());
  if (!matches.length) return "";

  if (locale === "en") {
    const blocks = matches.map((c, i) => {
      const s = c.approvedSchools;
      const lines = [
        `Example ${i + 1} (${c.title || c.caseKey}):`,
        `- Reach: ${formatTierLine(s.reach, "en")}`,
        `- Match: ${formatTierLine(s.match, "en")}`,
        `- Safety: ${formatTierLine(s.safety, "en")}`,
      ];
      if (s.notes) lines.push(`- Counselor note: ${s.notes}`);
      if (c.overallNotes) lines.push(`- Review notes: ${c.overallNotes}`);
      return lines.join("\n");
    });
    return `

[OnlyApply gold-case references — calibrate tier placement and tone only; do NOT copy school names unless the student profile is highly similar]

${blocks.join("\n\n")}
`;
  }

  const blocks = matches.map((c, i) => {
    const s = c.approvedSchools;
    const lines = [
      `案例 ${i + 1}（${c.title || c.caseKey}）：`,
      `- 冲：${formatTierLine(s.reach, "zh")}`,
      `- 稳：${formatTierLine(s.match, "zh")}`,
      `- 保：${formatTierLine(s.safety, "zh")}`,
    ];
    if (s.notes) lines.push(`- 选校要点：${s.notes}`);
    if (c.overallNotes) lines.push(`- 审阅备注：${c.overallNotes}`);
    return lines.join("\n");
  });
  return `

【OnlyApply 金牌案例参考 — 仅供档位与风格校准；学生情况不高度相似时不要照搬校名】

${blocks.join("\n\n")}
`;
}

/**
 * @param {object} input
 * @param {object} input.evalCase
 * @param {object} input.review
 * @param {object} [input.result]
 * @param {object} [input.run]
 */
export function upsertGoldCaseFromEval(input) {
  const { evalCase, review, result, run } = input;
  if (!evalCase?.caseKey || !review) return { ok: false, reason: "missing_case_or_review" };
  if (!isGoldReviewStatus(review.status)) return { ok: false, reason: "review_not_submitted" };

  const approvedSchools = normalizeApprovedSchools(review.finalApprovedRecommendation);
  if (!hasCompleteSchools(approvedSchools)) {
    return { ok: false, reason: "incomplete_schools" };
  }

  const reportBody = evalCase.reportBody ?? evalCase.report_body;
  if (!reportBody || typeof reportBody !== "object") {
    return { ok: false, reason: "missing_report_body" };
  }

  const approvedReport = result?.reportPayload
    ? patchSchoolsIntoReport(result.reportPayload, approvedSchools)
    : null;

  const entry = {
    id: evalCase.caseKey,
    caseKey: evalCase.caseKey,
    title: evalCase.title ?? evalCase.caseKey,
    tags: Array.isArray(evalCase.tags) ? evalCase.tags : [],
    locale: reportBody.locale === "en" ? "en" : "zh",
    reportBody,
    approvedSchools,
    approvedReport,
    overallNotes: review.overallNotes ?? null,
    reviewedAt: review.approvedAt ?? review.submittedAt ?? new Date().toISOString(),
    reviewedBy: review.reviewedBy ?? null,
    source: "eval_harness",
    promptVersion: run?.promptVersion ?? REPORT_PROMPT_VERSION,
    runId: run?.id ?? review.runId ?? null,
  };

  const cases = loadGoldCases();
  const idx = cases.findIndex((c) => c.caseKey === entry.caseKey);
  if (idx >= 0) cases[idx] = entry;
  else cases.push(entry);
  cases.sort((a, b) => String(a.caseKey).localeCompare(String(b.caseKey)));
  writeGoldCases(cases);

  return { ok: true, caseKey: entry.caseKey, goldCaseCount: cases.length };
}

/** Build OpenAI-style SFT messages for one gold case. */
export function goldCaseToSftMessages(goldCase, buildUserPayload, systemContent = "") {
  const locale = goldCase.locale === "en" ? "en" : "zh";
  const userContent = buildUserPayload(goldCase.reportBody, false);
  const assistantContent = JSON.stringify(
    goldCase.approvedReport ?? {
      reach: goldCase.approvedSchools.reach,
      match: goldCase.approvedSchools.match,
      safety: goldCase.approvedSchools.safety,
    },
  );
  const messages = [];
  if (systemContent) messages.push({ role: "system", content: systemContent });
  messages.push({ role: "user", content: userContent });
  messages.push({ role: "assistant", content: assistantContent });
  return {
    messages,
    meta: {
      caseKey: goldCase.caseKey,
      title: goldCase.title,
      tags: goldCase.tags,
      locale,
      promptVersion: goldCase.promptVersion,
    },
  };
}

export function exportSftJsonlLines(buildUserPayload, systemPromptForLocale) {
  return loadGoldCases().map((gold) => {
    const locale = gold.locale === "en" ? "en" : "zh";
    const planHorizon = getIntakeHorizon(String(gold.reportBody?.intakeTerm ?? ""));
    const systemContent =
      typeof systemPromptForLocale === "function"
        ? systemPromptForLocale(locale, false, planHorizon)
        : "";
    const { messages, meta } = goldCaseToSftMessages(gold, buildUserPayload, systemContent);
    return JSON.stringify({ messages, meta });
  });
}

export { corpusEnabled, corpusFilePath, fewShotCount, normalizeApprovedSchools, hasCompleteSchools };
