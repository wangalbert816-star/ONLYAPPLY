/** Normalize API / Supabase errors into a string for JSON responses. */

export function extractErrorMessage(error) {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "unknown_error";
  if (typeof error === "object") {
    const msg = error.message;
    if (typeof msg === "string" && msg.trim()) return msg;
    const details = error.details;
    if (typeof details === "string" && details.trim()) return details;
    const hint = error.hint;
    if (typeof hint === "string" && hint.trim()) return hint;
    const code = error.code;
    if (typeof code === "string" && code.trim()) return code;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown_error";
  }
}

export function isForeignKeyError(error) {
  if (!error || typeof error !== "object") return false;
  const code = error.code;
  const message = String(error.message ?? "");
  return code === "23503" || /foreign key constraint/i.test(message);
}
