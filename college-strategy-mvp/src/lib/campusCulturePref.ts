import type { CampusCulturePref, FormState, SchoolRow } from "../types";
import type { Locale } from "../i18n/strings";

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

const ACADEMIC_VIBE_RE = /学术|研究|research|quiet|study|library|intellectual/i;
const SOCIAL_VIBE_RE = /社交|派对|party|greek|athletic|体育|社团|social|weekend|city|urban|活跃/i;
/** vibe 里明确削弱社交/派对（如「派对氛围相对有限」） */
const SOCIAL_VIBE_NEGATION_RE =
  /派对.{0,12}(有限|偏少|较少|不强|不活跃|相对有限|偏弱)|有限.{0,8}派对|偏学术|以学术|primarily academic|limited.{0,16}party|party.{0,16}(limited|minimal|low|relatively)|less.{0,12}social|not.{0,16}party|quiet.{0,8}campus|学术.{0,8}为主/i;

function vibeReadsSocial(vibe: string): boolean {
  if (SOCIAL_VIBE_NEGATION_RE.test(vibe)) return false;
  return SOCIAL_VIBE_RE.test(vibe);
}

function vibeReadsAcademic(vibe: string): boolean {
  return ACADEMIC_VIBE_RE.test(vibe);
}

/** 客户端：对照用户偏好与该校 vibe 的一句话（不替代 LLM，作补充） */
export function campusCultureAlignmentNote(
  form: FormState,
  row: SchoolRow,
  locale: Locale,
): string | null {
  const pref = form.campusCulturePref;
  if (!pref || pref === "any") return null;
  const vibe = (row.campus_vibe || "").trim();
  if (!vibe) return null;

  const academicish = vibeReadsAcademic(vibe);
  const socialish = vibeReadsSocial(vibe);

  if (pref === "academic") {
    if (academicish && !socialish) {
      return locale === "en"
        ? "Aligns with your academic-campus preference—confirm major intensity still fits you."
        : "与您的学术导向偏好较一致——仍建议核对专业强度是否合适。";
    }
    if (socialish) {
      return locale === "en"
        ? "Socially active vibe—may need stronger time management vs your academic preference."
        : "气质偏社交活跃——若您偏好学术安静，需评估时间管理与专注度。";
    }
  }
  if (pref === "social") {
    if (socialish && !academicish) {
      return locale === "en"
        ? "Aligns with your social/party-friendly preference—verify clubs/Greek/city access on official pages."
        : "与您的社交/派对氛围偏好较一致——建议在官网核对社团、体育与城市社交资源。";
    }
    if (academicish && !socialish) {
      return locale === "en"
        ? "More academic/quiet than your social preference—check whether weekend life and clubs match what you want."
        : "气质偏学术安静——若您重视派对/社交氛围，该校周末生活可能不够活跃。";
    }
    if (academicish && socialish) {
      return locale === "en"
        ? "Mixed vibe (study + some social)—confirm party/weekend culture on official pages vs your social preference."
        : "学业与社交并存，但派对氛围可能有限——若您偏好活跃社交，建议核对周末/社团资源是否足够。";
    }
  }
  if (pref === "balanced") {
    return locale === "en"
      ? "Check whether this school balances coursework and social life the way you want."
      : "建议核对该校学业强度与社交生活是否达到您想要的平衡。";
  }
  return null;
}
