import type { TranscriptSheet } from "../types";
import { emptyTranscriptSheet, parseTranscriptTextHeuristic } from "./transcriptSheet";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const PARSE_TIMEOUT_MS = 280_000;

function hasUsableTranscriptData(sheet: Partial<TranscriptSheet>): boolean {
  const hasGpa = Boolean(sheet.unweightedGpa?.trim() || sheet.weightedGpa?.trim());
  const hasCourse = sheet.courses?.some((c) => c.courseName?.trim());
  return Boolean(hasGpa || hasCourse);
}

export async function parseTranscriptFile(file: File, locale: "en" | "zh" = "zh"): Promise<TranscriptSheet> {
  const base = emptyTranscriptSheet();
  base.fileName = file.name;
  base.parseStatus = "parsing";

  if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".csv")) {
    const text = await file.text();
    return mergeParseResult(base, parseTranscriptTextHeuristic(text));
  }

  try {
    const payload = await prepareUploadPayload(file);
    const res = await fetchWithTimeout(`${API_BASE}/api/transcript/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: payload.mimeType,
        dataBase64: payload.dataBase64,
        locale,
      }),
    }, PARSE_TIMEOUT_MS);
    const data = (await res.json().catch(() => ({}))) as {
      sheet?: Partial<TranscriptSheet>;
      error?: string;
      hint?: string;
      warning?: string;
    };
    if (!res.ok) {
      const merged = mergeParseResult(base, data.sheet ?? {});
      if (hasUsableTranscriptData(merged)) {
        merged.parseStatus = "ready";
        merged.parseError = data.warning || data.error || "";
        if (data.hint && !merged.parseError.includes(data.hint)) {
          merged.parseError = merged.parseError ? `${merged.parseError}\n${data.hint}` : data.hint;
        }
      } else {
        merged.parseStatus = "failed";
        merged.parseError = data.error || `parse_failed_${res.status}`;
        if (data.hint) merged.parseError = `${merged.parseError}\n${data.hint}`;
      }
      return merged;
    }
    const merged = mergeParseResult(base, data.sheet ?? {});
    if (data.warning) merged.parseError = data.warning;
    return merged;
  } catch (e) {
    base.parseStatus = "failed";
    if (e instanceof Error && e.name === "AbortError") {
      base.parseError = "vision_timeout";
    } else {
      base.parseError = e instanceof Error ? e.message : "parse_failed";
    }
    return base;
  }
}

export function parseTranscriptPaste(text: string): TranscriptSheet {
  const base = emptyTranscriptSheet();
  return mergeParseResult(base, parseTranscriptTextHeuristic(text));
}

function mergeParseResult(base: TranscriptSheet, partial: Partial<TranscriptSheet>): TranscriptSheet {
  return {
    ...base,
    ...partial,
    courses: partial.courses ?? base.courses,
    parseStatus: partial.parseStatus ?? (partial.courses?.length ? "ready" : "failed"),
    parseError: partial.parseError ?? "",
  };
}

async function prepareUploadPayload(file: File): Promise<{ dataBase64: string; mimeType: string }> {
  const isImage =
    file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (isImage) {
    try {
      return await compressImageForVision(file);
    } catch {
      // Fall back to original bytes if canvas compression fails.
    }
  }

  let mimeType = file.type || "application/octet-stream";
  if (mimeType === "application/octet-stream" && file.name.toLowerCase().endsWith(".pdf")) {
    mimeType = "application/pdf";
  }
  return { dataBase64: await readFileAsBase64(file), mimeType };
}

async function compressImageForVision(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<{ dataBase64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("compress_failed");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("compress_failed"))),
      "image/jpeg",
      quality,
    );
  });
  return { dataBase64: await blobToBase64(blob), mimeType: "image/jpeg" };
}

function readFileAsBase64(file: File): Promise<string> {
  return blobToBase64(file);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(blob);
  });
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}
