import type { Locale } from "../i18n/strings";
import type { FormState, ReportPayload, SupplementaryNote } from "../types";

const KEY = "college_strategy_pending_save_v1";
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
    localStorage.setItem(KEY, JSON.stringify(data));
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
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
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSave() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
