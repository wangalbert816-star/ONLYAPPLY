export function parseApiError(
  data: unknown,
  statusText: string,
): { code: string | null; message: string } {
  const raw = data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : null;
  if (typeof raw === "string") return { code: raw, message: raw };
  if (raw && typeof raw === "object") {
    const obj = raw as { message?: unknown; code?: unknown; details?: unknown };
    const message =
      typeof obj.message === "string"
        ? obj.message
        : typeof obj.details === "string"
          ? obj.details
          : null;
    const code = typeof obj.code === "string" ? obj.code : null;
    const fallback = statusText || "request_failed";
    return { code: code ?? message, message: message ?? code ?? fallback };
  }
  return { code: null, message: statusText || "request_failed" };
}

export function isUnreadableApiMessage(message: string): boolean {
  return !message || message === "[object Object]" || message === "request_failed";
}
