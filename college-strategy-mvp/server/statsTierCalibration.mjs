/** Internal stats calibration for report + engine (no numeric stats in user-facing copy). */

import { resolveAdmitStatsSchool } from "./schoolAdmitStats.mjs";
import { resolveMajorBucket } from "./majorBucket.mjs";
import {
  buildStudentStatsProfile,
  computeSchoolStatsGap,
  statsGapBlocksMatch,
  statsGapBlocksSafety,
} from "./statsTierGap.mjs";
import { majorGuidancePromptNote } from "./majorGuidance.mjs";

function qualitativeGapLabel(gap, flags) {
  if (flags.includes("missing_required_testing")) return "missing_required_testing";
  if (flags.includes("below_sat_band") || flags.includes("below_gpa_band")) return "below_typical_band";
  if (flags.includes("above_testing_band")) return "above_testing_band";
  if (gap?.suggestedTier === "reach") return "reach_band";
  if (gap?.suggestedTier === "safety") return "safety_band";
  return "match_band";
}

export function calibrateSchoolsFromStats(body, schoolNames) {
  const student = buildStudentStatsProfile(body);
  const majorBucket = resolveMajorBucket(body);
  const rows = [];
  for (const name of schoolNames) {
    const stats = resolveAdmitStatsSchool(name).entry;
    if (!stats) {
      rows.push({ school: name, inTable: false });
      continue;
    }
    const gap = computeSchoolStatsGap(student, stats, majorBucket);
    rows.push({
      school: stats.school,
      inTable: true,
      suggestedTier: gap.effectiveTier ?? gap.suggestedTier,
      safetyBand: gap.safetyBand,
      testPolicy: gap.testPolicy,
      gpaPublished: gap.gpaPublished,
      flags: gap.flags,
      priorityPenalty: gap.priorityPenalty,
      label: qualitativeGapLabel(gap, gap.flags),
      blocksMatch: statsGapBlocksMatch(gap.satGap, gap.gpaGap),
      blocksSafety: statsGapBlocksSafety(gap.engineGap, gap.satGap, gap.gpaGap),
    });
  }
  return { student, rows };
}

/** Inject internal-only calibration block into LLM user payload. */
export function buildStatsCalibrationPromptBlock(body, locale = "zh") {
  const isEn = locale === "en";
  const student = buildStudentStatsProfile(body);
  const lines = [];

  if (student.testOptionalNoScore) {
    lines.push(
      isEn
        ? "User is test-optional without submitted scores: do not use SAT/ACT for non-required schools; still weigh acceptance selectivity, rigor, and activities."
        : "用户为 test-optional 且未提交标化：对非 Required 校不得用 SAT/ACT 解释档位；仍须结合录取率、selectivity、rigor 与活动。",
    );
  }
  if (student.intl) {
    lines.push(
      isEn
        ? "International / high-competition profile: tier conservatively vs overall admit stats."
        : "国际生/竞争密度高：相对 overall 录取统计应保守分档。",
    );
  }
  if (student.isCsMajor) {
    lines.push(
      isEn
        ? "Primary major CS: Carnegie Mellon School of Computer Science treats testing as Required with a higher bar."
        : "主申 CS：CMU School of Computer Science 按 Required 且标化门槛更高。",
    );
  }

  lines.push(
    isEn
      ? "Safety tier must mix stable high-admit schools (e.g. test-blind CSU/UC extensions) with at most ONE selective flagship where stats only exceed on testing—do not label Purdue/UMD-tier as the only safeties while SJSU sits in Match."
      : "Safety 档须包含稳定高录取率校（如 test-blind 州立/UC），至多 1 所仅因标化超 band 的 selective flagship；勿把 Purdue/UMD 档全放 Safety 而 SJSU 留在 Match。",
  );

  lines.push(
    isEn
      ? "Do NOT print numeric SAT/GPA/rate values in the report JSON; use qualitative fit/risk language only."
      : "禁止在 report JSON 正文中写出 SAT/GPA/录取率具体数字；仅用定性 fit/风险表述。",
  );

  if (!lines.length) return "";

  const header = isEn
    ? "\n\n[Internal stats calibration — official 2026 admitted profile table; qualitative only in output]"
    : "\n\n【内部 stats 校准 — 2026 官网 admitted 统计表；正文仅定性表述】";

  return `${header}\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

export function buildStatsCalibrationForSchools(body, schoolNames, locale = "zh") {
  const isEn = locale === "en";
  const majorBucket = resolveMajorBucket(body);
  const { rows } = calibrateSchoolsFromStats(body, schoolNames);
  if (!rows.length) return "";

  const lines = rows.map((r) => {
    if (!r.inTable) {
      return isEn
        ? `${r.school}: not in stats table — avoid if possible; no stats calibration.`
        : `${r.school}：不在统计表内 — 尽量避免推荐；不做 stats 校准。`;
    }
    const policyNote =
      r.testPolicy === "test_blind"
        ? isEn
          ? "test-blind — never cite testing"
          : "test-blind — 不得引用标化"
        : r.testPolicy === "required"
          ? isEn
            ? "testing required"
            : "标化 Required"
          : isEn
            ? "testing optional"
            : "标化 Optional";
    const gpaNote = r.gpaPublished
      ? isEn
        ? "GPA band available"
        : "有 GPA 区间"
      : isEn
        ? "no published GPA — do not compare GPA"
        : "无 GPA 公布 — 不得比较 GPA";
    const majorNote = majorGuidancePromptNote(resolveAdmitStatsSchool(r.school).entry, majorBucket, locale);
    const majorSuffix = majorNote ? (isEn ? `; major=${majorNote}` : `；专业=${majorNote}`) : "";
    return isEn
      ? `${r.school}: internal ${r.suggestedTier}; ${policyNote}; ${gpaNote}; flags=${(r.flags ?? []).join(",") || "none"}${majorSuffix}`
      : `${r.school}：内部建议 ${r.suggestedTier}；${policyNote}；${gpaNote}；标记=${(r.flags ?? []).join("、") || "无"}${majorSuffix}`;
  });

  const header = isEn
    ? "\n\n[Per-school internal tier hints from admit stats — do NOT expose numeric bands in prose]"
    : "\n\n【各校内部档位提示（admit 统计）— 正文勿写具体数字区间】";

  return `${header}\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

export function isWeakProfileFromStats(body) {
  const student = buildStudentStatsProfile(body);
  if (student.uwGpa != null && student.uwGpa <= 3.35) return true;
  if (student.sat != null && student.sat <= 1320) return true;
  if (student.testOptionalNoScore && student.uwGpa != null && student.uwGpa <= 3.45) return true;
  return false;
}

export { isAdmitStatsTableSchool } from "./schoolAdmitStats.mjs";
