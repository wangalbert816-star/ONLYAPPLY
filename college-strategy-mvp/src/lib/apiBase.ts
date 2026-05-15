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
