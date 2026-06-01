const GOOGLE_DOCS_HOST = "docs.google.com";

const GOOGLE_DOC_PATHS = [
  { kind: "spreadsheets", pattern: /^\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/ },
  { kind: "document", pattern: /^\/document\/d\/([a-zA-Z0-9-_]+)/ },
  { kind: "presentation", pattern: /^\/presentation\/d\/([a-zA-Z0-9-_]+)/ },
  { kind: "forms", pattern: /^\/forms\/d\/([a-zA-Z0-9-_]+)/ },
] as const;

export type GoogleDocsFileKind = (typeof GOOGLE_DOC_PATHS)[number]["kind"];

export function parseGoogleDocsUrl(raw: string): { fileId: string; kind: GoogleDocsFileKind } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  if (host !== GOOGLE_DOCS_HOST) return null;

  for (const entry of GOOGLE_DOC_PATHS) {
    const match = url.pathname.match(entry.pattern);
    if (match?.[1]) return { fileId: match[1], kind: entry.kind };
  }

  return null;
}

/** Normalize a Google Sheets share URL to a canonical https edit link. */
export function normalizeGoogleSheetUrl(raw: string): string | null {
  const parsed = parseGoogleDocsUrl(raw);
  if (!parsed || parsed.kind !== "spreadsheets") return null;
  return `https://docs.google.com/spreadsheets/d/${parsed.fileId}/edit`;
}

export function validateGoogleSheetUrl(raw: string): { ok: true; url: string } | { ok: false; code: "library_sheet_url_invalid" } {
  const normalized = normalizeGoogleSheetUrl(raw);
  if (!normalized) return { ok: false, code: "library_sheet_url_invalid" };
  return { ok: true, url: normalized };
}

/** Turn a Google Docs/Sheets/Slides URL into a force-copy link (prompts user to save their own copy). */
export function toGoogleCopyUrl(raw: string): string {
  const parsed = parseGoogleDocsUrl(raw);
  if (!parsed) return raw.trim();
  return `https://docs.google.com/${parsed.kind}/d/${parsed.fileId}/copy`;
}

export function isGoogleDocsUrl(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return parseGoogleDocsUrl(raw) != null;
}

export function openGoogleLibraryLink(raw: string): void {
  window.open(toGoogleCopyUrl(raw), "_blank", "noopener,noreferrer");
}
