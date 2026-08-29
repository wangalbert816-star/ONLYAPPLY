export const PENDING_SAVE_AUTO_SAVE_INTENT_MAX_AGE_MS = 30 * 60 * 1000;

export type PendingSaveAutoSaveIntent = {
  savedAt: number;
  requestedAt: number;
};

export function createPendingSaveAutoSaveIntent(
  pendingSavedAt: number | undefined,
  requestedAt = Date.now(),
): PendingSaveAutoSaveIntent | null {
  if (!Number.isFinite(pendingSavedAt) || !pendingSavedAt || pendingSavedAt <= 0) return null;
  return { savedAt: pendingSavedAt, requestedAt };
}

export function pendingSaveAutoSaveIntentMatches(
  intent: PendingSaveAutoSaveIntent | null | undefined,
  pendingSavedAt: number | undefined,
  now = Date.now(),
): boolean {
  if (!intent || !Number.isFinite(pendingSavedAt) || !pendingSavedAt) return false;
  if (intent.savedAt !== pendingSavedAt) return false;
  const age = now - intent.requestedAt;
  return age >= 0 && age <= PENDING_SAVE_AUTO_SAVE_INTENT_MAX_AGE_MS;
}
