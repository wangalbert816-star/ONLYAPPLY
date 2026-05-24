import type { FormState, SchoolRow, SchoolTier } from "../types";
import type { Locale } from "../i18n/strings";
import { sanitizeSchoolRowTextFields } from "./admitRateSanitize";
import { sanitizeSchoolRowUndergradCopy } from "./undergradCopySanitize";
import { buildApplicantContextBullets, mergeContextNote } from "./applicantContextNotes";
import { snippetCampusVibe, snippetContextNote } from "./schoolProfileSnippets";

/** 去掉 LLM/旧逻辑误塞进 differentiation 的 prompt 指令句 */
function stripPromptLeakFromDifferentiation(text: string): string {
  return text
    .replace(
      /偏好[^。]*?(campus_vibe\/differentiation|在\s*campus_vibe|社区气质偏好)[^。]*[。]?/gi,
      "",
    )
    .replace(
      /Prefers[^.]*?(campus_vibe\/differentiation|campus community preference)[^.]*\.?/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function userFacingGeoSizeHint(form: FormState, locale: Locale): string | null {
  const parts: string[] = [];
  if (form.schoolSize === "small") parts.push(locale === "en" ? "You prefer smaller campuses." : "你偏好规模较小的校园。");
  else if (form.schoolSize === "large") parts.push(locale === "en" ? "You prefer larger universities." : "你偏好大型大学。");
  if (form.geoPrefs?.includes("west")) {
    parts.push(locale === "en" ? "West Coast preference noted." : "问卷中体现了西部地区偏好。");
  }
  return parts.length ? parts.join(" ") : null;
}

/** 合并 LLM 输出、申请者语境与本地 curated 片段（第二/三期） */
export function enrichSchoolRow(row: SchoolRow, form: FormState, locale: Locale, tier: SchoolTier = "match"): SchoolRow {
  const campus_vibe = (row.campus_vibe || "").trim() || snippetCampusVibe(row.school, locale) || undefined;
  const snippetCtx = snippetContextNote(row.school, locale);
  const applicantBullets = buildApplicantContextBullets(form, row.school, locale);
  const context_note = mergeContextNote(
    (row.context_note || "").trim() || snippetCtx || undefined,
    applicantBullets,
    locale,
  );
  let differentiation = stripPromptLeakFromDifferentiation((row.differentiation || "").trim()) || undefined;
  const hint = userFacingGeoSizeHint(form, locale);
  if (hint && differentiation && !differentiation.includes(hint)) {
    differentiation = `${differentiation} ${hint}`;
  }

  const merged: SchoolRow = {
    ...row,
    campus_vibe,
    differentiation,
    context_note: context_note || undefined,
  };
  const sanitized = sanitizeSchoolRowTextFields({ ...merged } as Record<string, unknown>, locale);
  const facultySafe = sanitizeSchoolRowUndergradCopy(
    {
      ...merged,
      campus_vibe: sanitized.campus_vibe as string | undefined,
      differentiation: sanitized.differentiation as string | undefined,
      context_note: sanitized.context_note as string | undefined,
      why_reach_for_you: sanitized.why_reach_for_you as string | undefined,
      why_match_for_you: sanitized.why_match_for_you as string | undefined,
      why_safety_for_you: sanitized.why_safety_for_you as string | undefined,
      key_fit_signals: (sanitized.key_fit_signals as string[]) ?? merged.key_fit_signals,
      key_risks: (sanitized.key_risks as string[]) ?? merged.key_risks,
      verification_focus: (sanitized.verification_focus as string[]) ?? merged.verification_focus,
    },
    tier,
    locale,
  );
  return facultySafe;
}
