import type { FormState } from "../types";

const KEY = "college_strategy_form_draft_v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24;

export type FormDraftPayload = {
  form: FormState;
  step: number;
  flowStarted: boolean;
  savedAt: number;
};

export function writeFormDraft(payload: Omit<FormDraftPayload, "savedAt">) {
  try {
    const data: FormDraftPayload = { ...payload, savedAt: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readFormDraft(): FormDraftPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraftPayload;
    if (!parsed?.form || !parsed.flowStarted) return null;
    if (typeof parsed.step !== "number" || parsed.step < 1 || parsed.step > 3) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) {
      clearFormDraft();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearFormDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
