export function resolveStripeSiteUrl(env = process.env) {
  let siteUrl = String(env.SITE_URL || "").trim().replace(/\/$/, "");
  if (siteUrl && !/^https?:\/\//i.test(siteUrl)) {
    siteUrl = `https://${siteUrl}`;
  }
  if (!siteUrl && env.VERCEL_PROJECT_PRODUCTION_URL) {
    siteUrl = `https://${String(env.VERCEL_PROJECT_PRODUCTION_URL).trim().replace(/^https?:\/\//i, "")}`;
  }
  if (!siteUrl && env.VERCEL_URL) {
    siteUrl = `https://${String(env.VERCEL_URL).trim().replace(/^https?:\/\//i, "")}`;
  }
  return siteUrl;
}

export function readStripeEnv(env = process.env) {
  return {
    secret: String(env.STRIPE_SECRET_KEY || "").trim(),
    webhookSecret: String(env.STRIPE_WEBHOOK_SECRET || "").trim(),
    priceId: String(env.STRIPE_PRICE_ID || "").trim(),
    essayAnalysisPriceId: String(env.STRIPE_ESSAY_ANALYSIS_PRICE_ID || "").trim(),
    essaySubscriptionPriceId: String(env.STRIPE_ESSAY_SUBSCRIPTION_PRICE_ID || "").trim(),
    siteUrl: resolveStripeSiteUrl(env),
  };
}

export function stripeReadyForCheckoutEnv(stripeEnv, hasSupabaseAdmin) {
  return Boolean(
    stripeEnv?.secret &&
      stripeEnv?.webhookSecret &&
      stripeEnv?.priceId &&
      stripeEnv?.siteUrl &&
      hasSupabaseAdmin,
  );
}

export function stripeReadyForEssayAnalysisCheckoutEnv(stripeEnv, hasSupabaseAdmin) {
  return Boolean(
    stripeEnv?.secret &&
      stripeEnv?.webhookSecret &&
      stripeEnv?.essayAnalysisPriceId &&
      stripeEnv?.siteUrl &&
      hasSupabaseAdmin,
  );
}

export function stripeConfigStatusFromEnv(stripeEnv, hasSupabaseAdmin) {
  const { secret, webhookSecret, priceId, essayAnalysisPriceId, siteUrl } = stripeEnv;
  const blockers = [];
  const essayBlockers = [];
  if (!secret) blockers.push("STRIPE_SECRET_KEY");
  if (!priceId) blockers.push("STRIPE_PRICE_ID");
  if (!siteUrl) blockers.push("SITE_URL");
  if (!hasSupabaseAdmin) blockers.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret) blockers.push("STRIPE_WEBHOOK_SECRET");
  if (!secret) essayBlockers.push("STRIPE_SECRET_KEY");
  if (!essayAnalysisPriceId) essayBlockers.push("STRIPE_ESSAY_ANALYSIS_PRICE_ID");
  if (!siteUrl) essayBlockers.push("SITE_URL");
  if (!hasSupabaseAdmin) essayBlockers.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret) essayBlockers.push("STRIPE_WEBHOOK_SECRET");
  return {
    createCheckoutSession: stripeReadyForCheckoutEnv(stripeEnv, hasSupabaseAdmin),
    createEssayAnalysisCheckoutSession: stripeReadyForEssayAnalysisCheckoutEnv(stripeEnv, hasSupabaseAdmin),
    webhookVerified: Boolean(secret && webhookSecret),
    envBlockers: blockers,
    essayEnvBlockers: essayBlockers,
  };
}
