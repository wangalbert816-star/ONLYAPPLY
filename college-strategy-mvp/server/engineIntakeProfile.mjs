/**
 * Full questionnaire → engine intake profile.
 * Every FormState / reportBody field is parsed for rules, ranking, benchmark match, and AI fill.
 */

import { meaningfulStructuredActivities, structuredActivityBlob } from "./activityEvidence.mjs";
import { forbiddenSchoolsFromBody } from "./topReferenceSchools.mjs";
import { resolveGpaTextForAnalysis } from "./transcriptSheetReport.mjs";

const GEO_ALIASES = { great_lakes: "midwest" };

const UC_KEYWORD_RE =
  /\buc\b|university of california|加州大学|\bucla\b|\bucsd\b|\buci\b|\buc berkeley\b|\bboulder\b.*uc/i;

/** UC campus names in main 9-school list (not uc_analysis block). */
export function isUcSchoolName(name) {
  const s = String(name ?? "").trim();
  if (!s) return false;
  if (/^uc\s/i.test(s)) return true;
  if (/university of california/i.test(s)) return true;
  return false;
}

export function normalizeGeoPref(raw) {
  const g = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return GEO_ALIASES[g] ?? g.replace(/\s+/g, "_");
}

/** Region on the admit-stats table (East / Great Lakes / …). */
export function normalizeSchoolRegion(raw) {
  const g = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!g) return null;
  if (g === "great_lakes") return "great_lakes";
  if (["east", "west", "south", "midwest"].includes(g)) return g;
  return normalizeGeoPref(g);
}

function regionsEquivalent(a, b) {
  if (a === b) return true;
  if ((a === "great_lakes" && b === "midwest") || (a === "midwest" && b === "great_lakes")) return true;
  return false;
}

export function schoolRegionMatchesPrefs(schoolRegion, geo) {
  const region = normalizeSchoolRegion(schoolRegion);
  if (!geo.strict) return true;
  if (!region || region === "any") return false;
  for (const pref of geo.allowed) {
    const normalized = normalizeGeoPref(pref);
    if (regionsEquivalent(region, normalized)) return true;
  }
  return false;
}

export function parseGeoPrefs(body) {
  const raw = Array.isArray(body?.geoPrefs) ? body.geoPrefs : [];
  const normalized = [...new Set(raw.map(normalizeGeoPref).filter(Boolean))];
  const includesAny = normalized.includes("any") || normalized.length === 0;
  const strict = !includesAny;
  const allowed = strict ? normalized.filter((g) => g !== "any") : [];
  return { strict, allowed, includesAny, normalized };
}

function parseGpaBand(gpaRaw) {
  const text = String(gpaRaw ?? "").toLowerCase();
  const m = text.match(/(?:unweighted|uw|未加权)[^\d]*(\d\.\d{1,2})|(\d\.\d{1,2})/);
  const n = m ? Number(m[1] || m[2]) : null;
  if (n == null || !Number.isFinite(n)) return "unknown";
  if (n <= 3.35) return "weak";
  if (n <= 3.55) return "moderate";
  return "strong";
}

function parseTestBand(body) {
  const testing = String(body?.testing ?? "").trim().toLowerCase();
  if (testing === "test_optional") return "test_optional";
  const sat = String(body?.satScore ?? "").replace(/\D/g, "");
  const act = String(body?.actScore ?? "").replace(/\D/g, "");
  const satN = sat.length >= 3 ? Number(sat.slice(0, 4)) : null;
  const actN = act ? Number(act.slice(0, 2)) : null;
  let best = null;
  if (satN != null && satN >= 400 && satN <= 1600) best = satN;
  if (actN != null && actN >= 10 && actN <= 36) {
    const satEq = actN * 40 + 160;
    if (best == null || satEq > best) best = satEq;
  }
  if (best == null) return testing === "will_submit" ? "unreported" : "none";
  if (best >= 1500) return "strong";
  if (best >= 1380) return "solid";
  if (best >= 1250) return "moderate";
  return "weak";
}

function inferCompetitionDensity(body) {
  const identity = String(body?.applicantIdentity ?? "").trim().toLowerCase();
  const region = String(body?.residenceRegion ?? body?.citizenship ?? "").toLowerCase();
  const system = String(body?.highSchoolSystem ?? "").toLowerCase();
  if (identity === "intl" || /china|中国|shanghai|beijing|深圳|guangdong|singapore|korea|india/i.test(region)) {
    return "high";
  }
  if (/bay area|cupertino|silicon|北京|上海|international school|ib/i.test(`${region} ${system}`)) {
    return "high";
  }
  if (identity === "us_citizen") return "moderate";
  return "moderate";
}

function detectAthleteProfile(body) {
  const items = meaningfulStructuredActivities(body);
  const blob = structuredActivityBlob(body).toLowerCase();
  const hasSport = items.some(
    (a) =>
      a.kind === "sports" ||
      /varsity|club sport|lacrosse|soccer|basketball|football|swim|track|tennis|golf|hockey|rowing|wrestling|运动员|校队/i.test(
        `${a.name} ${a.role} ${a.description}`,
      ),
  );
  if (!hasSport && !/varsity|recruit|captain|d1|d2|d3|division|运动员/i.test(blob)) {
    return { isAthlete: false, level: null };
  }
  if (/d1|division i|scholarship offer|committed to/i.test(blob) && !/d3|division iii|naia/i.test(blob)) {
    return { isAthlete: true, level: "d1" };
  }
  if (/d3|division iii|naia|liberal arts recruit|contacted by several d3/i.test(blob)) {
    return { isAthlete: true, level: "d3" };
  }
  return { isAthlete: true, level: "unknown" };
}

function parseDealbreakerThemes(body) {
  const text = String(body?.dealbreakers ?? "").trim();
  const lower = text.toLowerCase();
  const themes = [];
  if (/宗教|religious|faith|church|christian|catholic|mormon|biblical/i.test(lower)) themes.push("no_religious");
  if (/派对|party|greek|frat|社交过强|party school/i.test(lower)) themes.push("no_party");
  if (/大城市|urban|纽约|nyc|洛杉矶|la\b|big city/i.test(lower)) themes.push("avoid_major_city");
  if (/rural|乡村|偏远|小镇|remote/i.test(lower)) themes.push("avoid_rural");
  if (/寒冷|cold|东北|midwest winter|snow/i.test(lower)) themes.push("avoid_cold");
  if (/安全|crime|治安|safety/i.test(lower)) themes.push("safety_conscious");
  if (/mit|stanford|哈佛|harvard|耶鲁|yale|princeton|caltech/i.test(lower)) themes.push("forbidden_elite_named");
  return { text, themes };
}

function parseBudgetPosture(body) {
  const budget = String(body?.budget ?? "").trim().toLowerCase();
  const dealbreakers = String(body?.dealbreakers ?? "").trim().toLowerCase();
  const aidHints = /budget|cap|limited|有限|预算|费用|afford|need_aid|financial|奖助|便宜|性价比/i.test(
    `${budget} ${dealbreakers}`,
  );

  if (budget === "need_aid" || budget === "budget_cap") {
    return { tier: "strict", allowHighPrivate: false, preferPublic: true, budgetSensitive: true, label: budget };
  }
  if (budget === "unsure" || aidHints) {
    return {
      tier: "moderate",
      allowHighPrivate: !aidHints,
      preferPublic: aidHints,
      budgetSensitive: aidHints,
      label: budget || "unsure",
    };
  }
  if (budget === "full_pay" || budget === "high_budget") {
    return { tier: "open", allowHighPrivate: true, preferPublic: false, budgetSensitive: false, label: budget };
  }
  return { tier: "moderate", allowHighPrivate: true, preferPublic: false, budgetSensitive: aidHints, label: budget || "unknown" };
}

function transcriptSummary(body) {
  const sheet = body?.transcriptSheet;
  if (!sheet || sheet.skipped || !Array.isArray(sheet.courses)) return null;
  const filled = sheet.courses.filter((c) => String(c?.courseName ?? "").trim() && String(c?.grade ?? "").trim());
  if (!filled.length) return null;
  return {
    courseCount: filled.length,
    unweightedGpa: String(sheet.unweightedGpa ?? "").trim() || null,
    weightedGpa: String(sheet.weightedGpa ?? "").trim() || null,
    scale: String(sheet.gradingScale ?? "").trim() || null,
  };
}

function supplementaryNotes(body) {
  const raw = body?.supplementary_notes ?? body?.supplementaryNotes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => ({
      topic: String(n?.topic ?? "").trim(),
      text: String(n?.text ?? "").trim(),
    }))
    .filter((n) => n.text)
    .slice(-12);
}

export function wantsUcFromBody(body) {
  const geo = body?.geoPrefs;
  if (Array.isArray(geo) && geo.includes("west")) return true;
  const blob = [
    body?.majorPrimary,
    body?.majorSecondary,
    body?.dealbreakers,
    structuredActivityBlob(body),
    body?.residenceRegion,
    body?.citizenship,
  ]
    .join(" ")
    .toLowerCase();
  return UC_KEYWORD_RE.test(blob);
}

/**
 * Complete intake profile for Decision Engine.
 * @param {Record<string, unknown>} body
 * @param {string[]} [tags]
 */
export function buildEngineIntakeProfile(body, tags = []) {
  const b = body && typeof body === "object" ? body : {};
  const geo = parseGeoPrefs(b);
  const budget = parseBudgetPosture(b);
  const dealbreakers = parseDealbreakerThemes(b);
  const forbidden = forbiddenSchoolsFromBody(b);
  const athlete = detectAthleteProfile(b);
  const tagSet = [...new Set((tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))].sort();

  const applicantIdentity = String(b.applicantIdentity ?? "").trim().toLowerCase();
  const testing = String(b.testing ?? "").trim().toLowerCase();
  const schoolSize = String(b.schoolSize ?? "any").trim().toLowerCase() || "any";
  const campusCulture = String(b.campusCulturePref ?? "any").trim().toLowerCase() || "any";
  const riskStyle = String(b.riskStyle ?? "balanced").trim().toLowerCase() || "balanced";
  const gpaBand = parseGpaBand(resolveGpaTextForAnalysis(b));
  const testBand = parseTestBand(b);

  const intl = applicantIdentity === "intl" || tagSet.includes("intl");
  const activities = meaningfulStructuredActivities(b);

  return {
    // —— Step 1: identity & constraints ——
    intakeTerm: String(b.intakeTerm ?? "").trim(),
    intakeOtherDetail: String(b.intakeOtherDetail ?? "").trim(),
    applicantIdentity: applicantIdentity || "unknown",
    citizenship: String(b.citizenship ?? "").trim(),
    residenceRegion: String(b.residenceRegion ?? "").trim(),
    competitionDensity: inferCompetitionDensity(b),
    budget,
    budgetLabel: budget.label,
    testing,
    testBand,
    satScore: String(b.satScore ?? "").trim(),
    actScore: String(b.actScore ?? "").trim(),

    // —— Step 2: academic ——
    highSchoolSystem: String(b.highSchoolSystem ?? "").trim(),
    currentHighSchool: String(b.currentHighSchool ?? "").trim(),
    gpa: String(b.gpa ?? "").trim(),
    gpaBand,
    gpaTrend: String(b.gpaTrend ?? "").trim().toLowerCase() || "unknown",
    transcript: transcriptSummary(b),
    languageScores: String(b.languageScores ?? "").trim(),
    academicSpecialFlags: Array.isArray(b.academicSpecialFlags) ? b.academicSpecialFlags.filter(Boolean) : [],
    academicSpecialNotes: String(b.academicSpecialNotes ?? "").trim(),
    majorPrimary: String(b.majorPrimary ?? "").trim(),
    majorSecondary: String(b.majorSecondary ?? "").trim(),

    // —— Step 3: fit & style ——
    schoolSize,
    campusCulture,
    geo,
    geoPrefs: geo.normalized,
    geoStrict: geo.strict,
    dealbreakers,
    forbidden,
    riskStyle,
    structuredActivityCount: activities.length,
    activityBlob: structuredActivityBlob(b).slice(0, 400),
    athlete,

    // —— Derived ——
    intl,
    testOptional: testing === "test_optional" || tagSet.includes("test-optional"),
    budgetSensitive: budget.budgetSensitive,
    ucIntent: wantsUcFromBody(b),
    supplementaryNotes: supplementaryNotes(b),
    tags: tagSet,
    locale: b.locale === "en" ? "en" : "zh",
  };
}

/** Benchmark / similarity signature — includes all major questionnaire dimensions. */
export function profileSignatureFromBody(reportBody, tags = []) {
  const p = buildEngineIntakeProfile(reportBody, tags);
  return {
    tags: p.tags,
    major: p.majorPrimary.toLowerCase(),
    majorSecondary: p.majorSecondary.toLowerCase(),
    applicantIdentity: p.applicantIdentity,
    testing: p.testing || "unknown",
    testBand: p.testBand,
    gpaBand: p.gpaBand,
    gpaTrend: p.gpaTrend,
    budget: p.budgetLabel,
    geo: p.geoPrefs.join(",") || "any",
    riskStyle: p.riskStyle,
    schoolSize: p.schoolSize,
    campusCulture: p.campusCulture,
    competitionDensity: p.competitionDensity,
    athleteLevel: p.athlete.isAthlete ? p.athlete.level ?? "yes" : "no",
    ucIntent: p.ucIntent,
  };
}

export function benchmarkSimilarityScore(query, entry) {
  let score = 0;
  for (const tag of query.tags ?? []) {
    if ((entry.profile?.tags ?? []).includes(tag)) score += 3;
  }
  if (query.major && query.major === entry.profile?.major) score += 5;
  if (query.majorSecondary && query.majorSecondary === entry.profile?.majorSecondary) score += 2;
  if (query.applicantIdentity && query.applicantIdentity === entry.profile?.applicantIdentity) score += 3;
  if (query.testing && query.testing === entry.profile?.testing) score += 2;
  if (query.testBand && query.testBand === entry.profile?.testBand) score += 2;
  if (query.gpaBand !== "unknown" && query.gpaBand === entry.profile?.gpaBand) score += 3;
  if (query.gpaTrend && query.gpaTrend === entry.profile?.gpaTrend) score += 2;
  if (query.budget && query.budget === entry.profile?.budget) score += 3;
  if (query.geo && query.geo === entry.profile?.geo) score += 3;
  if (query.riskStyle && query.riskStyle === entry.profile?.riskStyle) score += 2;
  if (query.schoolSize && query.schoolSize !== "any" && query.schoolSize === entry.profile?.schoolSize) score += 2;
  if (query.campusCulture && query.campusCulture !== "any" && query.campusCulture === entry.profile?.campusCulture) {
    score += 2;
  }
  if (query.athleteLevel && query.athleteLevel === entry.profile?.athleteLevel) score += 2;
  return score;
}

/** Upper bound for linear reference weight (major + tags + core dims). */
export const BENCHMARK_REFERENCE_SCORE_CEILING = 28;

/** Shared linear map: score / ceiling → 0..1 */
export function linearReferenceWeight(matchScore, ceiling) {
  const score = Number(matchScore);
  const cap = Number(ceiling);
  if (!Number.isFinite(score) || score <= 0 || !Number.isFinite(cap) || cap <= 0) return 0;
  return Math.min(1, Math.max(0, score / cap));
}

/**
 * Linear 0–1 weight: higher similarity → stronger (but still non-binding) case reference.
 * score 10 ≈ 36%, score 20 ≈ 71%, score 28 = 100%.
 */
export function benchmarkReferenceWeight(matchScore) {
  return linearReferenceWeight(matchScore, BENCHMARK_REFERENCE_SCORE_CEILING);
}

/**
 * Preference dimensions differ between current user and a stored benchmark profile.
 * When true, benchmark may inform reasoning but must NOT copy the same 9-school plan.
 */
export function benchmarkProfilePrefDiff(query, benchmarkProfile, intake) {
  const bp = benchmarkProfile ?? {};
  const reasons = [];

  const userGeo = intake?.geo?.strict ? (query.geo || intake.geoPrefs?.join(",") || "any") : "any";
  if (intake?.geo?.strict && bp.geo && bp.geo !== "any" && bp.geo !== userGeo) {
    reasons.push("geo");
  }

  if (query.budget && query.budget !== "unknown" && bp.budget && bp.budget !== query.budget) {
    reasons.push("budget");
  }

  if (
    query.riskStyle &&
    bp.riskStyle &&
    query.riskStyle !== bp.riskStyle &&
    (query.riskStyle !== "balanced" || bp.riskStyle !== "balanced")
  ) {
    reasons.push("riskStyle");
  }

  if (
    query.schoolSize &&
    query.schoolSize !== "any" &&
    bp.schoolSize &&
    bp.schoolSize !== "any" &&
    query.schoolSize !== bp.schoolSize
  ) {
    reasons.push("schoolSize");
  }

  if (
    query.campusCulture &&
    query.campusCulture !== "any" &&
    bp.campusCulture &&
    bp.campusCulture !== "any" &&
    query.campusCulture !== bp.campusCulture
  ) {
    reasons.push("campusCulture");
  }

  const benchUc = Boolean(bp.ucIntent);
  const userUc = Boolean(intake?.ucIntent);
  if (benchUc !== userUc) reasons.push("ucIntent");

  return { differs: reasons.length > 0, reasons };
}

/** Human-readable block for AI gap-fill and engine prompts. */
export function intakeProfileSummaryForPrompt(profile, locale = "zh") {
  const p = profile;
  const na = locale === "en" ? "not provided" : "未填";
  const lines =
    locale === "en"
      ? [
          `[Intake] ${p.intakeTerm || na}${p.intakeOtherDetail ? ` (${p.intakeOtherDetail})` : ""}`,
          `[Identity] ${p.applicantIdentity}; citizenship/residence: ${p.citizenship || na} / ${p.residenceRegion || na}; competition density: ${p.competitionDensity}`,
          `[Budget] ${p.budgetLabel}; sensitive=${p.budgetSensitive}`,
          `[Testing] ${p.testing || na}; band=${p.testBand}; SAT=${p.satScore || na}; ACT=${p.actScore || na}`,
          `[High school] ${p.highSchoolSystem || na} @ ${p.currentHighSchool || na}`,
          `[GPA] ${p.gpa || na}; band=${p.gpaBand}; trend=${p.gpaTrend}`,
          p.transcript
            ? `[Transcript sheet] ${p.transcript.courseCount} courses; UW=${p.transcript.unweightedGpa ?? na}; W=${p.transcript.weightedGpa ?? na}`
            : `[Transcript sheet] ${na}`,
          `[Language scores] ${p.languageScores || na}`,
          `[Academic flags] ${p.academicSpecialFlags.join(", ") || na}; notes: ${p.academicSpecialNotes || na}`,
          `[Majors] primary=${p.majorPrimary || na}; secondary=${p.majorSecondary || na}`,
          `[Campus size pref] ${p.schoolSize}; [Culture pref] ${p.campusCulture}`,
          `[Geography — HARD if listed] ${p.geo.strict ? p.geo.allowed.join(", ") : "any region"}`,
          `[List risk posture] ${p.riskStyle}`,
          `[Dealbreakers] ${p.dealbreakers.text || na}; themes=${p.dealbreakers.themes.join(", ") || "none"}`,
          `[Forbidden schools] ${p.forbidden.join(", ") || "none"}`,
          `[Athlete] ${p.athlete.isAthlete ? p.athlete.level ?? "yes" : "no"}`,
          `[UC interest] ${p.ucIntent ? "yes (main 9 should stay mostly non-UC)" : "no"}`,
          `[Activities count] ${p.structuredActivityCount}`,
          p.activityBlob
            ? `[Activity summary] ${p.activityBlob.slice(0, 280)}${p.activityBlob.length > 280 ? "…" : ""}`
            : "",
          p.supplementaryNotes.length
            ? `[Supplementary notes]\n${p.supplementaryNotes.map((n) => `- ${n.topic}: ${n.text}`).join("\n")}`
            : "",
        ]
      : [
          `【入学季】${p.intakeTerm || na}${p.intakeOtherDetail ? `（${p.intakeOtherDetail}）` : ""}`,
          `【身份】${p.applicantIdentity}；国籍/地区：${p.citizenship || na} / ${p.residenceRegion || na}；竞争密度：${p.competitionDensity}`,
          `【预算】${p.budgetLabel}；预算敏感=${p.budgetSensitive}`,
          `【标化】${p.testing || na}；档位=${p.testBand}；SAT=${p.satScore || na}；ACT=${p.actScore || na}`,
          `【高中】${p.highSchoolSystem || na} · ${p.currentHighSchool || na}`,
          `【GPA】${p.gpa || na}；档位=${p.gpaBand}；趋势=${p.gpaTrend}`,
          p.transcript
            ? `【成绩单表】${p.transcript.courseCount} 门课；UW=${p.transcript.unweightedGpa ?? na}；W=${p.transcript.weightedGpa ?? na}`
            : `【成绩单表】${na}`,
          `【语言成绩】${p.languageScores || na}`,
          `【学术特殊情况】${p.academicSpecialFlags.join("、") || na}；说明：${p.academicSpecialNotes || na}`,
          `【专业】主=${p.majorPrimary || na}；副=${p.majorSecondary || na}`,
          `【校园规模偏好】${p.schoolSize}；【文化偏好】${p.campusCulture}`,
          `【地理 — 若指定则为硬约束】${p.geo.strict ? p.geo.allowed.join("、") : "不限"}`,
          `【选校风格】${p.riskStyle}`,
          `【底线/无法接受】${p.dealbreakers.text || na}；主题=${p.dealbreakers.themes.join("、") || "无"}`,
          `【禁止学校】${p.forbidden.join("、") || "无"}`,
          `【运动员】${p.athlete.isAthlete ? p.athlete.level ?? "是" : "否"}`,
          `【UC 意向】${p.ucIntent ? "有（主名单尽量非 UC）" : "无"}`,
          `【结构化活动条数】${p.structuredActivityCount}`,
          p.activityBlob
            ? `【活动摘要】${p.activityBlob.slice(0, 280)}${p.activityBlob.length > 280 ? "…" : ""}`
            : "",
          p.supplementaryNotes.length
            ? `【用户补充】\n${p.supplementaryNotes.map((n) => `- ${n.topic}：${n.text}`).join("\n")}`
            : "",
        ];

  return lines.filter(Boolean).join("\n");
}

/** Shorthand prefs object for legacy callers. */
export function parseEnginePreferences(body, tags = []) {
  const p = buildEngineIntakeProfile(body, tags);
  return {
    geo: p.geo,
    budget: p.budget,
    dealbreakers: p.dealbreakers,
    forbidden: p.forbidden,
    schoolSize: p.schoolSize,
    campusCulture: p.campusCulture,
    riskStyle: p.riskStyle,
  };
}

export function preferencesSummaryForPrompt(profile, locale = "zh") {
  if (profile && (profile.majorPrimary != null || profile.intakeTerm != null || profile.geo)) {
    return intakeProfileSummaryForPrompt(profile, locale);
  }
  return intakeProfileSummaryForPrompt(buildEngineIntakeProfile({}), locale);
}
