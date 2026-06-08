/** Dynamic tier-calibration hints injected into report user payload (from eval review 2026-06-08). */

import { meaningfulStructuredActivities, structuredActivityBlob } from "./activityEvidence.mjs";

function parseGpaNumber(gpaRaw) {
  const text = String(gpaRaw || "").trim();
  if (!text) return null;
  const uw = text.match(/(?:unweighted|UW|未加权)[^\d]*(\d\.\d{1,2})/i);
  if (uw) return Number(uw[1]);
  const all = [...text.matchAll(/\b([1-4]\.\d{1,2})\b/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 4.5);
  if (!all.length) return null;
  return Math.min(...all);
}

function parseSatNumber(body) {
  const sat = String(body?.satScore || "").trim();
  if (sat && /^\d{3,4}$/.test(sat)) return Number(sat);
  const act = String(body?.actScore || "").trim();
  if (act && /^\d{1,2}$/.test(act)) return Math.round(Number(act) * 40 + 160);
  return null;
}

function isWeakAcademicProfile(body) {
  const gpa = parseGpaNumber(body?.gpa);
  const sat = parseSatNumber(body);
  const testing = String(body?.testing || "");
  const thinActivities = meaningfulStructuredActivities(body).filter(
    (a) => String(a.name || "").trim() && String(a.description || "").trim().length >= 20,
  ).length < 1;
  if (gpa != null && gpa <= 3.35 && (testing === "test_optional" || (sat != null && sat <= 1320))) return true;
  if (gpa != null && gpa <= 3.25) return true;
  if (sat != null && sat <= 1280 && thinActivities) return true;
  return false;
}

function isModerateAcademicProfile(body) {
  const gpa = parseGpaNumber(body?.gpa);
  const sat = parseSatNumber(body);
  if (gpa != null && gpa >= 3.55 && sat != null && sat >= 1400) return false;
  if (gpa != null && gpa >= 3.7 && sat != null && sat >= 1350) return false;
  if (gpa != null && gpa <= 3.45) return true;
  if (sat != null && sat <= 1380) return true;
  return false;
}

/** @param {Record<string, unknown>} body @param {"zh"|"en"} locale */
export function athleticRecruitmentHint(body, locale) {
  const blob = structuredActivityBlob(body).toLowerCase();
  const hasSport = meaningfulStructuredActivities(body).some(
    (a) => a.kind === "sports" || /varsity|club sport|lacrosse|soccer|basketball|football|swim|track|tennis|golf|hockey|rowing|wrestling|运动员|校队/i.test(
      `${a.name} ${a.role} ${a.description}`,
    ),
  );
  if (!hasSport && !/varsity|recruit|captain|d1|d2|d3|division/i.test(blob)) return "";

  const d3Signal = /d3|division iii|naia|no d1|liberal arts recruit|contacted by several d3|d3 program/i.test(blob);
  const d1Signal = /d1|division i|scholarship offer|committed to/i.test(blob) && !d3Signal;

  if (locale === "en") {
    if (d3Signal) {
      return `\n\n[Athletic recruitment context — D3/NAIA-level signals detected]
- Do NOT upgrade Reach to Top-20/Top-30 privates (e.g. Notre Dame, WashU, UVA, USC) solely because of varsity athletics.
- DO anchor Reach/Match around athletic-friendly LACs, D3 programs, or regional fits that match stats + major + geography.
- executive_summary and at least 2 school rows must cite the sport, level (D3/NAIA), and role (captain/starter/recruiting contact).
- Athletic hook is NOT a lottery ticket to ultra-selective schools when stats are moderate.`;
    }
    if (d1Signal) {
      return `\n\n[Athletic recruitment context — D1 signals detected]
- Tier only with explicit recruiting evidence; still respect GPA/testing vs each school's typical band.
- Cite sport, division, and recruiting status in executive_summary and school rationales.`;
    }
    return `\n\n[Athletic recruitment context]
- Reference varsity sport, role, and level in executive_summary and school rationales.
- Do not treat athletics as automatic Reach upgrade to elite privates without stats + recruiting evidence.`;
  }

  if (d3Signal) {
    return `\n\n【运动员/recruitment 语境 — 检测到 D3/NAIA 信号】
- 不得仅因校队/队长/contacted by D3 就把 Reach 写成 Top 20–30 私校（如 Notre Dame、WashU、UVA、USC 等）。
- Reach/Match 应围绕 D3/LAC/区域 fit、stats + 专业 + 地理匹配的 realistic stretch。
- executive_summary 与至少 2 所学校的理由须引用运动项目、级别（D3/NAIA）、角色（队长/starter/教练联系）。
- 中等标化下， athletic hook 不是冲进 ultra-selective 的彩票。`;
  }
  if (d1Signal) {
    return `\n\n【运动员/recruitment 语境 — 检测到 D1 信号】
- 须有明确 recruitment 证据再上调档位；仍须对照 GPA/标化与各校典型区间。
- executive_summary 与分档理由须引用项目、级别与 recruitment 状态。`;
  }
  return `\n\n【运动员/recruitment 语境】
- executive_summary 与学校理由须引用校队项目、角色与级别。
- 无 stats + recruitment 证据时，不得把 athletic 标签当作冲进顶尖私校的 Reach 升级。`;
}

/** @param {Record<string, unknown>} body @param {"zh"|"en"} locale */
export function statsTierCalibrationHint(body, locale) {
  const gpa = parseGpaNumber(body?.gpa);
  const sat = parseSatNumber(body);
  const weak = isWeakAcademicProfile(body);
  const moderate = isModerateAcademicProfile(body);
  const parts = [];

  if (gpa != null) parts.push(locale === "en" ? `parsed UW GPA ≈ ${gpa}` : `解析 GPA ≈ ${gpa}`);
  if (sat != null) parts.push(locale === "en" ? `parsed SAT ≈ ${sat}` : `解析 SAT ≈ ${sat}`);

  if (locale === "en") {
    let block = "";
    if (parts.length) {
      block += `\n\n[Stats calibration — ${parts.join("; ")}]`;
    } else {
      block += `\n\n[Stats calibration]`;
    }
    if (weak) {
      block += `
- Weak/moderate academic board: Reach must NOT include CMU, Georgia Tech, USC, UMich, NYU, UVa-tier unless rare national-level evidence exists.
- Prefer selective UC campuses, strong LACs, or competitive match publics as realistic Reach ceiling.
- If testing is test-optional but an SAT/ACT score is provided in the form, STILL use it for tier calibration.`;
    } else if (moderate) {
      block += `
- Moderate stats band: Reach should stay within realistic stretch (strong LAC/D3 fit, competitive public flagship, specialized program schools)—not Top-15 privates by default.
- If SAT is ~80+ points below a school's typical middle range, default that school to Reach (not Match) or exclude from Reach if far below.
- Match/Safety must not include schools where GPA/SAT are clearly below published middle ranges (e.g. USC/UT Austin tier with ~3.5/1380).`;
    } else {
      block += `
- When SAT/GPA are clearly below a school's typical middle band, tier up conservatively (Match→Reach) or remove from Reach.
- Reach tier: all 3 schools should sit in a similar selectivity band—do not mix USC-level with regional publics in the same Reach block.`;
    }
    return block;
  }

  let block = "";
  if (parts.length) {
    block += `\n\n【Stats 档位校准 — ${parts.join("；")}】`;
  } else {
    block += `\n\n【Stats 档位校准】`;
  }
  if (weak) {
    block += `
- 弱/中等学术板：Reach 不得默认含 CMU、Georgia Tech、USC、UMich、NYU、UVa 等，除非有罕见全国级证据。
- Reach 上限优先 selective UC、强 LAC 或与 stats 匹配的 competitive public。
- 标化策略为 test-optional 但表单已填 SAT/ACT 时，仍须用该分数校准档位。`;
  } else if (moderate) {
    block += `
- 中等 stats：Reach 应为 realistic stretch（D3/LAC fit、竞争性公立 flagship、专精项目校），勿默认 Top 15 私校。
- SAT 比目标校常见中位低约 80+ 分时，默认上调一档或移出 Reach。
- Match/Safety 不得含 GPA/SAT 明显低于该校典型区间的学校（如 ~3.5/1380 申 USC/UT Austin 档）。`;
  } else {
    block += `
- GPA/SAT 明显低于目标校典型区间时，保守分档（Match→Reach）或移出 Reach。
- Reach 三校应处于相近选择性 band，禁止 USC 级与 regional public 混在同一 Reach 档。`;
  }
  return block;
}

/** @param {Record<string, unknown>} body @param {"zh"|"en"} locale */
export function riskStyleCalibrationHint(body, locale) {
  const risk = String(body?.riskStyle || "").trim();
  if (risk !== "aggressive") return "";
  const moderate = isModerateAcademicProfile(body);
  if (!moderate) return "";

  if (locale === "en") {
    return `\n\n[List posture: aggressive — with moderate stats]
- "Aggressive" adjusts narrative tone and may keep ONE defensible high stretch—it does NOT upgrade all tiers or ignore GPA/SAT gaps.
- Do NOT place Berkeley/USC/Top-20 privates in Match/Safety when stats are only moderate.
- Explain in strategy_notes how list posture interacts with stats (1 sentence).`;
  }
  return `\n\n【选校风格：aggressive · 但 stats 中等】
- aggressive 仅影响叙事与是否保留 1 所可辩护的高 stretch，不得整体上调档位或忽视 GPA/标化差距。
- stats 仅中等时，不得把 Berkeley/USC/Top 20 私校标为 Match/Safety。
- strategy_notes 中须用 1 句说明选校风格与 stats 的关系。`;
}
