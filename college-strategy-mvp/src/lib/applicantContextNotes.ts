import type { FormState } from "../types";
import type { Locale } from "../i18n/strings";

type SchoolRegion = "california" | "texas" | "michigan" | "other";

function inferSchoolRegion(school: string): SchoolRegion {
  const s = school.trim().toLowerCase();
  if (/california|\buc\b|berkeley|ucla|ucsd|uci|uc davis|ucsb|ucr/i.test(s)) return "california";
  if (/texas|\but austin\b|a&m|texas tech|houston/i.test(s)) return "texas";
  if (/michigan|umich|ann arbor/i.test(s)) return "michigan";
  return "other";
}

function regionHint(residence: string, locale: Locale): string | null {
  const r = residence.trim().toLowerCase();
  if (!r) return null;
  if (/加州|california|\bca\b|los angeles|san francisco|bay area/i.test(r)) {
    return locale === "en" ? "California residency may affect public-school cost/aid rules." : "加州居民身份可能影响公立校费用/奖助口径。";
  }
  if (/德州|texas|\btx\b|austin|dallas|houston/i.test(r)) {
    return locale === "en" ? "Texas residency uses ApplyTexas and distinct auto-merit rules." : "德州居民通过 ApplyTexas，自动 merit 规则与外州不同。";
  }
  if (/中国|china|mainland|大陆/i.test(r)) {
    return locale === "en"
      ? "International applicant from China: verify intl aid, visa, and English requirements on official pages."
      : "中国大陆背景国际生：请逐校核对国际生奖助、签证与语言要求（以官网为准）。";
  }
  return null;
}

function budgetHint(form: FormState, locale: Locale): string | null {
  if (form.budget === "need_aid" || form.budget === "budget_cap") {
    return locale === "en"
      ? "Aid-sensitive profile: use net price calculators—do not assume merit from third-party lists."
      : "预算/奖助敏感：请用 net price calculator 核对，勿依赖第三方榜单推测 merit。";
  }
  return null;
}

function identityHint(form: FormState, locale: Locale): string | null {
  if (form.applicantIdentity === "intl") {
    return locale === "en"
      ? "International applicant: English proficiency, visa, and intl aid pages are mandatory checks."
      : "国际生身份：语言、签证、国际生奖助页为必核对项。";
  }
  return null;
}

function residencyVsSchool(form: FormState, school: string, locale: Locale): string | null {
  const residence = `${form.residenceRegion} ${form.citizenship}`.trim();
  const schoolRegion = inferSchoolRegion(school);
  if (!residence) return null;

  const isCaResident = /加州|california|\bca\b/i.test(residence);
  const isTxResident = /德州|texas|\btx\b/i.test(residence);

  if (schoolRegion === "california" && isCaResident) {
    return locale === "en"
      ? "In-state UC context: compare in-state vs OOS cost on official pages—not unsourced admit rates."
      : "加州州内读 UC：请在官网对比州内/外州费用，勿引用无来源录取率。";
  }
  if (schoolRegion === "california" && !isCaResident) {
    return locale === "en"
      ? "Non-resident/international at UC: verify intl tuition and aid separately from CA residents."
      : "非加州居民/国际生读 UC：学费与奖助须与州内分开核对。";
  }
  if (schoolRegion === "texas" && isTxResident) {
    return locale === "en"
      ? "Texas resident at a Texas public: check ApplyTexas and merit rules on official sites only."
      : "德州居民读德州公立：ApplyTexas 与 merit 规则仅以官网为准。";
  }
  if (schoolRegion === "texas" && !isTxResident) {
    return locale === "en"
      ? "Out-of-state/international at Texas publics: verify OOS tuition and competitive majors separately."
      : "外州/国际生读德州公立：外州学费与热门专业政策须单独核对。";
  }
  return null;
}

function hsSystemHint(form: FormState, locale: Locale): string | null {
  const school = form.currentHighSchool.trim();
  if (school) {
    return locale === "en"
      ? `Current HS: ${school}—confirm how this school’s course rigor is read on each college’s admissions page.`
      : `就读学校：${school}——请在各校招生页核对该校课程 rigor 如何被理解。`;
  }
  const hs = form.highSchoolSystem.trim().toLowerCase();
  if (!hs) return null;
  if (/ib|a-?level|ap|国际/i.test(hs)) {
    return locale === "en"
      ? "Rigorous HS system noted: confirm transcript/course-rigor evaluation on the admissions page."
      : "问卷注明较 rigorous 的中学体系：请在招生页确认课程强度评估方式。";
  }
  return null;
}

/** 按申请者语境生成可核对参考（第三期 #29） */
export function buildApplicantContextBullets(form: FormState, school: string, locale: Locale): string[] {
  const seen = new Set<string>();
  const bullets: string[] = [];
  const push = (line: string | null) => {
    const t = (line || "").trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    bullets.push(t);
  };

  push(identityHint(form, locale));
  push(budgetHint(form, locale));
  push(regionHint(form.residenceRegion || form.citizenship, locale));
  push(residencyVsSchool(form, school, locale));
  push(hsSystemHint(form, locale));

  if (bullets.length === 0) {
    push(
      locale === "en"
        ? "No reliable third-party stats for your profile—confirm cost, aid, and major rules on official CDS/admissions pages."
        : "暂无针对你背景的可靠第三方统计，请在官网 CDS/招生页核对费用、奖助与专业政策。",
    );
  }

  return bullets.slice(0, 3);
}

export function mergeContextNote(existing: string | undefined, bullets: string[], locale: Locale): string {
  const base = (existing || "").trim();
  const extra = bullets.filter((b) => !base || !base.includes(b.slice(0, Math.min(12, b.length))));
  if (extra.length === 0) return base;
  const sep = locale === "en" ? " " : "";
  return [base, ...extra].filter(Boolean).join(sep).trim();
}
