export type CrmMeetingRecapContentV2 = {
  v: 2;
  actionItems: string;
  resources: string;
  summary: string;
  recordingUrl?: string;
};

export type CrmMeetingRecapDraft = {
  title: string;
  heldAt?: string;
  actionItems: string;
  resources: string;
  summary: string;
  recordingUrl?: string;
};

export function serializeMeetingRecapBody(content: Omit<CrmMeetingRecapContentV2, "v">): string {
  const payload: CrmMeetingRecapContentV2 = {
    v: 2,
    actionItems: content.actionItems.trim(),
    resources: content.resources.trim(),
    summary: content.summary.trim(),
    recordingUrl: content.recordingUrl?.trim() || undefined,
  };
  return JSON.stringify(payload);
}

export function parseMeetingRecapBody(body: string): CrmMeetingRecapContentV2 | null {
  try {
    const parsed = JSON.parse(body) as Partial<CrmMeetingRecapContentV2>;
    if (parsed?.v !== 2) return null;
    return {
      v: 2,
      actionItems: String(parsed.actionItems ?? ""),
      resources: String(parsed.resources ?? ""),
      summary: String(parsed.summary ?? ""),
      recordingUrl: parsed.recordingUrl ? String(parsed.recordingUrl) : undefined,
    };
  } catch {
    return null;
  }
}

export function isLegacyMeetingRecapBody(body: string): boolean {
  return parseMeetingRecapBody(body) === null;
}

export function actionItemsToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}

export function isMeetingRecapDraftValid(draft: Pick<CrmMeetingRecapDraft, "title" | "summary" | "actionItems">): boolean {
  return Boolean(draft.title.trim() && (draft.summary.trim() || draft.actionItems.trim()));
}
