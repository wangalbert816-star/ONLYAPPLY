import type { Locale } from "../i18n/strings";
import type { FormState, ReportPayload, SupplementaryNote } from "../types";
import { normalizeFormState } from "./formState";
import {
  createPendingSaveAutoSaveIntent,
  pendingSaveAutoSaveIntentMatches,
  type PendingSaveAutoSaveIntent,
} from "./pendingSaveIntent";

const KEY = "college_strategy_pending_save_v1";
const AUTO_SAVE_INTENT_KEY = `${KEY}:auto_save_intent`;
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export type PendingSavePayload = {
  form: FormState;
  locale: Locale;
  report: ReportPayload;
  supplementaryNotes?: SupplementaryNote[];
  reportUnlocked?: boolean;
  alumniFeedback?: boolean;
  savedAt: number;
};

export function writePendingSave(payload: Omit<PendingSavePayload, "savedAt">) {
  try {
    const data: PendingSavePayload = { ...payload, savedAt: Date.now() };
    sessionStorage.removeItem(AUTO_SAVE_INTENT_KEY);
    localStorage.setItem(KEY, JSON.stringify(data));
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function markPendingSaveAutoSaveIntent() {
  try {
    const pending = readPendingSave();
    const intent = createPendingSaveAutoSaveIntent(pending?.savedAt);
    if (!intent) return;
    sessionStorage.setItem(AUTO_SAVE_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
}

export function consumePendingSaveAutoSaveIntent(pending: PendingSavePayload | null): boolean {
  try {
    const raw = sessionStorage.getItem(AUTO_SAVE_INTENT_KEY);
    sessionStorage.removeItem(AUTO_SAVE_INTENT_KEY);
    if (!raw || !pending) return false;
    const intent = JSON.parse(raw) as PendingSaveAutoSaveIntent;
    return pendingSaveAutoSaveIntentMatches(intent, pending.savedAt);
  } catch {
    try {
      sessionStorage.removeItem(AUTO_SAVE_INTENT_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }
}

export function readPendingSave(): PendingSavePayload | null {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSavePayload;
    if (!parsed?.form || !parsed?.report) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) {
      clearPendingSave();
      return null;
    }
    // Normalize the restored form so a corrupt/partial draft (e.g. geoPrefs: null)
    // cannot crash report/account/wizard rendering downstream.
    return { ...parsed, form: normalizeFormState(parsed.form) };
  } catch {
    return null;
  }
}

export function clearPendingSave() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(AUTO_SAVE_INTENT_KEY);
  } catch {
    /* ignore */
  }
}
