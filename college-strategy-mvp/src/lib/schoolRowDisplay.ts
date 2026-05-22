/** Split LLM prose or list strings into scannable bullet lines */
export function splitToBullets(raw: string | string[] | undefined, maxItems = 6): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean).slice(0, maxItems);
  }
  const t = String(raw ?? "").trim();
  if (!t) return [];
  const lines = t
    .split(/\n+|(?:\s*[-•·]\s+)|(?:\s*;\s+)|(?<=\.)\s+(?=[A-Z\u4e00-\u9fff])/u)
    .map((x) => x.replace(/^[\d]+[.)]\s*/, "").trim())
    .filter((x) => x.length > 4);
  if (lines.length > 1) return lines.slice(0, maxItems);
  if (t.length > 160) {
    return t
      .split(/(?<=[。；.!?])\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 8)
      .slice(0, maxItems);
  }
  return [t];
}
