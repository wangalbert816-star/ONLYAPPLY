import type { Locale } from "../../i18n/strings";
import type { AdminEvalCase } from "./crmAdminApi";
import { getEvalCaseI18nOverlay } from "./evalCaseI18nOverlay";

/** Pick questionnaire JSON for admin display based on UI locale. */
export function getEvalCaseReportBody(
  evalCase: AdminEvalCase,
  uiLocale: Locale,
): Record<string, unknown> {
  const overlay = getEvalCaseI18nOverlay(evalCase.caseKey);
  if (uiLocale === "en") {
    if (evalCase.reportBodyEn && typeof evalCase.reportBodyEn === "object") return evalCase.reportBodyEn;
    if (overlay?.reportBodyEn) return overlay.reportBodyEn;
    if (evalCase.locale === "en") return evalCase.reportBody ?? {};
  }
  return evalCase.reportBody ?? {};
}

export function getEvalCaseTitle(evalCase: AdminEvalCase, uiLocale: Locale): string {
  if (uiLocale === "en") {
    if (evalCase.titleEn?.trim()) return evalCase.titleEn.trim();
    const overlay = getEvalCaseI18nOverlay(evalCase.caseKey);
    if (overlay?.titleEn) return overlay.titleEn;
  }
  return evalCase.title;
}

export function getEvalCaseNotes(evalCase: AdminEvalCase, uiLocale: Locale): string | null {
  if (uiLocale === "en") {
    if (evalCase.notesEn?.trim()) return evalCase.notesEn.trim();
    const overlay = getEvalCaseI18nOverlay(evalCase.caseKey);
    if (overlay?.notesEn) return overlay.notesEn;
  }
  return evalCase.notes;
}

export function joinList(items: string[], uiLocale: Locale): string {
  if (!items.length) return "";
  return uiLocale === "en" ? items.join(", ") : items.join("、");
}
