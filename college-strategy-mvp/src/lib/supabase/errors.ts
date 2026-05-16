import type { PostgrestError } from "@supabase/supabase-js";

export function isSchemaMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as PostgrestError).code;
  const message = (error as PostgrestError).message ?? "";
  return code === "PGRST205" || /saved_applications/i.test(message);
}

export function formatSupabaseError(error: unknown, t: (key: string) => string): string {
  if (isSchemaMissingError(error)) return t("auth.schemaMissing");
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as PostgrestError).message === "string") {
    return (error as PostgrestError).message;
  }
  return t("auth.accountLoadErr");
}
