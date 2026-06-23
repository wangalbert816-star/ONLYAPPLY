import type { CampusCulturePref, FormState, SchoolRow } from "../types";
import type { Locale } from "../i18n/strings";
import { resolveSchoolCampusProfile } from "./schoolCampusProfile";

export function campusCulturePrefLabel(pref: CampusCulturePref | "", locale: Locale): string {
  if (!pref) return "";
  const zh: Record<CampusCulturePref, string> = {
    academic: "学术 / 研究导向",
    balanced: "学业与社交平衡",
    social: "社交 / 派对氛围活跃",
    any: "没有强烈偏好",
  };
  const en: Record<CampusCulturePref, string> = {
    academic: "Academic / research-oriented",
    balanced: "Balanced academic & social",
    social: "Active social / party-friendly campus life",
    any: "No strong preference",
  };
  return locale === "en" ? en[pref] : zh[pref];
}

/** 供 prompt / 摘要使用的单行说明 */
export function campusCulturePrefPromptLine(pref: CampusCulturePref | "", locale: Locale): string {
  if (!pref || pref === "any") {
    return locale === "en"
      ? "No strong campus culture preference—still describe each school's vibe objectively."
      : "无强烈校园气质偏好——仍须客观描述每校气质。";
  }
  const label = campusCulturePrefLabel(pref, locale);
  if (pref === "academic") {
    return locale === "en"
      ? `Prefers ${label}: prioritize quieter study culture, research depth, and structured academics in campus_vibe/differentiation; note friction if a school is party-heavy or distraction-prone.`
      : `偏好${label}：campus_vibe/differentiation 须体现安静学习、研究深度；若该校社交/派对文化极活跃，须写可能摩擦点。`;
  }
  if (pref === "social") {
    return locale === "en"
      ? `Prefers ${label}: highlight clubs, athletics, Greek life, city/weekend social access where accurate; note if a school is too isolated or purely academic for this preference.`
      : `偏好${label}：在 campus_vibe/differentiation 中体现社团、体育、城市/周末社交资源（准确描述）；若过于安静/学术孤立，须写可能不合点。`;
  }
  return locale === "en"
    ? `Prefers ${label}: compare schools on both academics and social life—not only rankings.`
    : `偏好${label}：比较同档学校时须同时写学业与社交生活，不只谈排名。`;
}

function culturePrefMatchesTable(community: string, pref: CampusCulturePref): boolean {
  if (pref === "any" || pref === "balanced") return true;
  if (pref === "academic") return community === "academic" || community === "balanced";
  if (pref === "social") return community === "social" || community === "balanced";
  return community === pref;
}

function sizePrefMatchesTable(campusSize: string, pref: FormState["schoolSize"]): boolean {
  if (!pref || pref === "any") return true;
  if (pref === "medium") return true;
  if (pref === "small") return campusSize === "small" || campusSize === "medium";
  if (pref === "large") return campusSize === "large" || campusSize === "medium";
  return campusSize === pref;
}

/** 客户端：对照用户偏好与 admit-stats 表 Size/Community */
export function campusCultureAlignmentNote(
  form: FormState,
  row: SchoolRow,
  locale: Locale,
): string | null {
  const pref = form.campusCulturePref;
  const sizePref = form.schoolSize;
  if ((!pref || pref === "any") && (!sizePref || sizePref === "any")) return null;

  const profile = resolveSchoolCampusProfile(row.school);
  if (!profile) return null;

  const { campusSize, community } = profile;
  const cultureOk = !pref || pref === "any" || culturePrefMatchesTable(community, pref);
  const sizeOk = !sizePref || sizePref === "any" || sizePrefMatchesTable(campusSize, sizePref);

  if (!sizeOk) {
    return locale === "en"
      ? "Campus size may not match your preference—confirm undergraduate enrollment scale."
      : "校园规模可能与您的偏好不完全一致——建议核对本科人数与班级规模。";
  }

  if (pref === "academic" && community === "social") {
    return locale === "en"
      ? "Social-forward campus per our reference table—may need stronger time management vs your academic preference."
      : "参考表标记为社交活跃校——若您偏好学术安静，需评估时间管理与专注度。";
  }

  if (pref === "social" && community === "academic") {
    return locale === "en"
      ? "More academic/quiet per our reference table—check whether weekend life matches what you want."
      : "参考表偏学术安静——若您重视派对/社交氛围，该校周末生活可能不够活跃。";
  }

  if (pref === "academic") {
    if (community === "academic") {
      return locale === "en"
        ? "Aligns with your academic-campus preference—confirm major intensity still fits you."
        : "与您的学术导向偏好较一致——仍建议核对专业强度是否合适。";
    }
    if (community === "balanced") {
      return locale === "en"
        ? "Balanced campus profile—generally compatible with academic preference; confirm social intensity."
        : "参考表为学业与社交平衡型——与学术偏好大体兼容；建议核对社交强度。";
    }
  }

  if (pref === "social") {
    if (community === "social") {
      return locale === "en"
        ? "Aligns with your social/party-friendly preference—verify clubs/Greek/city access on official pages."
        : "与您的社交/派对氛围偏好较一致——建议在官网核对社团、体育与城市社交资源。";
    }
    if (community === "balanced") {
      return locale === "en"
        ? "Balanced campus profile—may fit social preference; verify Greek/weekend culture on official pages."
        : "参考表为平衡型——可能符合社交偏好；建议在官网核对 Greek/周末文化。";
    }
  }

  if (pref === "balanced" && community === "balanced") {
    return locale === "en"
      ? "Balanced campus profile—check whether coursework and social life match what you want."
      : "参考表为学业与社交平衡型——建议核对强度与社交资源是否符合预期。";
  }

  if (!cultureOk) {
    return locale === "en"
      ? "Campus community vibe may not fully match your preference—verify culture on official pages."
      : "校园社区气质可能与您的偏好不完全一致——建议在官网核对氛围。";
  }

  return null;
}
