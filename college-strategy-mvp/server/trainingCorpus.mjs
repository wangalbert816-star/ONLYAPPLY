/**
 * OnlyApply training corpus — gold cases from counselor-approved eval reviews.
 * Powers few-shot retrieval at report generation and SFT JSONL export for LoRA.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPORT_PROMPT_VERSION } from "./evalConstants.mjs";
import { getIntakeHorizon } from "./intakeHorizon.mjs";
import { linearReferenceWeight } from "./engineIntakeProfile.mjs";
import {
  buildReviewFeedbackSummaryLines,
  extractReviewFeedback,
} from "./engineReviewFeedback.mjs";

/** Gold-case similarity uses more tags + athlete/arch flags; practical ceiling ~40. */
export const GOLD_CASE_REFERENCE_SCORE_CEILING = 40;

export function goldCaseReferenceWeight(matchScore) {
  return linearReferenceWeight(matchScore, GOLD_CASE_REFERENCE_SCORE_CEILING);
}

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

export function goldCaseSimilarityScore(queryFeatures, goldCase) {
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

/** @typedef {{ gold: object, score: number, referenceWeight: number }} RankedGoldCase */

/** @returns {RankedGoldCase[]} */
export function findSimilarGoldCasesRanked(reportBody, tags = [], limit = fewShotCount()) {
  if (!corpusEnabled() || limit <= 0) return [];
  const queryFeatures = extractFeatures(reportBody, tags);
  return loadGoldCases()
    .map((gold) => {
      const score = goldCaseSimilarityScore(queryFeatures, gold);
      return { gold, score, referenceWeight: goldCaseReferenceWeight(score) };
    })
    .filter((r) => r.score > 0 && r.referenceWeight > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function findSimilarGoldCases(reportBody, tags = [], limit = fewShotCount()) {
  return findSimilarGoldCasesRanked(reportBody, tags, limit).map((r) => r.gold);
}

function tierNames(tier) {
  return (tier ?? []).map((r) => String(r?.school ?? "").trim()).filter(Boolean);
}

function buildOneGoldCaseReferenceBlock(ranked, index, locale) {
  const { gold: c, score, referenceWeight: w } = ranked;
  const pct = Math.round(w * 100);
  const s = c.approvedSchools ?? {};
  const title = c.title || c.caseKey || `case-${index + 1}`;
  const join = locale === "en" ? ", " : "、";

  const guidance =
    w >= 0.66
      ? locale === "en"
        ? "Strong reference — borrow tiering logic and tone only; do not copy school names into the final list."
        : "参考强度较高——可借鉴分档逻辑与语气，勿将下列校名写入最终名单。"
      : w >= 0.33
        ? locale === "en"
          ? "Moderate reference — calibrate tier tone only; do not reuse school names."
          : "参考强度中等——仅校准档位语气，勿照搬校名。"
        : locale === "en"
          ? "Light reference — background context only."
          : "参考强度较低——仅作背景提示。";

  const lines =
    locale === "en"
      ? [`Example ${index + 1} "${title}" (linear ref ${pct}%, similarity ${score}/~${GOLD_CASE_REFERENCE_SCORE_CEILING}).`, guidance]
      : [`案例 ${index + 1}「${title}」（线性参考 ${pct}%，相似度 ${score}/约 ${GOLD_CASE_REFERENCE_SCORE_CEILING}）。`, guidance];

  const reach = tierNames(s.reach);
  const match = tierNames(s.match);
  const safety = tierNames(s.safety);

  if (w >= 0.35 && reach.length) {
    lines.push(
      locale === "en"
        ? `- Past Reach (${pct}% ref): ${reach.join(join)}`
        : `- 冲（参考 ${pct}%）：${reach.join(join)}`,
    );
  }
  if (w >= 0.5 && match.length) {
    lines.push(
      locale === "en"
        ? `- Past Match (${pct}% ref): ${match.join(join)}`
        : `- 稳（参考 ${pct}%）：${match.join(join)}`,
    );
  }
  if (w >= 0.65 && safety.length) {
    lines.push(
      locale === "en"
        ? `- Past Safety (${pct}% ref): ${safety.join(join)}`
        : `- 保（参考 ${pct}%）：${safety.join(join)}`,
    );
  }
  if (w >= 0.75 && s.notes) {
    lines.push(
      locale === "en" ? `- Counselor note (${pct}% ref): ${s.notes}` : `- 选校要点（参考 ${pct}%）：${s.notes}`,
    );
  }
  if (w >= 0.75 && c.overallNotes) {
    lines.push(
      locale === "en"
        ? `- Review notes (${pct}% ref): ${c.overallNotes}`
        : `- 审阅备注（参考 ${pct}%）：${c.overallNotes}`,
    );
  }

  const feedback = c.reviewFeedback ?? extractReviewFeedback(c.review);
  if (feedback && w >= 0.25) {
    const trainingLines = buildReviewFeedbackSummaryLines(feedback, locale);
    if (trainingLines.length) {
      lines.push(
        locale === "en"
          ? `- Counselor training from this case (${pct}% ref):`
          : `- 顾问培训要点（参考 ${pct}%）：`,
      );
      lines.push(...trainingLines.map((l) => `  ${l}`));
    }
  }

  return lines.join("\n");
}

export function buildFewShotPromptBlock(reportBody, tags = [], locale = "zh") {
  const ranked = findSimilarGoldCasesRanked(reportBody, tags, fewShotCount());
  if (!ranked.length) return "";

  const blocks = ranked.map((r, i) => buildOneGoldCaseReferenceBlock(r, i, locale));

  if (locale === "en") {
    return `

[OnlyApply gold-case references — linear by similarity; calibrate tier/tone only; NEVER copy school names into reach/match/safety when the Decision Engine list is present]

${blocks.join("\n\n")}
`;
  }

  return `

【OnlyApply 金牌案例参考 — 按相似度线性展示；仅供档位与风格校准；有引擎名单时不得将下列校名写入 reach/match/safety】

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

  const reviewFeedback = extractReviewFeedback(review);

  const entry = {
    id: evalCase.caseKey,
    caseKey: evalCase.caseKey,
    title: evalCase.title ?? evalCase.caseKey,
    tags: Array.isArray(evalCase.tags) ? evalCase.tags : [],
    locale: reportBody.locale === "en" ? "en" : "zh",
    reportBody,
    approvedSchools,
    approvedReport,
    reviewFeedback,
    review,
    overallNotes: review.overallNotes ?? null,
    reviewedAt: review.approvedAt ?? review.submittedAt ?? new Date().toISOString(),
    reviewedBy: review.reviewedBy ?? null,
    source: evalCase.source ?? (evalCase.tags?.includes("alumni") ? "alumni_feedback" : "eval_harness"),
    promptVersion: run?.promptVersion ?? REPORT_PROMPT_VERSION,
    runId: run?.id ?? review.runId ?? null,
  };

  const cases = loadGoldCases();
  const idx = cases.findIndex((c) => c.caseKey === entry.caseKey);
  if (idx >= 0) cases[idx] = entry;
  else cases.push(entry);
  cases.sort((a, b) => String(a.caseKey).localeCompare(String(b.caseKey)));
  try {
    writeGoldCases(cases);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[training-corpus] gold_case_write_failed", msg);
    return { ok: false, reason: "corpus_write_failed", message: msg };
  }

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
