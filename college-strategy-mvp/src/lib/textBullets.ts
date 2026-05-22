/** 将模型返回的长段文字拆成要点列表，便于扫读 */
export function proseToBullets(text: string, maxItems = 6): string[] {
  const raw = (text || "").trim();
  if (!raw) return [];
  const byLine = raw
    .split(/\n+/)
    .map((s) => s.replace(/^[\s•·\-–—\d.)、]+/, "").trim())
    .filter((s) => s.length > 4);
  if (byLine.length >= 2) return byLine.slice(0, maxItems);
  const bySentence = raw
    .split(/[。；;]\s*|\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  if (bySentence.length >= 2) return bySentence.slice(0, maxItems);
  return [raw];
}
