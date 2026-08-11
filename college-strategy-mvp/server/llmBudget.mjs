export function resolveVercelLlmWallMs(env = process.env) {
  const fromEnv = Number(env.VERCEL_LLM_WALL_MS);
  if (fromEnv > 0) return fromEnv;
  if (!env.VERCEL) return 0;

  const functionMaxSec = Number(env.VERCEL_FUNCTION_MAX_SEC || 300);
  return Math.max(60_000, functionMaxSec * 1000 - 15_000);
}

export function resolveLlmTimeoutMs(env = process.env, vercelLlmWallMs = resolveVercelLlmWallMs(env)) {
  const configured = Number(env.LLM_TIMEOUT_MS || 0);
  if (env.VERCEL && vercelLlmWallMs > 0) {
    return configured > 0 ? Math.min(configured, vercelLlmWallMs) : vercelLlmWallMs;
  }
  return configured > 0 ? configured : 240_000;
}

export function resolveReportWallMs(
  env = process.env,
  { vercelLlmWallMs = resolveVercelLlmWallMs(env) } = {},
) {
  const configured = Number(env.REPORT_WALL_MS || 0);
  if (configured > 0) return configured;
  if (env.VERCEL && vercelLlmWallMs > 0) return vercelLlmWallMs;
  return 0;
}

export function createReportDeadlineMs(nowMs = Date.now(), reportWallMs = resolveReportWallMs()) {
  return reportWallMs > 0 ? nowMs + reportWallMs : undefined;
}
