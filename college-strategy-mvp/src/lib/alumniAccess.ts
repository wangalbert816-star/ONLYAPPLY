const STORAGE_KEY = "onlyapply_alumni_access_granted";
const ACCESS_CODE = String(import.meta.env.VITE_ALUMNI_ACCESS_CODE ?? "031408").trim();

export function hasAlumniAccess(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function grantAlumniAccess(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function verifyAlumniAccessCode(input: string): boolean {
  return input.trim() === ACCESS_CODE;
}
