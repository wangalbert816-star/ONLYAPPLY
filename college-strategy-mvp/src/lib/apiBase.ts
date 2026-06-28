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

/**
 * fetch with a hard client-side timeout via AbortController. Report generation is
 * long-running, so without this a stalled connection leaves the UI's loading
 * state stuck forever. The default (310s) is just above the server LLM timeout
 * (~290s) and Vite proxy cap (300s) so a real server error/response still wins;
 * the abort only fires if the whole pipe is dead.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 310_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
