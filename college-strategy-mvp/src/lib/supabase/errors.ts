import type { PostgrestError } from "@supabase/supabase-js";

export function isSchemaMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as PostgrestError).code;
  const message = (error as PostgrestError).message ?? "";
  return code === "PGRST205" || /saved_applications/i.test(message);
}

export function formatSupabaseError(error: unknown, t: (key: string) => string): string {
  if (isSchemaMissingError(error)) return t("auth.schemaMissing");
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error && typeof (error as PostgrestError).message === "string"
        ? (error as PostgrestError).message
        : "";

  const m = message.toLowerCase();
  if (m.includes("jwt") || m.includes("session") || m.includes("auth")) {
    return t("auth.errSessionExpired");
  }
  return t("auth.errCloudAction");
}
