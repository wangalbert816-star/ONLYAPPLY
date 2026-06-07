import type { ActivityItem } from "../types";
import { normalizeParsedActivities, parseActivitiesTextHeuristic, type ActivitiesParseResult } from "./activitiesParseHeuristic";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const PARSE_TIMEOUT_MS = 150_000;

export type ActivitiesParseResponse = ActivitiesParseResult & {
  fileName?: string;
  method?: string;
  hint?: string;
};

export async function parseActivitiesFile(file: File, locale: "en" | "zh" = "zh"): Promise<ActivitiesParseResponse> {
  const base: ActivitiesParseResponse = {
    activities: [],
    parseStatus: "failed",
    parseError: "",
    fileName: file.name,
  };

  if (
    file.type.startsWith("text/") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".tsv")
  ) {
    const text = await file.text();
    return { ...parseActivitiesTextHeuristic(text), fileName: file.name };
  }

  try {
    const payload = await prepareUploadPayload(file);
    const res = await fetchWithTimeout(`${API_BASE}/api/activities/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: payload.mimeType,
        dataBase64: payload.dataBase64,
        locale,
      }),
    }, PARSE_TIMEOUT_MS);
    const data = (await res.json().catch(() => ({}))) as ActivitiesParseResponse & { error?: string };
    if (!res.ok) {
      const merged = mergeParseResult(base, data);
      merged.parseStatus = "failed";
      merged.parseError = data.error || data.parseError || `parse_failed_${res.status}`;
      if (data.hint) merged.parseError = `${merged.parseError}\n${data.hint}`;
      return merged;
    }
    return mergeParseResult(base, data);
  } catch (e) {
    const failed: ActivitiesParseResponse = { ...base, parseStatus: "failed" };
    if (e instanceof Error && e.name === "AbortError") {
      failed.parseError = "vision_timeout";
    } else {
      failed.parseError = e instanceof Error ? e.message : "parse_failed";
    }
    return failed;
  }
}

export function parseActivitiesPaste(text: string): ActivitiesParseResponse {
  return parseActivitiesTextHeuristic(text);
}

function mergeParseResult(base: ActivitiesParseResponse, partial: Partial<ActivitiesParseResponse>): ActivitiesParseResponse {
  const activities = partial.activities ?? base.activities;
  return {
    ...base,
    ...partial,
    activities: normalizeParsedActivities(activities as unknown[]),
    parseStatus:
      partial.parseStatus ??
      (activities?.length ? "ready" : ("failed" as ActivitiesParseResult["parseStatus"])),
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

export function activitiesParseSucceeded(result: Pick<ActivitiesParseResponse, "activities" | "parseStatus">): boolean {
  return result.parseStatus === "ready" && (result.activities?.length ?? 0) > 0;
}

export function ensureMinimumActivities(items: ActivityItem[]): ActivityItem[] {
  return items.length > 0 ? items : [];
}
