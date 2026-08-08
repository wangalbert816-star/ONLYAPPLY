import type { FormState } from "../types";
import { normalizeFormState } from "./formState";

const KEY = "college_strategy_form_draft_v2";
const LEGACY_KEY = "college_strategy_form_draft_v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export type FormDraftPayload = {
  form: FormState;
  step: number;
  step1Screen?: number;
  step2Screen?: number;
  step3Screen?: number;
  flowStarted: boolean;
  savedAt: number;
};

export type WizardDraftBootstrap = {
  form: FormState;
  step: number;
  step1Screen: number;
  step2Screen: number;
  step3Screen: number;
  flowStarted: boolean;
  restored: boolean;
};

function readRawDraft(): FormDraftPayload | null {
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (const key of [KEY, LEGACY_KEY]) {
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as FormDraftPayload;
        if (!parsed?.form) continue;
        if (typeof parsed.step !== "number" || parsed.step < 1 || parsed.step > 3) continue;
        if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) continue;
        return parsed;
      }
    }
  } catch {
    /* ignore malformed storage */
  }
  return null;
}

export function formDraftHasProgress(form: FormState): boolean {
  if (
    form.intakeTerm ||
    form.applicantIdentity ||
    form.citizenship?.trim() ||
    form.residenceRegion?.trim() ||
    form.budget ||
    form.testing ||
    form.satScore?.trim() ||
    form.actScore?.trim() ||
    form.highSchoolSystem?.trim() ||
    form.currentHighSchool?.trim() ||
    form.gpa?.trim() ||
    form.gpaTrend ||
    form.languageScores?.trim() ||
    form.majorPrimary?.trim() ||
    form.majorSecondary?.trim() ||
    form.schoolSize ||
    form.campusCulturePref ||
    form.riskStyle ||
    form.dealbreakers?.trim() ||
    form.activities?.trim()
  ) {
    return true;
  }
  if ((form.geoPrefs?.length ?? 0) > 0) return true;
  if ((form.academicSpecialFlags?.length ?? 0) > 0) return true;
  if (form.academicSpecialNotes?.trim()) return true;
  if ((form.structuredActivities?.length ?? 0) > 0) {
    return form.structuredActivities!.some((item) =>
      [item.name, item.description, item.role, item.outcome, item.award, item.proof].some((v) => String(v || "").trim()),
    );
  }
  const sheet = form.transcriptSheet;
  if (sheet?.skipped) return true;
  if (sheet?.fileName?.trim()) return true;
  if ((sheet?.courses?.length ?? 0) > 0) return true;
  if (sheet?.unweightedGpa?.trim() || sheet?.weightedGpa?.trim() || sheet?.gradingScale) return true;
  return false;
}

export function restoreWizardDraft(fallbackForm: FormState): WizardDraftBootstrap {
  const draft = readRawDraft();
  if (!draft) {
    return {
      form: fallbackForm,
      step: 1,
      step1Screen: 0,
      step2Screen: 0,
      step3Screen: 0,
      flowStarted: false,
      restored: false,
    };
  }

  const form = normalizeFormState(draft.form);
  const hasProgress = formDraftHasProgress(form);
  const step = draft.step;
  const resumeFlow = Boolean(draft.flowStarted && hasProgress);

  return {
    form,
    step,
    step1Screen: Math.max(0, draft.step1Screen ?? 0),
    step2Screen: Math.max(0, draft.step2Screen ?? 0),
    step3Screen: Math.max(0, draft.step3Screen ?? 0),
    flowStarted: resumeFlow,
    restored: hasProgress,
  };
}

export function newerFormDraftHasProgress(savedAt: number | undefined): boolean {
  const draft = readRawDraft();
  if (!draft || typeof draft.savedAt !== "number" || draft.savedAt <= (savedAt ?? 0)) return false;
  return formDraftHasProgress(normalizeFormState(draft.form));
}

export function writeFormDraft(payload: Omit<FormDraftPayload, "savedAt">) {
  if (!formDraftHasProgress(payload.form) && !payload.flowStarted) return;
  try {
    const data: FormDraftPayload = { ...payload, savedAt: Date.now() };
    const raw = JSON.stringify(data);
    localStorage.setItem(KEY, raw);
    sessionStorage.setItem(KEY, raw);
    localStorage.removeItem(LEGACY_KEY);
    sessionStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readFormDraft(): FormDraftPayload | null {
  return readRawDraft();
}

export function clearFormDraft() {
  try {
    for (const key of [KEY, LEGACY_KEY]) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
