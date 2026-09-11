export function devSeedCounselorEnabled(env = process.env) {
  const isProd = env.NODE_ENV === "production" || Boolean(env.VERCEL);
  if (isProd) return false;
  return /^(1|true|yes)$/i.test(String(env.ENABLE_DEV_SEED_COUNSELOR || "").trim());
}
