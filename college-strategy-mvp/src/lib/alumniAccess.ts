const STORAGE_KEY = "onlyapply_alumni_access_granted";
const ACCESS_CODE = String(import.meta.env.VITE_ALUMNI_ACCESS_CODE ?? "").trim();

export function hasAlumniAccess(): boolean {
  if (!ACCESS_CODE) return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function grantAlumniAccess(): void {
  if (!ACCESS_CODE) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function verifyAlumniAccessCode(input: string): boolean {
  return Boolean(ACCESS_CODE) && input.trim() === ACCESS_CODE;
}
