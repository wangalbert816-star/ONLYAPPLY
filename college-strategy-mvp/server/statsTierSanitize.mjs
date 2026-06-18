/** Post-process report prose against admit-stats rules (qualitative; no numeric injection). */

import { resolveAdmitStatsSchool } from "./schoolAdmitStats.mjs";
import { resolveMajorBucket } from "./majorBucket.mjs";
import { buildStudentStatsProfile, computeSchoolStatsGap } from "./statsTierGap.mjs";
import { calibrateSchoolsFromStats } from "./statsTierCalibration.mjs";

const SAT_LEVER_RE =
  /\b(SAT|ACT|标化|sat score|act score|testing score|submitted score|submit.*score)\b/i;
const GPA_TYPICAL_RE =
  /\b(typical gpa|average gpa|middle.*gpa|gpa.*(band|range|mid|typical|average)|GPA.*(中位|区间|典型|平均)|未加权.*GPA.*(低于|高于)|加权.*GPA.*(低于|高于))\b/i;

function stripTestBlindTesting(text) {
  if (!text) return text;
  return String(text)
    .replace(/[^.!?。！？\n]*\b(SAT|ACT|标化)[^.!?。！？\n]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripUnpublishedGpaCompare(text) {
  if (!text) return text;
  if (!GPA_TYPICAL_RE.test(text)) return text;
  return String(text)
    .replace(/[^.!?。！？\n]*\b(typical|average|middle|typical|中位|区间|典型)[^.!?。！？\n]*GPA[^.!?。！？\n]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeRowFields(row, tier, statsEntry, student, locale, majorBucket) {
  if (!row || typeof row !== "object") return row;
  const gap = statsEntry ? computeSchoolStatsGap(student, statsEntry, majorBucket) : null;
  const out = { ...row };

  const textFields = [
    "why_reach_for_you",
    "why_match_for_you",
    "why_safety_for_you",
    "campus_vibe",
    "differentiation",
    "context_note",
  ];

  if (gap?.testPolicy === "test_blind") {
    for (const key of textFields) {
      if (typeof out[key] === "string" && SAT_LEVER_RE.test(out[key])) {
        out[key] = stripTestBlindTesting(out[key]);
      }
    }
    for (const arrKey of ["key_risks", "key_fit_signals", "verification_focus"]) {
      if (Array.isArray(out[arrKey])) {
        out[arrKey] = out[arrKey]
          .map((b) => (SAT_LEVER_RE.test(String(b)) ? stripTestBlindTesting(String(b)) : String(b)))
          .filter(Boolean);
      }
    }
  }

  if (statsEntry && !statsEntry.gpaPublished) {
    for (const key of textFields) {
      if (typeof out[key] === "string") {
        out[key] = stripUnpublishedGpaCompare(out[key]);
      }
    }
  }

  if (gap && tier === "match" && gap.blocksMatch) {
    const whyKey = "why_match_for_you";
    if (!out.key_risks) out.key_risks = [];
    out.key_risks.push(
      locale === "en"
        ? "Stats vs published admit profile suggest this may sit closer to Reach than Match."
        : "相对官网 admitted 统计，该校更接近 Reach 而非 Match。",
    );
    if (out[whyKey]) {
      out[whyKey] = `${out[whyKey]} ${
        locale === "en" ? "Treat as a realistic stretch." : "宜视为现实可冲。"
      }`.trim();
    }
  }

  if (gap && tier === "safety" && gap.blocksSafety) {
    if (!out.key_risks) out.key_risks = [];
    out.key_risks.push(
      locale === "en"
        ? "Published admit profile does not support a true safety label for this student."
        : "相对官网 admitted 统计，对该生不宜标为保底。",
    );
  }

  if (gap?.flags?.includes("missing_required_testing")) {
    if (!out.key_risks) out.key_risks = [];
    out.key_risks.push(
      locale === "en"
        ? "School requires testing; missing scores is a material gap."
        : "该校要求标化；未提交分数是重要缺口。",
    );
  }

  if (gap?.flags?.includes("major_selective")) {
    if (!out.key_risks) out.key_risks = [];
    out.key_risks.push(
      locale === "en"
        ? "Student's major is selective at this school — treat tier conservatively."
        : "该生目标专业在此校为 selective — 档位宜保守理解。",
    );
  }

  if (gap?.flags?.includes("major_indirect")) {
    if (!out.key_risks) out.key_risks = [];
    out.key_risks.push(
      locale === "en"
        ? "No direct undergraduate path for this major — explain indirect entry if kept on list."
        : "该专业无本科直申路径 — 若保留在名单中须说明 indirect 路径。",
    );
  }

  if (gap?.flags?.includes("major_intl_limited") && student.intl) {
    if (!out.key_risks) out.key_risks = [];
    out.key_risks.push(
      locale === "en"
        ? "International applicants may face slightly tighter capacity for this major."
        : "国际生在该专业名额可能略紧 — 宜略保守。",
    );
  }

  return out;
}

export function sanitizeStatsTierReport(parsed, body, locale = "zh") {
  if (!parsed || typeof parsed !== "object") return parsed;
  const student = buildStudentStatsProfile(body);
  const majorBucket = resolveMajorBucket(body);
  const isEn = locale === "en";

  for (const tier of ["reach", "match", "safety"]) {
    const rows = parsed[tier];
    if (!Array.isArray(rows)) continue;
    parsed[tier] = rows.map((row) => {
      const stats = resolveAdmitStatsSchool(row?.school).entry;
      return sanitizeRowFields(row, tier, stats, student, locale, majorBucket);
    });
  }

  const allNames = ["reach", "match", "safety"].flatMap((t) =>
    (parsed[t] ?? []).map((r) => String(r?.school ?? "").trim()).filter(Boolean),
  );
  const { rows: cal } = calibrateSchoolsFromStats(body, allNames);

  const requiredMissing = cal.filter((r) => r.flags?.includes("missing_required_testing"));
  if (requiredMissing.length) {
    const gaps = Array.isArray(parsed.information_gaps) ? parsed.information_gaps : [];
    const msg = isEn
      ? "Some target schools require SAT/ACT; add scores or adjust the list."
      : "部分目标校要求 SAT/ACT；请补充标化或调整名单。";
    if (!gaps.some((g) => String(g).includes(isEn ? "require SAT" : "要求 SAT"))) {
      parsed.information_gaps = [...gaps, msg].slice(0, 6);
    }
  }

  return parsed;
}
