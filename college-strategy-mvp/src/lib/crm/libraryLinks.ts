const SPREADSHEET_PATH = /^\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

/** Normalize a Google Sheets share URL to a canonical https edit link. */
export function normalizeGoogleSheetUrl(raw: string): string | null {
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
  if (host !== "docs.google.com") return null;

  const match = url.pathname.match(SPREADSHEET_PATH);
  if (!match?.[1]) return null;

  return `https://docs.google.com/spreadsheets/d/${match[1]}/edit`;
}

export function validateGoogleSheetUrl(raw: string): { ok: true; url: string } | { ok: false; code: "library_sheet_url_invalid" } {
  const normalized = normalizeGoogleSheetUrl(raw);
  if (!normalized) return { ok: false, code: "library_sheet_url_invalid" };
  return { ok: true, url: normalized };
}
