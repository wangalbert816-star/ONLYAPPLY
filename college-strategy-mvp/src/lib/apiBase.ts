/**
 * 开发 / vite preview：直连本地 Express（与 vite.config 中 loadEnv 的 PORT 同源），
 * 避免仅走 /api 代理时因端口不一致、代理未生效导致的 fetch 失败。
 * 生产构建 __DEV_API_ORIGIN__ 为空，仍用相对路径 /api。
 */
export function apiUrl(apiPath: string): string {
  const p = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (typeof __DEV_API_ORIGIN__ === "string" && __DEV_API_ORIGIN__.length > 0) {
    return `${__DEV_API_ORIGIN__}${p}`;
  }
  return p;
}

const configuredReportClientTimeoutMs = Number(import.meta.env.VITE_REPORT_CLIENT_TIMEOUT_MS || 0);
export const REPORT_CLIENT_TIMEOUT_MS =
  configuredReportClientTimeoutMs > 0 ? configuredReportClientTimeoutMs : 820_000;

/**
 * fetch with a hard client-side timeout via AbortController. Report generation is
 * long-running, so without this a stalled connection leaves the UI's loading state
 * stuck forever. The default covers the documented Vercel Pro 800s report budget;
 * local dev's Vite proxy may still return earlier at its own 300s cap.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = REPORT_CLIENT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
