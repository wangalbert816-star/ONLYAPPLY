import type { Locale } from "../i18n/strings";
import type { FormState, ReportPayload, SupplementaryNote } from "../types";

const KEY = "college_strategy_pending_save_v1";

export type PendingSavePayload = {
  form: FormState;
  locale: Locale;
  report: ReportPayload;
  supplementaryNotes?: SupplementaryNote[];
  reportUnlocked?: boolean;
  savedAt: number;
};

export function writePendingSave(payload: Omit<PendingSavePayload, "savedAt">) {
  try {
    const data: PendingSavePayload = { ...payload, savedAt: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function readPendingSave(): PendingSavePayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSavePayload;
    if (!parsed?.form || !parsed?.report) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSave() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
