/** Report / engine helpers — confirmed transcript sheet overrides freeform GPA text. */

export function transcriptSheetIsAuthoritative(sheet) {
  if (!sheet || sheet.skipped || !sheet.confirmedAt) return false;
  const courses = Array.isArray(sheet.courses) ? sheet.courses : [];
  const hasCourse = courses.some(
    (c) => String(c?.courseName ?? "").trim() && String(c?.grade ?? "").trim(),
  );
  const hasGpa = Boolean(
    String(sheet.unweightedGpa ?? "").trim() || String(sheet.weightedGpa ?? "").trim(),
  );
  return hasCourse || hasGpa;
}

export function gpaNumbersFromSheet(sheet) {
  if (!sheet) return { unweighted: null, weighted: null };
  const uw = Number(String(sheet.unweightedGpa ?? "").trim());
  const w = Number(String(sheet.weightedGpa ?? "").trim());
  return {
    unweighted: Number.isFinite(uw) && uw > 0 && uw <= 5.5 ? uw : null,
    weighted: Number.isFinite(w) && w > 0 && w <= 6 ? w : null,
  };
}

/** GPA string for band parsing / tier hints — prefers confirmed grade sheet. */
export function resolveGpaTextForAnalysis(body) {
  const sheet = body?.transcriptSheet;
  if (transcriptSheetIsAuthoritative(sheet)) {
    const { unweighted, weighted } = gpaNumbersFromSheet(sheet);
    const parts = [];
    if (unweighted != null) parts.push(`UW ${unweighted}`);
    if (weighted != null) parts.push(`W ${weighted}`);
    if (parts.length) return parts.join(" ");
  }
  return String(body?.gpa ?? "").trim();
}

export function buildGpaPromptSection(body, locale, formatTranscriptSheetBlock) {
  const isEn = locale === "en";
  const na = isEn ? "Not provided" : "未填";
  const sheet = body?.transcriptSheet;
  const transcriptBlock = formatTranscriptSheetBlock(sheet, locale) || "";
  const freeform = String(body?.gpa ?? "").trim();

  if (!transcriptSheetIsAuthoritative(sheet)) {
    return { gpaLine: freeform || na, transcriptBlock };
  }

  const { unweighted, weighted } = gpaNumbersFromSheet(sheet);
  const headline = [];
  if (unweighted != null) headline.push(isEn ? `UW ${unweighted}` : `未加权 ${unweighted}`);
  if (weighted != null) headline.push(isEn ? `W ${weighted}` : `加权 ${weighted}`);

  const gpaLine = isEn
    ? `Structured grade sheet confirmed — authoritative for GPA and course rigor.${headline.length ? ` Headline: ${headline.join(", ")}.` : ""} Use every course row in the block below; do not invent courses or grades.`
    : `用户已确认结构化成绩表 — GPA 与课程 rigor 以此为准。${headline.length ? `摘要：${headline.join("，")}。` : ""}请使用下方课程明细，勿编造课程或成绩。`;

  const freeformNote =
    freeform && !transcriptBlock.includes(freeform.slice(0, 40))
      ? isEn
        ? `\n[Optional context notes — secondary to grade sheet] ${freeform}`
        : `\n【补充说明（次要，成绩表优先）】${freeform}`
      : "";

  return { gpaLine: gpaLine + freeformNote, transcriptBlock };
}

function parseGpaNumbersFromText(gpaText) {
  const t = String(gpaText || "").trim();
  if (!t) return { unweighted: null, weighted: null };
  let unweighted = null;
  let weighted = null;
  const gpaNumber = String.raw`(\d(?:\.\d{1,2})?)`;
  const scale = String.raw`(?:\s*/\s*[456](?:\.0)?)?`;
  const uwLabel = String.raw`(?:\b(?:unweighted|uw)\b|未加权|非加权)`;
  const wLabel = String.raw`(?:\b(?:weighted|w)\b|加权)`;
  const readLabeled = (label, max) => {
    const after = t.match(new RegExp(`${label}\\s*[:=]?\\s*${gpaNumber}${scale}\\b`, "i"));
    const before = t.match(new RegExp(`\\b${gpaNumber}${scale}\\s*${label}`, "i"));
    const n = Number((after ?? before)?.[1]);
    return Number.isFinite(n) && n > 0 && n <= max ? n : null;
  };
  unweighted = readLabeled(uwLabel, 5.5);
  weighted = readLabeled(wLabel, 6);
  const all = [...t.matchAll(/\b([1-4]\.\d{1,2})\b/g)].map((m) => Number(m[1]));
  if (unweighted == null && all.length) unweighted = Math.min(...all);
  if (weighted == null && all.length > 1) weighted = Math.max(...all);
  if (weighted == null && all.length === 1) weighted = all[0];
  return { unweighted, weighted };
}

/** Prefer confirmed grade sheet GPA fields, then freeform text. */
export function resolveGpaNumbersFromBody(body) {
  const sheet = body?.transcriptSheet;
  if (transcriptSheetIsAuthoritative(sheet)) {
    const fromSheet = gpaNumbersFromSheet(sheet);
    if (fromSheet.unweighted != null || fromSheet.weighted != null) return fromSheet;
  }
  return parseGpaNumbersFromText(String(body?.gpa ?? ""));
}

/** Single UW-like GPA for tier hints — prefers confirmed grade sheet. */
export function parseGpaNumberFromBody(body) {
  const { unweighted, weighted } = resolveGpaNumbersFromBody(body);
  return unweighted ?? weighted;
}
