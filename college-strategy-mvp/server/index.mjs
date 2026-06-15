import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import Stripe from "stripe";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  buildImprovementPersonalizationHints,
  getIntakeHorizon,
  improvementPlanPromptBlock,
  improvementPlanUserContextLine,
} from "./intakeHorizon.mjs";
import {
  sanitizeUcAnalysisFromBody,
  ucAnalysisNeedsFallbackFromBody,
} from "./ucAnalysisSanitize.mjs";
import { sanitizeSchoolRowTextFields, sanitizeUnsourcedStats } from "./admitRateSanitize.mjs";
import {
  sanitizeSchoolRowUndergradCopy,
  sanitizeUndergradSchoolMentions,
} from "./undergradCopySanitize.mjs";
import { sanitizeReportTierDifferentiation } from "./tierDifferentiationSanitize.mjs";
import { coerceStringArray } from "./coerceStringArray.mjs";
import {
  autoRepairTopReferenceSchools,
  buildValidationRepairMessage,
  normalizeTopReferenceSchoolRows,
  validateMainSchoolReport,
} from "./topReferenceSchools.mjs";
import { CURATED_OFFICIAL_LINK_SCHOOL_COUNT, formatMajorGuideForPrompt } from "./knowledge/majorActivitySnippets.mjs";
import { structuredActivityBlob } from "./activityEvidence.mjs";
import {
  athleticRecruitmentHint,
  riskStyleCalibrationHint,
  statsTierCalibrationHint,
} from "./reportTierHints.mjs";
import { registerAdminCrmRoutes, crmAdminConfigured } from "./adminCrm.mjs";
import { registerAdminEvalRoutes } from "./adminEval.mjs";
import { buildFewShotPromptBlock } from "./trainingCorpus.mjs";
import {
  buildDecisionEnginePromptBlock,
  mergeDecisionSchoolsIntoReport,
  runDecisionEngineAsync,
} from "./decisionEngine.mjs";
import { registerTrainingCorpusRoutes } from "./trainingCorpusAdmin.mjs";
import { registerEngineStandardsRoutes } from "./engineStandardsAdmin.mjs";
import { ensureBenchmarksLoaded } from "./engineStandards.mjs";
import { registerCounselorCrmRoutes } from "./counselorCrm.mjs";
import { registerUsHighSchoolRoutes } from "./usHighSchools.mjs";
import { registerTranscriptParseRoutes, formatTranscriptSheetBlock } from "./transcriptParse.mjs";
import { registerActivitiesParseRoutes } from "./activitiesParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 始终从项目根目录加载 .env（避免从别的 cwd 启动 node 时读不到 OPENAI_BASE_URL，误连 OpenAI 官方导致 401）
dotenv.config({ path: path.join(__dirname, "..", ".env") });

/** 方舟 OpenAI 兼容网关（北京）；地域以控制台为准时可改 ARK_BASE_URL */
const DEFAULT_ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3";

/** 与 vercel.json functions.maxDuration 对齐；Hobby 上限 300s，Pro 可在控制台提到 800 并设 VERCEL_FUNCTION_MAX_SEC=800 */
const VERCEL_FUNCTION_MAX_SEC = Number(process.env.VERCEL_FUNCTION_MAX_SEC || 300);
/** OpenAI SDK 默认 maxRetries=2，超时/5xx 会重试，同一用户操作可能触发多次模型计费与更长等待 */
const VERCEL_LLM_WALL_MS = (() => {
  const fromEnv = Number(process.env.VERCEL_LLM_WALL_MS);
  if (fromEnv > 0) return fromEnv;
  if (process.env.VERCEL) return Math.max(60_000, VERCEL_FUNCTION_MAX_SEC * 1000 - 15_000);
  return 0;
})();
const LLM_TIMEOUT_MS = (() => {
  const configured = Number(process.env.LLM_TIMEOUT_MS || 0);
  if (process.env.VERCEL && VERCEL_LLM_WALL_MS > 0) {
    return configured > 0 ? Math.min(configured, VERCEL_LLM_WALL_MS) : VERCEL_LLM_WALL_MS;
  }
  return configured > 0 ? configured : 120_000;
})();
const LLM_MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES ?? 0);
/** 0 = 不传 max_tokens，由模型默认；报告 JSON 较大，默认给足输出避免截断 */
const COMPLETION_MAX_TOKENS = Number(process.env.COMPLETION_MAX_TOKENS ?? 16384);

const app = express();
const IS_PROD = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
app.use(cors({ origin: true }));

function resolveSiteUrl() {
  let siteUrl = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
  if (siteUrl && !/^https?:\/\//i.test(siteUrl)) {
    siteUrl = `https://${siteUrl}`;
  }
  if (!siteUrl && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    siteUrl = `https://${String(process.env.VERCEL_PROJECT_PRODUCTION_URL).trim().replace(/^https?:\/\//i, "")}`;
  }
  if (!siteUrl && process.env.VERCEL_URL) {
    siteUrl = `https://${String(process.env.VERCEL_URL).trim().replace(/^https?:\/\//i, "")}`;
  }
  return siteUrl;
}

function stripeEnv() {
  const secret = (process.env.STRIPE_SECRET_KEY || "").trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const priceId = (process.env.STRIPE_PRICE_ID || "").trim();
  const essayAnalysisPriceId = (process.env.STRIPE_ESSAY_ANALYSIS_PRICE_ID || "").trim();
  const essaySubscriptionPriceId = (process.env.STRIPE_ESSAY_SUBSCRIPTION_PRICE_ID || "").trim();
  const siteUrl = resolveSiteUrl();
  return { secret, webhookSecret, priceId, essayAnalysisPriceId, essaySubscriptionPriceId, siteUrl };
}

/** @returns {Promise<{ ok: true, price: import("stripe").Stripe.Price } | { ok: false, code: string, message: string }>} */
async function validateStripeCheckoutPrice(stripe, priceId) {
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      return { ok: false, code: "stripe_price_inactive", message: "Stripe price is inactive" };
    }
    if (price.type !== "one_time") {
      return {
        ok: false,
        code: "stripe_price_not_one_time",
        message: "Stripe price must be one-time for payment checkout",
      };
    }
    return { ok: true, price };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/expired api key/i.test(msg)) {
      return { ok: false, code: "stripe_key_expired", message: msg };
    }
    if (/no such price/i.test(msg)) {
      return { ok: false, code: "stripe_price_invalid", message: msg };
    }
    return { ok: false, code: "stripe_price_lookup_failed", message: msg };
  }
}

function mapStripeCheckoutError(msg) {
  if (/no such price/i.test(msg)) return "stripe_price_invalid";
  if (/invalid url|must be a valid url|fully qualified/i.test(msg)) return "stripe_site_url_invalid";
  if (/one_time|payment mode/i.test(msg)) return "stripe_price_not_one_time";
  if (/expired api key/i.test(msg)) return "stripe_key_expired";
  return IS_PROD ? "stripe_checkout_failed" : msg;
}

function redactStripeMessage(msg) {
  return String(msg || "")
    .replace(/sk_(live|test)_[A-Za-z0-9]+/gi, "sk_$1_***")
    .slice(0, 200);
}

function supabaseAdmin() {
  const url = (process.env.SUPABASE_URL || "").trim() || (process.env.VITE_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function supabaseUserClient(accessToken) {
  const url = (process.env.SUPABASE_URL || "").trim() || (process.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!url || !anonKey || !accessToken) return null;
  return createSupabaseAdmin(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function checkoutApplicationTitle(form, locale) {
  const intake = String(form?.intakeTerm || form?.intakeOtherDetail || "").trim();
  if (intake) return intake;
  return locale === "en" ? "Application profile" : "申请档案";
}

function stripeReadyForCheckout() {
  const { secret, priceId, siteUrl } = stripeEnv();
  return Boolean(secret && priceId && siteUrl && supabaseAdmin());
}

function stripeReadyForEssayAnalysisCheckout() {
  const { secret, essayAnalysisPriceId, siteUrl } = stripeEnv();
  return Boolean(secret && essayAnalysisPriceId && siteUrl && supabaseAdmin());
}

/** 自检：便于配环境；不向客户端泄漏密钥 */
function stripeConfigStatus() {
  const { secret, webhookSecret, priceId, essayAnalysisPriceId, siteUrl } = stripeEnv();
  const admin = supabaseAdmin();
  const blockers = [];
  const essayBlockers = [];
  if (!secret) blockers.push("STRIPE_SECRET_KEY");
  if (!priceId) blockers.push("STRIPE_PRICE_ID");
  if (!siteUrl) blockers.push("SITE_URL");
  if (!admin) blockers.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret) blockers.push("STRIPE_WEBHOOK_SECRET");
  if (!secret) essayBlockers.push("STRIPE_SECRET_KEY");
  if (!essayAnalysisPriceId) essayBlockers.push("STRIPE_ESSAY_ANALYSIS_PRICE_ID");
  if (!siteUrl) essayBlockers.push("SITE_URL");
  if (!admin) essayBlockers.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret) essayBlockers.push("STRIPE_WEBHOOK_SECRET");
  return {
    createCheckoutSession: Boolean(secret && priceId && siteUrl && admin),
    createEssayAnalysisCheckoutSession: Boolean(secret && essayAnalysisPriceId && siteUrl && admin),
    /** 未配置时用户付完款也不会写入权益表 */
    webhookVerified: Boolean(secret && webhookSecret),
    envBlockers: blockers,
    essayEnvBlockers: essayBlockers,
  };
}

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const { secret, webhookSecret } = stripeEnv();
  if (!secret || !webhookSecret) {
    return res.status(503).send("stripe webhook not configured");
  }
  const stripe = new Stripe(secret);
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe webhook] signature", msg);
    return res.status(400).send(`Webhook Error: ${msg}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }

  const session = event.data.object;
  const userId = session.metadata?.supabase_user_id;
  const applicationId = session.metadata?.application_id;
  const reportId = session.metadata?.report_id;
  const productType = session.metadata?.product_type || "report_unlock";
  if (!userId || !applicationId || typeof session.id !== "string") {
    console.error("[stripe webhook] missing metadata", session.id);
    return res.status(400).json({ error: "missing_metadata" });
  }
  if (session.payment_status && session.payment_status !== "paid") {
    console.warn("[stripe webhook] session not paid", session.id, session.payment_status);
    return res.status(400).json({ error: "payment_not_completed" });
  }

  const admin = supabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "supabase_admin_missing" });
  }

  const { data: application, error: appErr } = await admin
    .from("saved_applications")
    .select("id,user_id")
    .eq("id", applicationId)
    .single();

  if (appErr || !application) {
    console.error("[stripe webhook] application lookup failed", session.id, appErr);
    return res.status(400).json({ error: "application_not_found" });
  }
  if (application.user_id !== userId) {
    console.error("[stripe webhook] ownership mismatch", session.id, {
      metadataUserId: userId,
      applicationUserId: application.user_id,
      applicationId,
    });
    return res.status(403).json({ error: "ownership_mismatch" });
  }

  if (productType === "essay_analysis") {
    if (!reportId) {
      console.error("[stripe webhook] missing essay report_id", session.id);
      return res.status(400).json({ error: "missing_report_id" });
    }

    const { data: report, error: reportErr } = await admin
      .from("saved_reports")
      .select("id,user_id,application_id")
      .eq("id", reportId)
      .single();

    if (reportErr || !report) {
      console.error("[stripe webhook] essay report lookup failed", session.id, reportErr);
      return res.status(400).json({ error: "report_not_found" });
    }
    if (report.user_id !== userId || report.application_id !== applicationId) {
      console.error("[stripe webhook] essay ownership mismatch", session.id, {
        metadataUserId: userId,
        reportUserId: report.user_id,
        metadataApplicationId: applicationId,
        reportApplicationId: report.application_id,
      });
      return res.status(403).json({ error: "ownership_mismatch" });
    }

    const { data: existingEssay } = await admin
      .from("essay_analysis_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("application_id", applicationId)
      .eq("report_id", reportId)
      .eq("entitlement_kind", "per_session")
      .maybeSingle();

    if (!existingEssay) {
      const { error: essayErr } = await admin.from("essay_analysis_entitlements").insert({
        user_id: userId,
        application_id: applicationId,
        report_id: reportId,
        entitlement_kind: "per_session",
        stripe_checkout_session_id: session.id,
        source: "stripe",
      });

      if (essayErr && essayErr.code !== "23505") {
        console.error("[stripe webhook] essay entitlement insert", essayErr);
        return res.status(500).json({ error: essayErr.message });
      }
    }

    return res.json({ received: true });
  }

  const { error } = await admin.from("application_unlock_entitlements").upsert(
    {
      user_id: userId,
      application_id: applicationId,
      stripe_checkout_session_id: session.id,
      source: "stripe",
    },
    { onConflict: "user_id,application_id" },
  );

  if (error) {
    console.error("[stripe webhook] upsert", error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ received: true });
});

app.use(express.json({ limit: "256kb" }));

app.post("/api/stripe/create-checkout-session", async (req, res) => {
  if (!stripeReadyForCheckout()) {
    return res.status(503).json({ error: "stripe_checkout_unavailable" });
  }
  const { secret, priceId, siteUrl } = stripeEnv();
  const stripe = new Stripe(secret);

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "auth_required" });
  }

  const admin = supabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "supabase_admin_missing" });
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return res.status(401).json({ error: "invalid_session" });
  }
  const subject = userData.user;

  const reportId = String(req.body?.reportId ?? "").trim();
  let rep = null;
  if (reportId) {
    const { data, error: repErr } = await admin
      .from("saved_reports")
      .select("id,user_id,application_id")
      .eq("id", reportId)
      .single();

    if (repErr || !data) {
      return res.status(404).json({ error: "report_not_found" });
    }
    rep = data;
  } else {
    const form = req.body?.form;
    const report = req.body?.report;
    const locale = req.body?.locale === "en" ? "en" : "zh";
    const applicationId = String(req.body?.applicationId ?? "").trim();
    const supplementaryNotes = Array.isArray(req.body?.supplementaryNotes) ? req.body.supplementaryNotes : null;

    if (!form || !report) {
      return res.status(400).json({ error: "report_snapshot_required" });
    }

    const now = new Date().toISOString();
    let appId = applicationId;
    if (appId) {
      const { data: updatedApp, error: appUpdateErr } = await admin
        .from("saved_applications")
        .update({
          form_state: form,
          locale,
          updated_at: now,
        })
        .eq("id", appId)
        .eq("user_id", subject.id)
        .select("id")
        .maybeSingle();
      if (appUpdateErr) {
        return res.status(500).json({ error: appUpdateErr.message });
      }
      if (!updatedApp) {
        return res.status(403).json({ error: "forbidden" });
      }
    } else {
      const { data: newApp, error: appInsertErr } = await admin
        .from("saved_applications")
        .insert({
          user_id: subject.id,
          title: checkoutApplicationTitle(form, locale),
          form_state: form,
          locale,
          updated_at: now,
        })
        .select("id")
        .single();
      if (appInsertErr || !newApp) {
        return res.status(500).json({ error: appInsertErr?.message ?? "application_save_failed" });
      }
      appId = newApp.id;
    }

    const { data: newReport, error: reportInsertErr } = await admin
      .from("saved_reports")
      .insert({
        user_id: subject.id,
        application_id: appId,
        report_payload: report,
        supplementary_notes: supplementaryNotes?.length ? supplementaryNotes : null,
        report_unlocked: false,
      })
      .select("id,user_id,application_id")
      .single();
    if (reportInsertErr || !newReport) {
      return res.status(500).json({ error: reportInsertErr?.message ?? "report_save_failed" });
    }
    rep = newReport;
  }

  if (rep.user_id !== subject.id) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { data: existing } = await admin
    .from("application_unlock_entitlements")
    .select("application_id")
    .eq("user_id", subject.id)
    .eq("application_id", rep.application_id)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: "already_unlocked" });
  }

  const priceCheck = await validateStripeCheckoutPrice(stripe, priceId);
  if (!priceCheck.ok) {
    console.error("[stripe create-checkout-session] price_check", priceCheck.code, priceCheck.message);
    return res.status(503).json({ error: priceCheck.code });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: subject.id,
      customer_email: subject.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?stripe_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?stripe_checkout=cancel`,
      metadata: {
        product_type: "report_unlock",
        supabase_user_id: subject.id,
        application_id: rep.application_id,
        report_id: rep.id,
      },
    });

    if (!session.url) {
      console.error("[stripe create-checkout-session] missing session.url", session.id);
      return res.status(502).json({ error: "stripe_checkout_no_url" });
    }
    return res.json({ url: session.url, applicationId: rep.application_id, reportId: rep.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe create-checkout-session]", msg);
    return res.status(500).json({ error: mapStripeCheckoutError(msg) });
  }
});

app.post("/api/stripe/create-essay-analysis-checkout-session", async (req, res) => {
  if (!stripeReadyForEssayAnalysisCheckout()) {
    return res.status(503).json({ error: "essay_checkout_unavailable" });
  }
  const { secret, essayAnalysisPriceId, siteUrl } = stripeEnv();
  const stripe = new Stripe(secret);

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "auth_required" });
  }

  const admin = supabaseAdmin();
  const db = admin ?? supabaseUserClient(token);
  if (!db) {
    return res.status(503).json({ error: "supabase_client_missing" });
  }

  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData.user) {
    return res.status(401).json({ error: "invalid_session" });
  }
  const subject = userData.user;

  const reportId = String(req.body?.reportId ?? "").trim();
  if (!reportId) {
    return res.status(400).json({ error: "report_id_required" });
  }

  const { data: rep, error: repErr } = await db
    .from("saved_reports")
    .select("id,user_id,application_id")
    .eq("id", reportId)
    .single();

  if (repErr || !rep) {
    return res.status(404).json({ error: "report_not_found" });
  }
  if (rep.user_id !== subject.id) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { data: existing } = await admin
    .from("essay_analysis_entitlements")
    .select("id")
    .eq("user_id", subject.id)
    .eq("application_id", rep.application_id)
    .eq("report_id", rep.id)
    .eq("entitlement_kind", "per_session")
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: "essay_already_unlocked" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: subject.id,
      customer_email: subject.email ?? undefined,
      line_items: [{ price: essayAnalysisPriceId, quantity: 1 }],
      success_url: `${siteUrl}/?essay_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?essay_checkout=cancel`,
      metadata: {
        product_type: "essay_analysis",
        entitlement_kind: "per_session",
        supabase_user_id: subject.id,
        application_id: rep.application_id,
        report_id: rep.id,
      },
    });

    return res.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe create-essay-analysis-checkout-session]", msg);
    return res.status(500).json({ error: msg });
  }
});

const SYSTEM_PROMPT_ZH = `你是一位资深美国本科升学顾问（10年+经验），风格：专业、克制、可执行。基于用户问卷生成「选校策略草案」。

【语言】全程简体中文（校名保留英文）。不要使用直角引号「」；需要强调时用逗号、冒号或短句即可。

【顾问感】
- 先判断信息是否足够；不足则在 information_gaps 列出需补充问题（0-6条）。
- executive_summary 是「整体结论」：3-5 条，每条必须引用至少 1 个问卷具体事实（主申专业、GPA 描述、标化策略/分数、结构化活动、预算、选校风格、入学季等）；第一条必须是针对该生的一句话判断（≤90 字）。
- 禁止 executive_summary 套话：不要无依据地写「整体画像偏平衡型」「不是缺乏野心」「Top 30–50 主战场」等；若提学校区间，必须说明依据（如课程、活动、标化、预算）。
- executive_summary 与 reach/match/safety 的理由不得矛盾；可概括档位逻辑，但不要重复粘贴每校理由。
- 若 GPA 偏低（如未加权≤3.25、SAT≤1280）或活动几乎为空：禁止写「名单均衡/偏稳/可冲顶校」；须点明活动或成绩短板，且与 UC 分档（若有）一致。
- 若用户消息末含有【用户补充说明】区块：必须结合其更新 reach/match/safety 的入档理由与风险表述；information_gaps 中已被充分覆盖的点应删除或合并；禁止输出与补充说明明显矛盾的内容。
- 用户补充说明是跨轮次已确认事实：若用户已说明不考/不提交 SAT、ACT，不得再追问对应考试；若已提供 TOEFL/IELTS/Duolingo 等语言成绩或说明无需语言成绩，不得再追问“是否有语言成绩”，只能在必要时追问更具体的未覆盖细节。
- 至少3处明确引用用户问卷中的具体字段（预算/身份/标化/专业/偏好/结构化活动/就读学校）；若有补充说明，至少1处明确引用补充中的事实。
- 禁止「保证」「稳进」「必录」；不编造具体截止日期、具体奖学金金额、具体录取率（除非用户提供了且你仅复述）。

【申请环境与竞争密度】
- 用户可能提供国籍/护照地区、常驻地区或主要受教育地区；这些仅用于判断申请环境，不要在正文中用作标签化评价。
- 必须使用「竞争密度：低/中/高」或「申请群体竞争较集中/竞争密度较高」这类中性表达；禁止写「因为某国籍所以更难」或把国籍直接等同于难度。
- 在 reach/match/safety 的 key_risks 或 verification_focus 中，可写「该校在当前竞争环境下录取难度更高」「需要用更可验证的课程/活动证据支撑」。
- 若申请环境信息缺失，在 information_gaps 中提醒补充「常驻地区/主要受教育地区」以校准竞争密度。

【易变信息】涉及政策/费用/轮次/国际生要求：写「以学校官网当年公布为准」，verification_focus 写核对项但不要写具体日期数字。

【课程 rigor · 就读学校】
- 用户会提供当前就读高中/中学名称与课程体系；须结合两者解释课程难度（rigor）如何影响冲/稳/保理由、executive_summary 与 key_risks。
- 禁止编造该校 profile、排名、录取率或 feeder 数据；可中性提及广为人知的 rigorous 声誉，否则写 verification_focus 中应核对什么（课程清单、学校 profile、counselor 说明）。
- GPA 说明中的 AP/IB/honors/排名须与就读学校语境一致；若 rigor 与分数看似不匹配，须在风险中点明。

【冲稳保】
- 冲：必须是「现实可冲」学校，录取不确定性高但仍有可解释的申请理由；背景有罕见全国/国际级证据或 stats 极强时，MIT/Stanford/Harvard/UPenn 等顶级彩票校可出现在 reach。
- 稳：主战场，总体匹配仍有方差。
- 保：底线逻辑，解释如何降低全拒风险（非随便一所）。

【档位校准 · 竞争密度】
- 竞争密度为「高」时：对国际生/集中申请群体，档位应略保守；SAT/ACT 明显低于该校常见中位、或 GPA 未达典型区间时，不得标为 Match 或 Safety。
- UC 校区（Berkeley/UCLA/UCSD/UCI/UCSB 等）若出现在主名单 9 校中：对竞争密度高的背景，上述高选择性 UC 默认应为 Reach，不得标 Match/Safety（UC 本科 test-blind，勿把 SAT 当作 UC 录取杠杆）。
- 同理适用于对国际生竞争激烈的高选择性公立 flagship（如 UW Seattle、UMich、UVA、UNC、Georgia Tech 等）：标 Match 须有可引用的统计与活动证据；边界模糊时上调一档（Match→Reach，Safety→Match）。

【专业/项目匹配 — 优先于综合名气】
- 主申为 Entrepreneurship、商科细分、工程、CS 等时，9 校中至少 1–2 所须因「专业/项目/资源匹配」入选，而非仅因综合排名（例：Entrepreneurship 可含 Babson 等创业导向校；Business 可含专精商学院本科路径的校）。
- 禁止 9 校全是「综合名气型」私校/旗舰；须体现策略多样性（专精项目校 + 公立 flagship + 合理保底）。

【Recruited athlete · D3/NAIA hook 边界】
- Varsity / D3·NAIA recruitment contact ≠ 把 Reach 晋级到 Top 20–30 私校；hook 应导向 athletic-friendly LAC、D3 项目或与 stats+专业+地理匹配的 realistic stretch。
- 亦不得因 athlete 标签把所有选校压到 random safety flagship。
- executive_summary 与至少 2 所学校的 why 字段须引用具体运动项目、级别（D1/D2/D3/NAIA）、角色与 recruitment 事实。

【作品集 / 建筑 / 设计 / studio 专业】
- 主申 Architecture、Fine Arts、Design、Fashion、Film production 等 studio-heavy 路径：9 校中至少 1–2 所须为作品集/studio 校（如 RISD、Pratt、Syracuse Architecture、Virginia Tech architecture、SCAD 等），不得 9 校全是 US News 综合排名 flagship。
- 作品集校在 Reach 档须同时说明 portfolio + stats 双重门槛。

【Reach 档内部一致性】
- Reach 三校应处于相近 selective band（同为高 selective LAC、同为 competitive public flagship 等）；禁止把 USC/Berkeley 级与 regional public 混在同一 Reach 档。

【riskStyle 与 stats】
- riskStyle=aggressive 仅影响叙事与是否保留 1 所略高 stretch，不得忽视 GPA/标化差距把 moderate stats 的 Reach 写成 Top 15 私校，亦不得把 Berkeley/USC 级标 Match/Safety。

【弱/中等 stats · Reach 上限】
- GPA≤3.35 或 SAT≤1320（或 test-optional 且活动薄）：Reach 不得默认含 CMU、GT、USC、UMich、NYU 等；表单已填 SAT/ACT 时仍须用于档位校准。
- GPA/SAT 明显低于目标校典型中位（约 SAT -80 或 GPA -0.3）：该校不得标 Match/Safety；边界模糊时上调一档。

【禁校名单】
- 若用户消息含【禁止出现的学校】：这些校不得出现在 reach/match/safety/top_reference_schools/uc_analysis 任一区块；亦不得在 strategy_notes 中暗示仍应申请。

【保底校逻辑】
- Safety 须是「对该生统计 realistic 的录取底线 + 专业仍可就读」，非随机低排名凑数；优先与学生地理/预算/专业仍匹配的 strong public 或 regional flagship。
- 若某公立 flagship 的商学院/热门专业对该生仍偏难（如 test-optional 国际生 + GPA 3.7 申请 Fisher/Ross 路径），应标 Match 而非 Safety。

【顶级彩票校 · top_reference_schools】
- MIT、Stanford、Harvard、Princeton、Yale、Caltech、Columbia、UPenn、Duke、Brown、Dartmouth、Cornell、UChicago 等极高选择性学校，可在 reach 中出现（背景有充分理由时）；背景明显偏弱时不应放入 reach/match/safety。
- 可选根级字段 top_reference_schools 另计 0–2 所（不占 9 校名额），用于主名单未覆盖的额外顶校参考；不得与主名单 9 校重复。背景偏弱时留空 []。
- top_reference_schools 每行字段：school, why_reference_for_you, campus_vibe, context_note, key_fit_signals, key_risks, verification_focus（勿用 why_reach_for_you）。
- Penn State（宾州州立）≠ UPenn（宾大）；勿混淆。

【数量】reach、match、safety 每档恰好 3 所学校（共9所）。top_reference_schools 另计，0–2 所。

【校名单一性·硬性】
1. 同一所学校在全报告中只能出现一次：以英文校名字符串为准，reach、match、safety 合并后共 9 条 school 字段，必须 9 个互不相同的校名。
2. 不得在 Reach、Match、Safety 三档之间重复；也不得在同一档内两条目重复。常见别名/缩写若指向同一实体，视为同一所，只能出现一次且全篇统一用一种写法。
3. 三档名单两两不相交；每档 3 所彼此也不同（每档内 3 校互异）。
4. 若冲/稳/保边界不确定：优先保证「绝不重复」；宁可略保守归类或微调档位，也不得为凑满档而复用已出现过的学校。

【输出前自检】在写出最终 JSON 前必须在内部完成（不要输出思维过程，只输出 JSON）：
- 列出全部 9 个 school，检查是否有重复；若有重复，必须替换为另一所尚未出现过的美国本科院校，并同步改写该条的入档理由、风险与核对项，使全文自洽。
- 输出结果必须是去重后的最终版本；禁止输出仍含重复校名的 JSON。

【输出】只输出一个合法 JSON 对象（无 Markdown 围栏、无额外文字），结构：
{
  "executive_summary": ["3-5条，每条<=120字"],
  "information_gaps": ["0-6条"],
  "reach": [{"school":"","why_reach_for_you":"","campus_vibe":"","differentiation":"","context_note":"","key_fit_signals":["",""],"key_risks":["",""],"verification_focus":["","",""]}],
  "match": [同结构，但用 why_match_for_you 字段名与冲一致逻辑：说明为何在「稳」档],
  "safety": [同结构，字段 why_safety_for_you],
  "portfolio_risks": [{"risk_title":"","what_it_means_for_you":"","mitigation":""}],
  "improvement_plan": {"this_week":["3-5条"],"this_month":["4-7条"],"before_submitting":["4-7条"],"activity_build":["2-5条"],"priority_frame":"一句说明三段优先级"},
  "strategy_notes": ["3-6条"],
  "top_reference_schools": [{"school":"","why_reference_for_you":"","campus_vibe":"","context_note":"","key_fit_signals":["",""],"key_risks":["",""],"verification_focus":["",""]}]
}

match 每元素字段名必须为：school, why_match_for_you, campus_vibe, differentiation, context_note, key_fit_signals, key_risks, verification_focus
safety 每元素字段名必须为：school, why_safety_for_you, campus_vibe, differentiation, context_note, key_fit_signals, key_risks, verification_focus
reach 每元素字段名必须为：school, why_reach_for_you, campus_vibe, differentiation, context_note, key_fit_signals, key_risks, verification_focus

【每校呈现格式·硬性】
- why_* 字段：最多 2 句、≤80 字/句；禁止大段堆砌。
- campus_vibe：1 行气质标签 + 1 句说明（学术/社交/研究/体育/城市/乡村等），必须因校而异；须对照用户【校园社区气质偏好】说明匹配点或摩擦点（勿用偏好硬删校、勿写「最适合你」）。
- differentiation：1 句说明「与同档其它推荐校相比，这所更适合用户的哪一点」；须结合用户社区偏好（学术/平衡/社交派对活跃）解释相对同档其它校的体验差异；禁止 9 校同句。
- differentiation 禁止把名单其它档位（如 Match 校）称作「同档」；跨档比较须写清对方在你名单中的档位（如「相较匹配档的 UT Austin」）。
- context_note：1–2 句语境化参考（地区/feeder/身份/预算对核对的影响）；禁止编造具体录取率或「你校去年进了几人」；无可靠数据时写「请到官网 CDS 核对」。
- key_fit_signals、key_risks、verification_focus：各 2–4 条独立要点（短句），禁止与别校逐字重复。
- 每校至少 1 条该校独有信息（资源/文化/地理实习/专业结构等）；禁止 9 校共用同一段模板。
- verification_focus 写「去官网查什么」（录取、专业、奖助、课程），勿编造 URL；禁止写「核实 Anderson/Wharton/Sloan/Booth/Haas/Kellogg/Simon/Fisher/Kelley」等研究生商学院或本科极难商学院名称——本科请写 undergraduate admissions / 本科招生与专业目录。
- 文案须简洁自然：同一长句/括号说明不要在单条字段内重复粘贴；研究生院系名最多改写一次，其余用「本科招生页」等短表述。

【improvement_plan · 活动建设】
- activity_build：2–5 条可验证的活动/竞赛/项目/实习方向（含类型+如何验证成果）；若活动偏弱必须写「先补 1 条可验证主线」。
- priority_frame：一句说明 this_week / this_month / before_submitting 在当前入学季下的优先级含义。
- 禁止空泛「多参加活动」；每条须挂钩用户专业或现有活动线索。
`;

const SYSTEM_PROMPT_EN = `You are a senior U.S. undergraduate admissions counselor (10+ years), tone: professional, restrained, and actionable. Produce a school-list strategy from the user's questionnaire.

【Language】Write the entire JSON in natural American English. Keep school names in English as usual.

【Counselor stance】
- First judge whether information is sufficient; if not, list 0–6 concrete follow-ups in information_gaps.
- executive_summary is the overall advisor call: 3–5 bullets; each must cite at least one concrete questionnaire fact (major, GPA notes, testing policy/scores, activities, budget, list posture, intake). Bullet 1 must be one student-specific sentence (≤90 chars).
- Do NOT use generic executive_summary lines (“balanced profile,” “not lacking ambition,” “Top 30–50 battlefield”) without tying them to this student’s facts.
- executive_summary must not contradict reach/match/safety rationales.
- If GPA is weak or activities are thin: do NOT call the list “balanced/stable” or imply flagship reaches are reasonable; name the limiting board explicitly and align with uc_analysis tiers if present.
- If the user message ends with a [User supplementary notes] block: you MUST revise reach/match/safety rationales and risks accordingly; remove or merge gap items that are fully addressed; never contradict those notes.
- Supplementary notes are confirmed facts across refreshes: if the user already said they will not take/submit SAT or ACT, do not ask about that test again; if they already provided TOEFL/IELTS/Duolingo or said no language score is needed, do not ask whether a language score exists again. Only ask for narrower missing details that are not covered.
- Reference at least 3 specific questionnaire fields (budget/identity/testing/major/preferences/structured activities/current high school). If supplementary notes exist, reference at least one concrete fact from them.
- Never promise admission ("guaranteed", "sure admit", etc.). Do not invent exact deadlines, exact aid dollar amounts, or exact admit rates unless the user supplied them and you are only repeating.

【Application environment and competition density】
- The user may provide citizenship/passport region, usual residence, or main education region. Use these only to calibrate applicant-environment context; do not label or judge the user by nationality.
- Use neutral terms such as "competition density: low/medium/high", "more concentrated applicant pool", or "higher competition density." Do NOT write "this nationality is harder" or equate nationality directly with difficulty.
- In reach/match/safety key_risks or verification_focus, you may say "under the current competition environment, admission difficulty is higher" and "more verifiable coursework/activity evidence is needed."
- If environment information is missing, add an information_gaps item asking for usual residence/main education region to calibrate competition density.

【Volatile facts】For policies, costs, rounds, international requirements: say "confirm on each school's official site for the application cycle." Put checklist items in verification_focus without inventing specific calendar dates.

【Course rigor · current high school】
- The user provides their current high school name and curriculum system; combine both to explain how course rigor shapes reach/match/safety rationales, executive_summary, and key_risks.
- Do NOT invent school profile stats, rankings, admit rates, or feeder data. You may note well-known rigorous reputations neutrally; otherwise state what to verify (course list, school profile, counselor context).
- AP/IB/honors/rank mentions in GPA notes must align with the school context; flag mismatches in risks.

【Reach / Match / Safety】
- Reach: realistic stretch only. It may be uncertain, but there must still be a defensible admissions case. Ultra-selective schools (MIT, Stanford, Harvard, UPenn, etc.) may appear in Reach when the profile has rare national/international evidence or exceptionally strong stats.
- Match: main battlefield; fit is generally reasonable but variance remains.
- Safety: true floor logic—explain how it reduces all-reject risk (not a random filler).

【Tier calibration · competition density】
- When competition density is high: tier conservatively for international or concentrated applicant pools. If SAT/ACT is clearly below a school's typical middle range, or GPA is below its usual band, do NOT label it Match or Safety.
- If UC campuses (Berkeley/UCLA/UCSD/UCI/UCSB, etc.) appear in the main 9-school list: for high-competition profiles, treat selective UCs as Reach by default—not Match/Safety (UC undergrad is test-blind; do not use SAT as a UC admit lever).
- Apply the same rule to highly selective public flagships for international applicants (e.g. UW Seattle, UMich, UVA, UNC, Georgia Tech): Match requires citeable stats/activity evidence; when ambiguous, tier up (Match→Reach, Safety→Match).

【Major/program fit — over generic prestige】
- When the primary major is Entrepreneurship, a specialized business track, engineering, CS, etc., at least 1–2 of the 9 schools should be chosen for program/resource fit—not ranking alone (e.g. Entrepreneurship may include Babson; business may include schools with strong dedicated undergrad business paths).
- Do not fill all 9 slots with generic prestige privates/flagships; show list diversity (specialized program fit + public flagship + realistic floor).

【Recruited athlete · D3/NAIA hook boundaries】
- Varsity / D3·NAIA recruitment contact does NOT upgrade Reach to Top-20/Top-30 privates; anchor around athletic-friendly LACs, D3 programs, or realistic stretch fits for stats + major + geography.
- Do not compress the whole list to random safety flagships because of athletics either.
- executive_summary and at least 2 school why-fields must cite sport, level (D1/D2/D3/NAIA), role, and recruitment facts.

【Portfolio / architecture / design / studio majors】
- For Architecture, Fine Arts, Design, Fashion, Film production, etc.: at least 1–2 of the 9 schools must be portfolio/studio paths (e.g. RISD, Pratt, Syracuse Architecture, Virginia Tech architecture, SCAD)—not all US News prestige flagships.
- Portfolio schools in Reach must acknowledge portfolio + stats dual thresholds.

【Reach-tier internal consistency】
- All 3 Reach schools should sit in a similar selectivity band; do not mix USC/Berkeley-tier with regional publics in the same Reach block.

【riskStyle vs stats】
- riskStyle=aggressive adjusts tone and may keep ONE defensible high stretch—it does NOT ignore GPA/testing gaps or place moderate stats in Top-15 Reach / Berkeley-USC Match-Safety.

【Weak/moderate stats · Reach ceiling】
- GPA≤3.35 or SAT≤1320 (or test-optional with thin activities): Reach must not default to CMU, GT, USC, UMich, NYU, etc.; if SAT/ACT is on the form, still use it for tier calibration.
- If GPA/SAT is clearly below a school's typical middle band (~SAT -80 or GPA -0.3): do not label Match/Safety; when ambiguous, tier up.

【Forbidden schools】
- If the user message includes [Schools that must NOT appear]: those schools must not appear in reach/match/safety/top_reference_schools/uc_analysis—or be implied as "still apply" in strategy_notes.

【Safety tier logic】
- Safety must be a realistic admit floor for this student's stats plus a viable major path—not a random low-ranked filler. Prefer strong public or regional flagships that still fit geography/budget/major.
- If a public flagship business path is still tough for this profile (e.g. test-optional international with ~3.7 GPA targeting Fisher/Ross-tier paths), tier it Match—not Safety.

【Ultra-selective schools · top_reference_schools】
- MIT, Stanford, Harvard, Princeton, Yale, Caltech, Columbia, UPenn, Duke, Brown, Dartmouth, Cornell, UChicago, and similarly ultra-selective schools may appear in reach when the profile supports a defensible stretch case; omit from reach/match/safety when the profile is clearly weak.
- Optional root field top_reference_schools (0–2 items, not counted in the 9-school list) for extra reference-only schools not already in the main list; never duplicate a main-list school. Leave empty for weak profiles.
- Each top_reference_schools row uses: school, why_reference_for_you, campus_vibe, context_note, key_fit_signals, key_risks, verification_focus (not why_reach_for_you).
- Penn State University ≠ University of Pennsylvania (UPenn); do not conflate them.

【Counts】Exactly 3 schools in reach, 3 in match, and 3 in safety (9 total U.S. bachelor's institutions). top_reference_schools is separate: 0–2 items.

【Unique school list — hard rules】
1. Each school appears at most once across the whole report: using the English school string, the union of reach+match+safety must be 9 distinct school names.
2. No duplicates across tiers or within a tier. Treat common aliases/abbreviations that refer to the same institution as one school; pick one spelling and use it consistently.
3. The three tiers are pairwise disjoint; within each tier the 3 schools are mutually distinct.
4. If tier boundaries are ambiguous: prioritize "no duplicates"; prefer slightly conservative tiering over reusing any school to fill a slot.

【Pre-output self-check】Before printing the final JSON (internally only; output JSON only):
- List all 9 school strings and verify uniqueness; if any duplicate exists, replace with a new U.S. bachelor's institution not yet used and rewrite that row's rationale, risks, and verification items for consistency.
- The returned JSON must be the deduplicated final version.

【Output】Return only one valid JSON object (no Markdown fences, no extra prose), schema:
{
  "executive_summary": ["3-5 bullets, each <=120 characters"],
  "information_gaps": ["0-6 bullets"],
  "reach": [{"school":"","why_reach_for_you":"","campus_vibe":"","differentiation":"","context_note":"","key_fit_signals":["",""],"key_risks":["",""],"verification_focus":["","",""]}],
  "match": [same shape, but each object uses why_match_for_you and explains why it sits in Match],
  "safety": [same shape, each object uses why_safety_for_you],
  "portfolio_risks": [{"risk_title":"","what_it_means_for_you":"","mitigation":""}],
  "improvement_plan": {"this_week":["3-5 items"],"this_month":["4-7 items"],"before_submitting":["4-7 items"],"activity_build":["2-5 items"],"priority_frame":"one sentence on bucket priority"},
  "strategy_notes": ["3-6 items"],
  "top_reference_schools": [{"school":"","why_reference_for_you":"","campus_vibe":"","context_note":"","key_fit_signals":["",""],"key_risks":["",""],"verification_focus":["",""]}]
}

Field names for match rows must be: school, why_match_for_you, campus_vibe, differentiation, context_note, key_fit_signals, key_risks, verification_focus
Field names for safety rows must be: school, why_safety_for_you, campus_vibe, differentiation, context_note, key_fit_signals, key_risks, verification_focus
Field names for reach rows must be: school, why_reach_for_you, campus_vibe, differentiation, context_note, key_fit_signals, key_risks, verification_focus

【Per-school format — hard】
- why_* fields: at most 2 sentences, ≤90 characters each; no long paragraphs.
- campus_vibe: one vibe tag + one sentence; must differ by school; address fit vs user's campus community preference (academic / balanced / active social-party)—note alignment or friction; never hard-filter or claim "best fit."
- differentiation: one sentence vs other schools in the same tier; include community vibe vs user preference where relevant; never reuse across all 9.
- Never call a school in another list tier (e.g. Match) "same tier" when writing Reach row differentiation—name the other tier explicitly.
- context_note: region/feeder/identity/budget verification; NEVER invent admit rates; if no data, say confirm on official CDS.
- key_fit_signals, key_risks, verification_focus: 2–4 distinct short bullets each; never copy-paste the same text across schools.
- Each school needs at least one campus-specific point (resources, culture, internships/location, major structure); no shared template across all 9.
- verification_focus: state what to verify on the official site (admission, major, aid, curriculum); do not invent URLs. Never say "verify Anderson/Wharton/Sloan/Booth/Haas/Kellogg/Simon/Fisher/Kelley" or treat grad business schools as default undergrad paths—use undergraduate admissions pages.
- Keep prose concise: do not repeat the same long parenthetical phrase within one field; name a grad school at most once per field—otherwise say "undergraduate admissions page."

【improvement_plan · activity build】
- activity_build: 2–5 verifiable activity/competition/project/internship directions; if activities are thin, lead with one verifiable thread.
- priority_frame: one sentence on bucket priority for this intake horizon.
- Ban vague "do more activities"; tie each item to major or existing activity thread.
`;

const UC_KEYWORD_RE =
  /\buc\b|university of california|加州大学|ucla|berkeley|uc berkeley|ucsd|uc davis|uc irvine|uci|ucsb|uc santa barbara|uc santa cruz|ucsc|uc riverside|ucr|uc merced|ucm/i;

const UC_SYSTEM_APPEND_ZH = `

【加州大学 UC 专区 — 当用户有 UC 意向时必须输出】
若问卷显示西部偏好、或文字中出现 UC/加州大学/UCLA/Berkeley 等，必须在 JSON 根级增加 "uc_analysis" 对象（与 reach/match/safety 的 9 校名单分开）：
- 主名单 9 校应尽量为非 UC 的美国本科院校；不要把 UC 校区塞进主名单凑数。
- uc_analysis 按用户背景划分校区（每档 2–3 所，按竞争度与专业匹配，禁止固定「前二+中间四+后三」模板）。
- 禁止对所有人默认 Reach=Berkeley+UCLA：GPA 偏低（如未加权≤3.25、加权≤3.45、SAT≤1280）或活动几乎为空时，Berkeley/UCLA 不得出现在 reach，只能在 overview 中作「极低概率参考」；中档校区（UCSB/UCI/UCSD 等）不得标为 safety。
- 禁止错误院系表述：不得将 Anderson、Wharton、Sloan、Booth、Kellogg、Fuqua、Tuck、Tepper、HBS、GSB、SOM、CBS 等研究生商学院当作普通本科录取路径；Haas/Stern/Ross/Marshall/McCombs 等本科商科极难且非默认路径。
- 禁止弱背景「突破/逆袭/很有可能进 Berkeley/UCLA」类表述；reach 的 why 必须写明主要风险（GPA/活动/专业竞争），不得 9 校理由雷同。
- 每条校区行的 why 必须引用用户问卷中的具体事实（专业、活动、GPA 描述、选校风格）。
- 必须强调 UC 本科录取 test-blind：SAT/ACT 不参与录取决定。
- 禁止在 uc_analysis 任一校区的 key_risks、verification_focus、information_gaps 中写「未提交/无 SAT/ACT」「标化 optional 视为信息缺口」等——这对 UC 不专业且错误；标化仅可在 test_blind_note 或 checklist 中说明「勿把 SAT 当 UC 策略」。
- 说明所有 UC 共用一套 UC Application 与 4 篇 PIQ。
"uc_analysis" 结构：
{
  "overview": "2-4句总览",
  "test_blind_note": "test-blind 说明",
  "application_note": "一套申请+4 PIQ",
  "reach": [同主名单 school 行结构，why_reach_for_you],
  "match": [why_match_for_you],
  "safety": [why_safety_for_you],
  "checklist": ["4-6条"],
  "piq_directions": ["4条"],
  "information_gaps": ["0-4条"]
}
每档 2–3 所；校区名互不重复；勿把 MIT 等非 UC 校写入 uc_analysis。`;

const UC_SYSTEM_APPEND_EN = `

【University of California (UC) block — required when the user shows UC intent】
If the questionnaire shows West Coast preference or mentions UC / University of California / UCLA / Berkeley, etc., add a root-level "uc_analysis" object (separate from the main 9-school reach/match/safety list):
- The main 9-school list should prefer non-UC U.S. bachelor's institutions; do not pad the main list with UC campuses.
- In uc_analysis, tier 2–3 campuses each based on the user's profile (not a fixed "top 2 + middle 4 + bottom 3" template).
- Do NOT default Reach to Berkeley+UCLA. If GPA is weak (e.g. UW≤3.25, W≤3.45, SAT≤1280) or activities are thin, Berkeley/UCLA must NOT be in reach—only mention them as ultra-low-probability references in overview. Mid-tier campuses must NOT be labeled safety.
- Never write grad business schools (Anderson, Wharton, Sloan, Booth, Kellogg, Fuqua, Tuck, Tepper, HBS, GSB, SOM, CBS) as ordinary undergraduate admit paths. Haas/Stern/Ross/Marshall/McCombs undergrad business is ultra-selective—not a default path.
- No "breakthrough likely" language for weak profiles. Reach rows must state concrete risks (GPA/activities/major competition).
- Each campus row's why must cite specific questionnaire facts; no copy-paste rationales across campuses.
- State clearly that UC undergraduate admission is test-blind (SAT/ACT not used in admission decisions).
- Never list missing SAT/ACT or "test-optional" as a UC key_risk, verification item, or information_gap—unprofessional and incorrect for UC. Mention test-blind only in test_blind_note or checklist ("do not use SAT as a UC lever").
- Note one shared UC Application and four PIQs for all campuses.
"uc_analysis" schema:
{
  "overview": "2-4 sentences",
  "test_blind_note": "test-blind note",
  "application_note": "one app + 4 PIQs",
  "reach": [same row shape as main list, why_reach_for_you],
  "match": [why_match_for_you],
  "safety": [why_safety_for_you],
  "checklist": ["4-6 items"],
  "piq_directions": ["4 items"],
  "information_gaps": ["0-4 items"]
}
2–3 campuses per tier; unique campus names; no non-UC schools in uc_analysis.`;

function wantsUcFromBody(body) {
  const geo = body?.geoPrefs;
  if (Array.isArray(geo) && geo.includes("west")) return true;
  const blob = [
    body?.majorPrimary,
    body?.majorSecondary,
    body?.dealbreakers,
    structuredActivityBlob(body),
    body?.residenceRegion,
    body?.citizenship,
  ]
    .join(" ")
    .toLowerCase();
  return UC_KEYWORD_RE.test(blob);
}

function resolveReportLocale(_body) {
  return "en";
}

function systemPromptForLocale(locale, includeUc = false, horizon = "unknown") {
  let base = locale === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
  base += improvementPlanPromptBlock(horizon, locale);
  if (!includeUc) return base;
  return base + (locale === "en" ? UC_SYSTEM_APPEND_EN : UC_SYSTEM_APPEND_ZH);
}

function normalizeSchoolRowFields(r, tier, locale = "zh") {
  if (!r || typeof r !== "object") return null;
  const whyKey =
    tier === "reach" ? "why_reach_for_you" : tier === "match" ? "why_match_for_you" : "why_safety_for_you";
  const school = String(r.school || "").trim();
  if (!school) return null;
  const base = sanitizeSchoolRowTextFields(
    {
      school,
      [whyKey]: String(r[whyKey] || "").trim(),
      campus_vibe: String(r.campus_vibe || "").trim(),
      differentiation: String(r.differentiation || "").trim(),
      context_note: String(r.context_note || "").trim(),
      key_fit_signals: coerceStringArray(r.key_fit_signals),
      key_risks: coerceStringArray(r.key_risks),
      verification_focus: coerceStringArray(r.verification_focus),
    },
    locale,
  );
  return sanitizeSchoolRowUndergradCopy(base, tier, locale);
}

function normalizeUcSchoolRows(rows, tier, locale = "zh") {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => normalizeSchoolRowFields(r, tier, locale))
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeImprovementPlan(raw) {
  if (!raw || typeof raw !== "object") {
    return { this_week: [], this_month: [], before_submitting: [], activity_build: [], priority_frame: "" };
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  return {
    this_week: Array.isArray(o.this_week) ? o.this_week.map(String).filter(Boolean) : [],
    this_month: Array.isArray(o.this_month) ? o.this_month.map(String).filter(Boolean) : [],
    before_submitting: Array.isArray(o.before_submitting) ? o.before_submitting.map(String).filter(Boolean) : [],
    activity_build: Array.isArray(o.activity_build) ? o.activity_build.map(String).filter(Boolean) : [],
    priority_frame: String(o.priority_frame || "").trim(),
  };
}

function normalizeMainSchoolTiers(parsed, locale = "zh") {
  for (const tier of ["reach", "match", "safety"]) {
    const rows = parsed[tier];
    if (!Array.isArray(rows)) {
      parsed[tier] = [];
      continue;
    }
    parsed[tier] = rows.map((r) => normalizeSchoolRowFields(r, tier, locale)).filter(Boolean).slice(0, 3);
  }
}

function normalizeUcAnalysis(raw, locale = "zh") {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const reach = normalizeUcSchoolRows(o.reach, "reach", locale);
  const match = normalizeUcSchoolRows(o.match, "match", locale);
  const safety = normalizeUcSchoolRows(o.safety, "safety", locale);
  if (reach.length + match.length + safety.length === 0) return null;
  return {
    overview: String(o.overview || "").trim(),
    test_blind_note: String(o.test_blind_note || "").trim(),
    application_note: String(o.application_note || "").trim(),
    reach,
    match,
    safety,
    checklist: Array.isArray(o.checklist) ? o.checklist.map(String).filter(Boolean) : [],
    piq_directions: Array.isArray(o.piq_directions) ? o.piq_directions.map(String).filter(Boolean) : [],
    information_gaps: Array.isArray(o.information_gaps) ? o.information_gaps.map(String).filter(Boolean) : [],
  };
}

function tryBuildChinaArkConfig() {
  const key = (
    process.env.ARK_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  )
    .trim()
    .replace(/^["']+|["']+$/g, "");
  if (!key) return null;

  const explicitBase = (
    process.env.ARK_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  const modelRaw = (
    process.env.ARK_ENDPOINT_ID ||
    process.env.OPENAI_MODEL ||
    ""
  ).trim();

  const isArkKey = /^ark-/i.test(key);
  const explicitIsArk = /volces\.com|volcengine|ark\.cn/i.test(explicitBase);
  const forceArk = String(process.env.LLM_PROVIDER || "").toLowerCase() === "ark";
  const useArk = isArkKey || explicitIsArk || forceArk;
  if (!useArk) return null;

  const baseURL = explicitBase || DEFAULT_ARK_BASE;
  if (!/^ep-/.test(modelRaw)) return null;

  return {
    key,
    baseURL,
    model: modelRaw,
    isArk: true,
    region: "cn",
    provider: "volcengine-ark",
  };
}

/** Ollama 云控制台常见 key 形态：32 位 hex +「.」+ 后缀（非 sk-） */
function looksLikeOllamaCloudApiKey(key) {
  return /^[a-f0-9]{32}\.[A-Za-z0-9_-]+$/i.test(key);
}

/**
 * 美国区：OpenAI 官方、Ollama（OpenAI 兼容）、或其它兼容网关。
 * @param {boolean} allowSharedOpenAIKey 为 true 时，若无 US_OPENAI_API_KEY 则回退 OLLAMA_API_KEY、再回退 OPENAI_API_KEY（且排除 ark-）。
 */
function tryBuildUSOpenAIConfig(allowSharedOpenAIKey) {
  let key = (process.env.US_OPENAI_API_KEY || "").trim().replace(/^["']+|["']+$/g, "");
  /** @type {"us" | "ollama" | "shared" | "none"} */
  let keySource = key ? "us" : "none";

  if (!key) {
    const ollamaKey = (process.env.OLLAMA_API_KEY || "").trim().replace(/^["']+|["']+$/g, "");
    if (ollamaKey) {
      key = ollamaKey;
      keySource = "ollama";
    }
  }

  if (!key && allowSharedOpenAIKey) {
    const alt = (process.env.OPENAI_API_KEY || "").trim().replace(/^["']+|["']+$/g, "");
    if (alt && !/^ark-/i.test(alt)) {
      key = alt;
      keySource = "shared";
    }
  }
  if (!key) return null;
  if (/^ark-/i.test(key)) return null;
  if (key === "sk-..." || key.includes("your-api-key") || key.includes("这里")) return null;

  let model = (process.env.US_OPENAI_MODEL || "").trim();
  if (!model) model = (process.env.OLLAMA_MODEL || "").trim();
  if (!model && allowSharedOpenAIKey) {
    const om = (process.env.OPENAI_MODEL || "").trim();
    if (om && !/^ep-/i.test(om)) model = om;
  }
  if (!model) model = "gpt-4o-mini";
  if (/^ep-/i.test(model)) return null;

  let explicitBase = (process.env.US_OPENAI_BASE_URL || "").trim().replace(/\/$/, "");
  if (
    !explicitBase &&
    (keySource === "ollama" || looksLikeOllamaCloudApiKey(key))
  ) {
    explicitBase = (process.env.OLLAMA_BASE_URL || "https://ollama.com/v1").trim().replace(/\/$/, "");
  }
  if (!explicitBase && allowSharedOpenAIKey) {
    const ob = (process.env.OPENAI_BASE_URL || "").trim().replace(/\/$/, "");
    if (ob && !/volces\.com|volcengine|ark\.cn/i.test(ob)) explicitBase = ob;
  }
  const baseURL = explicitBase || undefined;

  const inferOllama =
    keySource === "ollama" ||
    looksLikeOllamaCloudApiKey(key) ||
    /ollama\.com|localhost:11434|127\.0\.0\.1:11434/i.test(explicitBase || "");
  const provider = inferOllama ? "ollama" : "openai";

  return { key, baseURL, model, isArk: false, region: "us", provider };
}

/**
 * @returns {{ key: string, baseURL: string | undefined, model: string, isArk: boolean, region: "cn" | "us", provider: string } | { error: string }}
 */
function resolveLLMConfig() {
  const region = (process.env.LLM_REGION || "auto").toLowerCase().trim();
  const cn = tryBuildChinaArkConfig();
  const us = tryBuildUSOpenAIConfig(true);

  if (region === "cn") {
    if (!cn) {
      return {
        error:
          "LLM_REGION=cn 但中国方舟未配齐：请设置 ARK_API_KEY（或 ark- 的 OPENAI_API_KEY）、ARK_BASE_URL（可选）、以及 ep- 接入点（ARK_ENDPOINT_ID 或 OPENAI_MODEL=ep-…）。",
      };
    }
    return cn;
  }
  if (region === "us") {
    if (!us) {
      return {
        error:
          "LLM_REGION=us 但未配置可用接口：请设置 US_OPENAI_API_KEY（OpenAI sk- 或 Ollama 云 key）、或 OLLAMA_API_KEY；自建/云端 Ollama 须配 US_OPENAI_BASE_URL（如 https://ollama.com/v1 或 http://127.0.0.1:11434/v1）。也可用 OPENAI_API_KEY=sk-…。",
      };
    }
    return us;
  }
  if (region !== "auto") {
    return { error: `无效 LLM_REGION=${region}，请使用 cn | us | auto。` };
  }

  if (us?.provider === "ollama") return us;
  if (us) return us;
  if (cn) return cn;
  return {
    error:
      "未配置可用 LLM：请配置 OpenAI 兼容端（US_OPENAI_API_KEY / OLLAMA_API_KEY / sk- 的 OPENAI_API_KEY），和/或火山方舟中国（ARK_API_KEY + ep- 接入点）。Ollama 云见 https://ollama.com/v1 + ollama.com/settings/keys。LLM_REGION=cn|us|auto（默认 auto：优先 Ollama，其次其它 US 接口，最后中国方舟）。",
  };
}

function normalizeSupplementaryNotes(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const topic = String(item.topic || "补充").trim().slice(0, 80);
    const text = String(item.text || "").trim().slice(0, 2000);
    if (!text) continue;
    out.push({ topic, text });
    if (out.length >= 24) break;
  }
  return out;
}

function formatStructuredActivities(items, locale) {
  if (!Array.isArray(items)) return "";
  const rows = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const pick = (key) => String(item[key] ?? "").trim().slice(0, 500);
    const name = pick("name");
    const description = pick("description");
    if (!name && !description) continue;
    const fields =
      locale === "en"
        ? [
            ["Name", name],
            ["Type", pick("kind")],
            ["Time / grades", pick("grades")],
            ["Hours", pick("hours")],
            ["Role", pick("role")],
            ["Scope", pick("scope")],
            ["Actions", description],
            ["Outcome", pick("outcome")],
            ["Award / ranking", pick("award")],
            ["Major-related", pick("majorRelated")],
            ["What it proves", pick("proof")],
          ]
        : [
            ["名称", name],
            ["类型", pick("kind")],
            ["时间/年级", pick("grades")],
            ["投入时间", pick("hours")],
            ["角色", pick("role")],
            ["影响范围", pick("scope")],
            ["具体行动", description],
            ["结果/影响", pick("outcome")],
            ["奖项/排名", pick("award")],
            ["是否相关专业", pick("majorRelated")],
            ["证明点", pick("proof")],
          ];
    rows.push(
      fields
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}: ${value}`)
        .join(locale === "en" ? "; " : "；"),
    );
    if (rows.length >= 8) break;
  }
  return rows.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

function inferCompetitionDensity({ applicantIdentity, citizenship, residenceRegion, highSchoolSystem }) {
  const text = `${applicantIdentity || ""} ${citizenship || ""} ${residenceRegion || ""} ${highSchoolSystem || ""}`.toLowerCase();
  const highSignals = [
    "china",
    "chinese",
    "中国",
    "大陆",
    "mainland",
    "india",
    "indian",
    "印度",
    "korea",
    "korean",
    "韩国",
    "singapore",
    "新加坡",
  ];
  const mediumSignals = [
    "hong kong",
    "香港",
    "taiwan",
    "台湾",
    "canada",
    "加拿大",
    "vietnam",
    "越南",
    "japan",
    "日本",
    "international",
    "intl",
  ];
  if (highSignals.some((x) => text.includes(x))) return "high";
  if (mediumSignals.some((x) => text.includes(x))) return "medium";
  if (applicantIdentity === "intl") return "medium";
  if (applicantIdentity === "us_citizen") return "low";
  return "unknown";
}

function competitionDensityLabel(density, locale) {
  if (locale === "en") {
    if (density === "high") return "High competition density (use neutral wording: concentrated applicant pool; do not attribute difficulty directly to nationality)";
    if (density === "medium") return "Medium competition density (use neutral applicant-environment wording)";
    if (density === "low") return "Low to medium competition density (still verify school-specific selectivity)";
    return "Unknown competition density (ask for usual residence/main education region if needed)";
  }
  if (density === "high") return "高竞争密度（请用「申请群体竞争较集中/竞争密度较高」等中性表达，不要写成国籍=难度）";
  if (density === "medium") return "中等竞争密度（请使用申请环境相关的中性表达）";
  if (density === "low") return "低至中等竞争密度（仍需核对学校自身选择性）";
  return "竞争密度未知（必要时询问常驻地区/主要受教育地区）";
}

function budgetPostureLabel(value, locale) {
  const key = String(value || "").trim();
  const en = {
    full_pay: "Full-pay possible; private full cost is feasible",
    high_budget: "High budget, but total cost still matters",
    budget_cap: "Clear budget cap; prioritize value, lower-cost options, and merit scholarships",
    need_aid: "Aid or scholarship support is needed; affordability materially affects attendance",
    unsure: "Budget not yet clear; flag affordability and aid-policy uncertainty",
  };
  const zh = {
    full_pay: "可全额自费；可接受私立大学全价",
    high_budget: "可承担较高费用，但仍希望控制总成本",
    budget_cap: "有明确预算上限；需优先考虑性价比、低成本选择与 merit 奖学金",
    need_aid: "需要奖助学金支持；资助结果会明显影响是否能就读",
    unsure: "预算尚不确定；需要提示费用与奖助政策不确定性",
  };
  if (locale === "en") return en[key] || key || "Not provided";
  return zh[key] || key || "未填";
}

function campusCulturePrefLabel(pref, locale) {
  const key = String(pref || "").trim();
  if (!key) return locale === "en" ? "Not provided" : "未填";
  const en = {
    academic: "Academic / research-oriented",
    balanced: "Balanced academic & social",
    social: "Active social / party-friendly campus life",
    any: "No strong preference",
  };
  const zh = {
    academic: "学术 / 研究导向",
    balanced: "学业与社交平衡",
    social: "社交 / 派对氛围活跃",
    any: "没有强烈偏好",
  };
  const table = locale === "en" ? en : zh;
  return table[key] || key;
}

function campusCultureAnalysisHint(pref, locale) {
  const key = String(pref || "").trim();
  if (!key || key === "any") {
    return locale === "en"
      ? "Describe each school's vibe objectively; no strong user culture preference to filter on."
      : "用户无强烈社区气质偏好——仍须客观描述每校气质，勿按偏好硬筛。";
  }
  if (key === "academic") {
    return locale === "en"
      ? "User prefers academic quiet / research depth—highlight study culture; flag party-heavy or distraction-prone campuses as friction."
      : "用户偏好学术安静/研究深度——突出学习文化；社交派对极活跃的校须写可能摩擦。";
  }
  if (key === "social") {
    return locale === "en"
      ? "User prefers active social / party-friendly culture—highlight clubs, athletics, Greek life, city/weekend life where accurate; flag overly quiet campuses."
      : "用户偏好社交/派对氛围——突出社团、体育、城市周末生活（准确描述）；过安静学术的校须写可能不合。";
  }
  return locale === "en"
    ? "User wants balance—compare peers on both rigor and social life, not rankings alone."
    : "用户要学业与社交平衡——同档校须同时比较课业强度与社交生活。";
}

function academicRigorAnalysisHint(body, locale) {
  const school = String(body?.currentHighSchool || "").trim();
  const system = String(body?.highSchoolSystem || "").trim();
  if (locale === "en") {
    if (!school) {
      return "No current high school name—infer course rigor only from curriculum system and GPA notes; flag rigor uncertainty in information_gaps when it affects tiering.";
    }
    return `Current high school: ${school}. Combine with curriculum (${system || "unknown"}) to interpret course rigor in executive_summary, tier rationales, and key_risks. Do NOT invent school profile stats, rankings, or admit rates. You may note well-known rigorous reputations in neutral terms; otherwise tell the student what to verify (school profile, counselor context, course list). Cross-check AP/IB/honors mentions in GPA notes against this school context.`;
  }
  if (!school) {
    return "未提供就读学校名称——仅依据课程体系与 GPA 说明推断课程 rigor；若影响档位判断，请在 information_gaps 中提示 rigor 不确定。";
  }
  return `当前就读学校：${school}。须与课程体系（${system || "未填"}）结合，在总览、分档理由与 key_risks 中解释课程 rigor 如何影响判断。禁止编造该校 profile 数据、排名或录取率；知名 rigorous 学校可用中性表述，否则应写清需核对项（学校 profile、counselor 说明、课程清单）。GPA 说明中的 AP/IB/honors 须与此校语境交叉验证。`;
}

function formatAcademicSpecialLine(body) {
  const flags = Array.isArray(body?.academicSpecialFlags) ? body.academicSpecialFlags.filter(Boolean) : [];
  const notes = String(body?.academicSpecialNotes || "").trim();
  const parts = [...flags];
  if (notes) parts.push(notes);
  return parts.join("; ");
}

function forbiddenSchoolsFromBody(body) {
  const raw = body?.forbiddenSchools ?? body?.forbidden_schools;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
}

function formatForbiddenSchoolsLine(body, locale) {
  const list = forbiddenSchoolsFromBody(body);
  if (list.length === 0) return "";
  if (locale === "en") {
    return `\n[Schools that must NOT appear anywhere in the report] ${list.join(", ")}`;
  }
  return `\n【禁止出现的学校 — 全报告任何区块均不得出现】${list.join("、")}`;
}

function buildUserPayload(body, includeUc = false) {
  const locale = resolveReportLocale(body);
  const isEn = locale === "en";
  const intakeRaw = String(body?.intakeTerm || "").trim();
  const planHorizon = getIntakeHorizon(intakeRaw);
  const planHorizonLine = improvementPlanUserContextLine(planHorizon, intakeRaw, locale);
  const planPersonalizationHints = buildImprovementPersonalizationHints(body, locale);
  const majorGuideBlock = formatMajorGuideForPrompt(body, locale);
  const officialLinksHint = isEn
    ? `\n\n[Official links policy] ${CURATED_OFFICIAL_LINK_SCHOOL_COUNT}+ schools have curated admissions/aid/CDS URLs in product; verification_focus must map to checkable topics (aid, CDS, major capacity)—never invent admit rates or feeder stats without a source.`
    : `\n\n【官网链接策略】产品内维护 ${CURATED_OFFICIAL_LINK_SCHOOL_COUNT}+ 所院校的招生/奖助/CDS 链接；verification_focus 须对应可核对主题（奖助、CDS、专业容量），禁止编造录取率或 feeder 统计。`;
  const {
    intakeTerm,
    applicantIdentity,
    citizenship,
    residenceRegion,
    budget,
    testing,
    satScore,
    actScore,
    highSchoolSystem,
    currentHighSchool,
    gpa,
    gpaTrend,
    languageScores,
    majorPrimary,
    majorSecondary,
    schoolSize,
    campusCulturePref,
    geoPrefs,
    structuredActivities,
    riskStyle,
    dealbreakers,
  } = body || {};
  const academicSpecialLine = formatAcademicSpecialLine(body);

  const supplementary = normalizeSupplementaryNotes(body?.supplementary_notes);
  const competitionDensity = inferCompetitionDensity({
    applicantIdentity,
    citizenship,
    residenceRegion,
    highSchoolSystem,
  });
  const competitionLine = competitionDensityLabel(competitionDensity, locale);
  const structuredActivityText = formatStructuredActivities(structuredActivities, locale);
  const budgetLine = budgetPostureLabel(budget, locale);
  const cultureLine = campusCultureAnalysisHint(campusCulturePref, locale);
  const rigorLine = academicRigorAnalysisHint(body, locale);
  const forbiddenLine = formatForbiddenSchoolsLine(body, locale);
  const transcriptBlock = formatTranscriptSheetBlock(body?.transcriptSheet, locale);
  const tierHintBlock =
    athleticRecruitmentHint(body, locale) +
    statsTierCalibrationHint(body, locale) +
    riskStyleCalibrationHint(body, locale);
  let extra = "";
  if (supplementary.length > 0) {
    if (isEn) {
      const lines = supplementary.map((x) => `[${x.topic}] ${x.text}`);
      extra = `\n\n[User supplementary notes — gaps have been updated; rewrite JSON so tiers, rationales, risks, and information_gaps stay consistent; remove or shorten gaps that are now fully covered]\n${lines.join("\n")}`;
    } else {
      const lines = supplementary.map((x) => `【${x.topic}】${x.text}`);
      extra = `\n\n【用户补充说明（信息缺口已更新，请据此重写 JSON：档位、理由、风险与 information_gaps 须与补充一致；已覆盖的缺口应移除或显著缩短）】\n${lines.join("\n")}`;
    }
  }

  if (isEn) {
    const na = "Not provided";
    const none = "None";
    const geoStr = Array.isArray(geoPrefs) ? geoPrefs.join(", ") : geoPrefs || na;
    return `Generate a JSON report from the following questionnaire (strictly follow the system schema; exactly 3 schools per tier).

[Intake term] ${intakeTerm || na}
${planHorizonLine}
[Applicant identity] ${applicantIdentity || na}
[Citizenship / passport region — internal context only] ${citizenship || na}
[Usual residence / main education region — internal context only] ${residenceRegion || na}
[Competition density] ${competitionLine}
[Target scope] U.S. undergraduate (bachelor's)
[Tuition / budget posture] ${budgetLine || na}
[Testing strategy] ${testing || na}${
      testing === "will_submit" ? `\nSAT: ${satScore || na}\nACT: ${actScore || na}` : ""
    }

[High school system] ${highSchoolSystem || na}
[Current high school] ${currentHighSchool || na}
[Course rigor — analysis instruction] ${rigorLine}
[GPA / transcript notes] ${gpa || na}
${transcriptBlock ? `\n${transcriptBlock}` : ""}
[GPA trend] ${gpaTrend || na}
[Language scores] ${languageScores || na}
[Transcript special circumstances] ${academicSpecialLine || na}
[Primary major] ${majorPrimary || na}
[Alternate major] ${majorSecondary || none}
[Campus size preference] ${schoolSize || na}
[Campus community vibe preference] ${campusCulturePrefLabel(campusCulturePref, locale)}
[Culture preference — analysis instruction] ${cultureLine}
[Geography preferences] ${geoStr}

[Structured activities / competition details] ${structuredActivityText || na}
[List risk posture] ${riskStyle || na}
[Hard dealbreakers] ${dealbreakers || none}${forbiddenLine}${
      includeUc
        ? "\n\n[UC intent] User shows interest in the University of California system. Output uc_analysis per system instructions; keep the main 9-school list mostly non-UC."
        : ""
    }${planPersonalizationHints}${majorGuideBlock}${tierHintBlock}${officialLinksHint}${extra}`;
  }

  return `请基于以下问卷生成 JSON 报告（严格遵守 system 的结构与每档3所的数量）。

【申请入学季】${intakeTerm || "未填"}
${planHorizonLine}
【申请身份】${applicantIdentity || "未填"}
【国籍/护照地区（仅作申请环境上下文）】${citizenship || "未填"}
【常驻地区/主要受教育地区（仅作申请环境上下文）】${residenceRegion || "未填"}
【竞争密度】${competitionLine}
【目标范围】美国本科
【学费/经济】${budgetLine || "未填"}
【标化策略】${testing || "未填"}${testing === "will_submit" ? `\nSAT: ${satScore || "未填"}\nACT: ${actScore || "未填"}` : ""}

【高中体系】${highSchoolSystem || "未填"}
【就读学校】${currentHighSchool || "未填"}
【课程 rigor · 分析要求】${rigorLine}
【GPA/成绩说明】${gpa || "未填"}
${transcriptBlock ? `\n${transcriptBlock}` : ""}
【GPA 趋势】${gpaTrend || "未填"}
【语言成绩】${languageScores || "未填"}
【学业特殊情况】${academicSpecialLine || "无"}
【主申专业】${majorPrimary || "未填"}
【备选专业】${majorSecondary || "无"}
【校园规模偏好】${schoolSize || "未填"}
【校园社区气质偏好】${campusCulturePrefLabel(campusCulturePref, locale)}
【社区偏好 · 分析要求】${cultureLine}
【地理偏好】${Array.isArray(geoPrefs) ? geoPrefs.join("、") : geoPrefs || "未填"}

【结构化活动 / 竞赛细节】${structuredActivityText || "未提供"}
【选校风格】${riskStyle || "未填"}
【绝对不能接受】${dealbreakers || "无"}${forbiddenLine}${
    includeUc
      ? "\n\n【UC 意向】用户表现出加州大学（UC）申请意向。请按 system 说明输出 uc_analysis；主名单 9 校尽量为非 UC 美国本科院校。"
      : ""
  }${planPersonalizationHints}${majorGuideBlock}${tierHintBlock}${officialLinksHint}${extra}`;
}

/**
 * 服务端硬校验：主名单 9 校 + top_reference_schools（见 topReferenceSchools.mjs）。
 * @deprecated 保留别名；请用 validateMainSchoolReport
 */
function validateSchoolUniqueness(parsed) {
  return validateMainSchoolReport(parsed, {});
}

async function generateReportWithConfig(cfg, body) {
  const locale = resolveReportLocale(body);
  const planHorizon = getIntakeHorizon(String(body?.intakeTerm || ""));
  const includeUc = wantsUcFromBody(body);
  const decision = await runDecisionEngineAsync(body, body?.tags ?? [], {
    locale,
    generateJson: async (messages) =>
      generateLlmJsonWithConfig(cfg, {
        logTag: "api/report/decision-fill",
        maxTokens: 1200,
        messages,
      }),
  });
  let userContent = buildUserPayload(body, includeUc);
  const fewShotBlock = buildFewShotPromptBlock(body, body?.tags ?? [], locale);
  if (fewShotBlock) userContent += fewShotBlock;
  if (decision.ok) {
    userContent += buildDecisionEnginePromptBlock(decision, locale, body, body?.tags ?? []);
  }
  const maxTokens = reportCompletionMaxTokens();
  const baseMessages = [
    { role: "system", content: systemPromptForLocale(locale, includeUc, planHorizon) },
    { role: "user", content: userContent },
  ];

  let messages = baseMessages;
  let totalMs = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { parsed, llmMs } = await generateLlmJsonWithConfig(cfg, {
      logTag: "api/report",
      maxTokens,
      messages,
    });
    totalMs += llmMs;
    if (decision.ok) mergeDecisionSchoolsIntoReport(parsed, decision, locale);
    autoRepairTopReferenceSchools(parsed, body, locale);
    const validation = validateMainSchoolReport(parsed, body);
    if (validation.ok) return { parsed, llmMs: totalMs, decisionEngine: decision };
    if (attempt >= 1 || validation.repairable === false) {
      const err = new Error(validation.reason);
      err.code = "school_list_invalid";
      throw err;
    }
    console.warn(`[api/report] validation_retry attempt=${attempt + 1}`, validation.reason);
    messages = [
      ...baseMessages,
      { role: "user", content: buildValidationRepairMessage(validation.reason, locale) },
    ];
  }
  const err = new Error("校名单校验失败");
  err.code = "school_list_invalid";
  throw err;
}

/** 从模型原文提取 JSON（兼容 Markdown 围栏与前后缀文字） */
function parseModelJsonContent(raw) {
  let s = String(raw ?? "").trim();
  if (!s) {
    const err = new Error("模型返回空内容");
    err.code = "invalid_json";
    throw err;
  }
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/im);
  if (fenced) s = fenced[1].trim();
  else if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    const salvaged = salvageTruncatedJsonObject(s);
    if (salvaged) return salvaged;
    const err = new Error(`模型返回非合法 JSON（约 ${s.length} 字符，可能被截断）`);
    err.code = "invalid_json";
    throw err;
  }
}

/** 输出被 max_tokens 截断时，尝试补齐未闭合的括号（仅作最后手段） */
function salvageTruncatedJsonObject(raw) {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let text = raw.slice(start).trimEnd();
  text = text.replace(/,\s*"[^"]*$/s, "").replace(/,\s*$/s, "");
  const stack = [];
  for (const ch of text) {
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if ((ch === "}" || ch === "]") && stack.length) stack.pop();
  }
  while (stack.length) text += stack.pop();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isLlmTimeoutError(e) {
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  const msg = e instanceof Error ? e.message : String(e);
  return code === "timeout" || /timeout|timed out/i.test(msg);
}

function isLlmRetryableError(e) {
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  const msg = e instanceof Error ? e.message : String(e);
  const status = e && typeof e === "object" && "status" in e ? Number(e.status) : 0;
  if (code === "invalid_json" || code === "empty_content") return true;
  if (status === 401 || status === 403 || status === 404 || status === 503 || status === 502) return true;
  return /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|503|502|401|403|404|unauthorized|invalid_api_key|incorrect api key|not found|model.*not found|does not exist|unknown model/i.test(
    msg,
  );
}

/** 是否可切换到下一 LLM：Ollama 优先；Vercel 上超时不再串联方舟，避免平台 maxDuration 杀进程 */
function canFallbackToNextLlm(e, index, configs) {
  if (index >= configs.length - 1) return false;
  if (!isLlmRetryableError(e)) return false;
  if (process.env.VERCEL && isLlmTimeoutError(e)) return false;
  return true;
}

/** Ollama 为主通道；JSON/空内容或（非 Vercel）网络失败时可回退火山方舟 */
function llmConfigsToTry() {
  const primary = resolveLLMConfig();
  if ("error" in primary) return primary;
  const cn = tryBuildChinaArkConfig();
  if (cn && primary.provider === "ollama") return [primary, cn];
  return [primary];
}

/** OnlyApply 专属 Ollama 模型（如 wangalbert816/OnlyApplyMial）；未设置则走 US_OPENAI_MODEL。 */
function onlyApplyDedicatedModel() {
  return (
    (process.env.ONLYAPPLY_LLM_MODEL || process.env.ONLYAPPLY_OLLAMA_MODEL || "").trim() ||
    null
  );
}

/** 报告 / 文书：优先 OnlyApply 专模，失败可回退通用 Ollama，再回退方舟。 */
function llmConfigsToTryForOnlyApply() {
  const base = llmConfigsToTry();
  if ("error" in base) return base;
  const dedicated = onlyApplyDedicatedModel();
  if (!dedicated) return base;

  const primary = base[0];
  if (primary.model === dedicated) return base;

  const dedicatedCfg = { ...primary, model: dedicated };
  const fallbacks = [primary, ...base.slice(1)].filter((cfg) => cfg.model !== dedicated);
  return [dedicatedCfg, ...fallbacks];
}

function withWallClockTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} 超过 ${ms}ms`);
      err.code = "timeout";
      reject(err);
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function callLlmJsonOnce(client, { model, provider, messages, maxTokens }) {
  const requestBody = { model, temperature: 0.35, messages };
  const ollamaJsonOff = (process.env.OLLAMA_JSON_FORMAT || "").toLowerCase() === "0";
  if (provider !== "ollama" || !ollamaJsonOff) {
    requestBody.response_format = { type: "json_object" };
  }
  if (maxTokens > 0) {
    requestBody.max_tokens = maxTokens;
  }

  const completion = await client.chat.completions.create(requestBody);
  const choice = completion.choices[0];
  const finishReason = choice?.finish_reason;
  const messageContent = choice?.message?.content;
  if (!messageContent || !String(messageContent).trim()) {
    const err = new Error("模型未返回内容");
    err.code = "empty_content";
    throw err;
  }
  try {
    return parseModelJsonContent(messageContent);
  } catch (e) {
    if (finishReason === "length" && e && typeof e === "object") {
      e.code = "invalid_json";
      e.truncated = true;
    }
    throw e;
  }
}

async function generateLlmJsonWithConfig(cfg, { messages, maxTokens, logTag }) {
  const { key, baseURL, model, region, provider } = cfg;
  const client = new OpenAI({
    apiKey: key,
    ...(baseURL ? { baseURL } : {}),
    timeout: LLM_TIMEOUT_MS,
    maxRetries: LLM_MAX_RETRIES,
  });

  const t0 = Date.now();
  const parseAttempts = 2;
  let effectiveMaxTokens = maxTokens;
  let lastErr;
  for (let attempt = 0; attempt < parseAttempts; attempt++) {
    try {
      const llmCall = callLlmJsonOnce(client, {
        model,
        provider,
        messages,
        maxTokens: effectiveMaxTokens,
      });
      const parsed = process.env.VERCEL
        ? await withWallClockTimeout(llmCall, VERCEL_LLM_WALL_MS, logTag)
        : await llmCall;
      return { parsed, llmMs: Date.now() - t0, region, provider, model };
    } catch (e) {
      lastErr = e;
      const code = e && typeof e === "object" && "code" in e ? e.code : "";
      if (code === "invalid_json" || code === "empty_content") {
        if (attempt === 0 && effectiveMaxTokens > 0) {
          effectiveMaxTokens = Math.min(Math.round(effectiveMaxTokens * 1.5), 24_576);
        }
        console.warn(
          `[${logTag}] parse_retry attempt=${attempt + 1} provider=${provider} model=${model} max_tokens=${effectiveMaxTokens || "default"}`,
          e instanceof Error ? e.message : e,
        );
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function reportCompletionMaxTokens() {
  if (COMPLETION_MAX_TOKENS <= 0) return 0;
  return COMPLETION_MAX_TOKENS;
}

async function generateEssayAnalysisWithConfig(cfg, promptInput) {
  const { locale, draft, formState, reportPayload, strategy } = promptInput;
  const maxTokens = COMPLETION_MAX_TOKENS > 0 ? Math.min(COMPLETION_MAX_TOKENS, 1800) : 0;
  return generateLlmJsonWithConfig(cfg, {
    logTag: "api/essay/analyze",
    maxTokens,
    messages: [
      {
        role: "system",
        content:
          locale === "en"
            ? "Return only valid JSON. Do not write the student's essay for them."
            : "只返回合法 JSON。不要代写学生文书成稿。",
      },
      {
        role: "user",
        content: buildEssayAnalysisPrompt({ locale, draft, formState, reportPayload, strategy }),
      },
    ],
  });
}

function finalizeReportPayload(parsed, body) {
  const locale = resolveReportLocale(body);
  normalizeMainSchoolTiers(parsed, locale);
  if (parsed.improvement_plan) {
    parsed.improvement_plan = normalizeImprovementPlan(parsed.improvement_plan);
  }
  const cleanProse = (t) =>
    sanitizeUndergradSchoolMentions(sanitizeUnsourcedStats(String(t || ""), locale), "", locale);
  if (Array.isArray(parsed.executive_summary)) {
    parsed.executive_summary = parsed.executive_summary.map(cleanProse).filter(Boolean);
  }
  if (Array.isArray(parsed.information_gaps)) {
    parsed.information_gaps = parsed.information_gaps.map(cleanProse).filter(Boolean);
  }
  if (Array.isArray(parsed.strategy_notes)) {
    parsed.strategy_notes = parsed.strategy_notes.map(cleanProse).filter(Boolean);
  }
  if (Array.isArray(parsed.portfolio_risks)) {
    parsed.portfolio_risks = parsed.portfolio_risks.map((r) => ({
      ...r,
      risk_title: cleanProse(r.risk_title),
      what_it_means_for_you: cleanProse(r.what_it_means_for_you),
      mitigation: cleanProse(r.mitigation),
    }));
  }
  if (parsed.improvement_plan && typeof parsed.improvement_plan === "object") {
    const ip = parsed.improvement_plan;
    for (const key of ["this_week", "this_month", "before_submitting", "activity_build"]) {
      if (Array.isArray(ip[key])) ip[key] = ip[key].map(cleanProse).filter(Boolean);
    }
    if (ip.priority_frame) ip.priority_frame = cleanProse(ip.priority_frame);
  }
  const includeUc = wantsUcFromBody(body);
  if (includeUc) {
    let uc = normalizeUcAnalysis(parsed.uc_analysis, locale);
    if (uc) {
      uc = sanitizeUcAnalysisFromBody(uc, body, locale);
      if (ucAnalysisNeedsFallbackFromBody(uc, body)) {
        console.warn("[api/report] uc_analysis_rejected_using_client_fallback");
        delete parsed.uc_analysis;
      } else {
        parsed.uc_analysis = uc;
      }
    } else {
      delete parsed.uc_analysis;
    }
  } else {
    delete parsed.uc_analysis;
  }
  parsed.top_reference_schools = normalizeTopReferenceSchoolRows(parsed.top_reference_schools, locale);
  return sanitizeReportTierDifferentiation(parsed, locale);
}

app.post("/api/report", async (req, res) => {
  const configs = llmConfigsToTryForOnlyApply();
  if ("error" in configs) {
    console.error("[api/report] llm_config", configs.error);
    return res.status(500).json({ error: IS_PROD ? "report_service_unavailable" : configs.error });
  }

  const body = req.body || {};
  let lastErr = null;

  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const { key, baseURL, model, isArk, region, provider } = cfg;
    try {
      const { parsed, llmMs } = await generateReportWithConfig(cfg, body);
      console.log(`[api/report] llm_ms=${llmMs} model=${model} provider=${provider}`);

      const de = parsed.decision_engine;
      if (de?.benchmark_id) {
        res.setHeader("X-Decision-Engine", String(de.source || "live"));
        res.setHeader("X-Decision-Benchmark", String(de.benchmark_id));
      }

      return res
        .setHeader("X-LLM-Duration-Ms", String(llmMs))
        .setHeader("X-LLM-Region", region)
        .setHeader("X-LLM-Provider", provider)
        .setHeader("X-LLM-Model", model)
        .json(finalizeReportPayload(parsed, body));
    } catch (e) {
      lastErr = e;
      const code = e && typeof e === "object" && "code" in e ? e.code : "";
      const msg = e instanceof Error ? e.message : String(e);
      if (canFallbackToNextLlm(e, i, configs)) {
        console.warn(`[api/report] fallback provider=${configs[i + 1].provider} after ${provider} failed:`, msg);
        continue;
      }
      console.error("[api/report] generation_error", msg);
      if (code === "school_list_invalid") {
        return res.status(502).json({
          error: `校名单未通过校验，请重新点击生成。（${msg}）`,
        });
      }
      let hint = "";
      if (/401|Incorrect API key/i.test(msg)) {
        hint =
          region === "cn" || isArk
            ? " 当前为中国火山方舟（北京网关）。若仍 401：核对 ARK_API_KEY、ep- 接入点与地域；改 .env 后重启 npm run dev。"
            : provider === "ollama"
              ? " 当前为 Ollama（OpenAI 兼容）。若仍 401：在 ollama.com/settings/keys 核对 key；云端须 US_OPENAI_BASE_URL=https://ollama.com/v1（或设 OLLAMA_API_KEY）；本地一般为 http://127.0.0.1:11434/v1 且 api_key 可填 ollama。"
              : " 当前为 OpenAI 兼容接口。若仍 401：核对 US_OPENAI_API_KEY（或 sk- 的 OPENAI_API_KEY）与 US_OPENAI_BASE_URL；改 .env 后重启。";
      }
      const retryable = isLlmRetryableError(e);
      if (retryable && configs.length === 1) {
        hint += " 可在 .env 设置 LLM_REGION=cn 使用火山方舟，或增大 COMPLETION_MAX_TOKENS。";
      }
      return res.status(retryable ? 502 : 500).json({
        error: IS_PROD ? "report_generation_failed" : msg + hint,
      });
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr || "report_generation_failed");
  return res.status(502).json({ error: IS_PROD ? "report_generation_failed" : msg });
});

async function generateReportForAdmin(body) {
  const configs = llmConfigsToTryForOnlyApply();
  if ("error" in configs) {
    throw new Error(configs.error);
  }
  let lastErr = null;
  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    try {
      const { parsed, llmMs } = await generateReportWithConfig(cfg, body);
      return {
        report: finalizeReportPayload(parsed, body),
        llmMs,
        provider: cfg.provider,
        model: cfg.model,
      };
    } catch (e) {
      lastErr = e;
      if (canFallbackToNextLlm(e, i, configs)) {
        console.warn(
          `[generateReportForAdmin] fallback provider=${configs[i + 1]?.provider} model=${configs[i + 1]?.model} after ${cfg.provider}/${cfg.model} failed:`,
          e instanceof Error ? e.message : e,
        );
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "report_generation_failed"));
}

function normalizeEssayAnalysis(raw, locale) {
  const fallback = locale === "en" ? "This paragraph has a useful starting point, but it needs to become more specific." : "你现在这段的问题很典型：有一个可以写的方向，但还没有写到真正具体的地方。";
  const obj = raw && typeof raw === "object" ? raw : {};
  const verdict = String(obj.verdict || obj.directFeedback || obj.direct_feedback || fallback).trim().slice(0, 520);
  const rawChecks = Array.isArray(obj.checks) ? obj.checks : [];
  const rawIssues = Array.isArray(obj.issues) ? obj.issues : [];
  const issues = rawIssues
    .map((item) => String(item || "").trim().slice(0, 260))
    .filter(Boolean)
    .slice(0, 4);
  const checks = rawChecks
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const label = String(item.label || "").trim().slice(0, 60);
      const detail = String(item.detail || "").trim().slice(0, 500);
      if (!label || !detail) return null;
      return { label, ok: Boolean(item.ok), detail };
    })
    .filter(Boolean)
    .slice(0, 6);
  const nextRevision = String(obj.nextRevision || obj.next_revision || obj.revisionIdea || obj.revision_idea || "")
    .trim()
    .slice(0, 700);
  const rewrite = obj.rewriteExample || obj.rewrite_example || {};
  const rewriteBefore =
    rewrite && typeof rewrite === "object" ? String(rewrite.before || rewrite.original || "").trim().slice(0, 260) : "";
  const rewriteAfter =
    rewrite && typeof rewrite === "object" ? String(rewrite.after || rewrite.revised || "").trim().slice(0, 360) : "";
  return {
    verdict,
    issues:
      issues.length > 0
        ? issues
        : checks.length > 0
          ? checks.map((check) => check.detail).slice(0, 4)
          : [
              locale === "en"
                ? "Right now the reader can understand the idea, but cannot yet see the moment clearly."
                : "现在读者大概知道你想写什么，但还看不见那个具体瞬间。",
            ],
    checks:
      checks.length > 0
        ? checks
        : [
            {
              label: locale === "en" ? "Specificity" : "具体性",
              ok: false,
              detail: locale === "en" ? "Add more concrete scene-level evidence." : "需要补充更具体的场景级证据。",
            },
          ],
    nextRevision:
      nextRevision ||
      (locale === "en"
        ? "For the next version, pick one moment and slow it down: what you saw, what choice you made, and what changed because of it."
        : "下一版别急着总结，先抓住一个瞬间慢下来写：你看见了什么、你做了什么选择、这件事后来改变了什么。"),
    rewriteExample: {
      before:
        rewriteBefore ||
        (locale === "en" ? "I learned a lot from this experience." : "这段经历让我学到了很多。"),
      after:
        rewriteAfter ||
        (locale === "en"
          ? "Change it into a visible moment: “When ___ happened, I first ___, then I decided to ___.”"
          : "可以改成一个看得见的瞬间：『当___发生时，我一开始___，后来我决定___。』"),
    },
  };
}

function buildEssayAnalysisPrompt({ locale, draft, formState, reportPayload, strategy }) {
  const isEn = locale === "en";
  const safeDraft = String(draft || "").trim().slice(0, 5000);
  const compactForm = JSON.stringify(formState || {}).slice(0, 5000);
  const compactReport = JSON.stringify(reportPayload || {}).slice(0, 7000);
  const compactStrategy = JSON.stringify(strategy || {}).slice(0, 1600);

  if (isEn) {
    return `You are an experienced U.S. undergraduate application essay advisor.

Read the student's raw paragraph and respond like a real advisor sitting next to them. Do NOT write the full essay for them.

Use the latest report context, but do not sound like an analysis report. Be short, direct, conversational, and specific to this draft.

Do not use abstract category labels such as "generic risk", "concrete scene", "change", "major connection", or "professional connection".
Do not teach essay theory. Point to what is weak, what to do next, and show one sentence-level rewrite example.
The opening must be a direct evaluation, like: "The issue with this paragraph is pretty common..."

Current essay strategy:
${compactStrategy}

Student form state:
${compactForm}

Latest report JSON:
${compactReport}

Student draft:
${safeDraft}

Return only valid JSON:
{
  "verdict": "1-2 short conversational sentences. Start with direct evaluation.",
  "issues": ["Natural-language issue 1, like something an advisor would say in chat.", "Natural-language issue 2."],
  "nextRevision": "One concrete revision direction. No theory. Tell the student what to add or replace next.",
  "rewriteExample": {
    "before": "A weak phrase or sentence from the student's draft, or a close paraphrase.",
    "after": "A more specific version of that sentence. Do not write the full essay."
  }
}`;
  }

  return `你是一位有经验的美国本科申请文书顾问。

请读学生刚写出的原始段落，像坐在旁边帮他改文书的人一样反馈。不要替学生代写完整文书，不要输出成稿。

必须结合最新报告上下文，但不要写得像分析报告。语气要短、直接、像对话，必须针对这段草稿本身。

不要使用抽象分类标签，比如“是否generic”“具体情境”“变化”“专业关联”。
不要长篇解释写作结构，不要上课。直接指出哪里不够、下一版怎么改，并给一个句子级的示例改写。
开头必须是直接评价，例如：“你现在这段的问题很典型……”

当前文书策略：
${compactStrategy}

学生问卷信息：
${compactForm}

最新报告 JSON：
${compactReport}

学生草稿：
${safeDraft}

只返回合法 JSON：
{
  "verdict": "1-2句短句。必须用直接评价开头。",
  "issues": ["像顾问聊天一样指出一个具体问题。", "再指出一个具体问题。"],
  "nextRevision": "一个具体修改思路。不要讲理论，直接告诉学生下一版加什么、删什么或替换什么。",
  "rewriteExample": {
    "before": "学生原文里较弱的一句话，或贴近原文的概括。",
    "after": "把这句话改得更具体。不要写完整文书。"
  }
}`;
}

app.post("/api/essay/analyze", async (req, res) => {
  const configs = llmConfigsToTryForOnlyApply();
  if ("error" in configs) {
    console.error("[api/essay/analyze] llm_config", configs.error);
    return res.status(500).json({ error: IS_PROD ? "essay_service_unavailable" : configs.error });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "auth_required" });
  }

  const admin = supabaseAdmin();
  const db = admin ?? supabaseUserClient(token);
  if (!db) {
    return res.status(503).json({ error: "supabase_client_missing" });
  }

  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData.user) {
    return res.status(401).json({ error: "invalid_session" });
  }
  const subject = userData.user;
  const locale = resolveReportLocale(req.body || {});
  const reportId = String(req.body?.reportId ?? "").trim();
  const draft = String(req.body?.draft ?? "").trim();
  if (!reportId) return res.status(400).json({ error: "report_id_required" });
  if (draft.length < 6) return res.status(400).json({ error: "draft_too_short" });

  const { data: rep, error: repErr } = await db
    .from("saved_reports")
    .select("id,user_id,application_id,report_payload")
    .eq("id", reportId)
    .single();
  if (repErr || !rep) return res.status(404).json({ error: "report_not_found" });
  if (rep.user_id !== subject.id) return res.status(403).json({ error: "forbidden" });

  const { data: application, error: appErr } = await db
    .from("saved_applications")
    .select("id,user_id,form_state")
    .eq("id", rep.application_id)
    .single();
  if (appErr || !application) return res.status(404).json({ error: "application_not_found" });
  if (application.user_id !== subject.id) return res.status(403).json({ error: "forbidden" });

  const { data: entitlement, error: entitlementErr } = await db
    .from("essay_analysis_entitlements")
    .select("id")
    .eq("user_id", subject.id)
    .eq("application_id", rep.application_id)
    .eq("report_id", rep.id)
    .eq("entitlement_kind", "per_session")
    .maybeSingle();
  if (entitlementErr) {
    console.error("[api/essay/analyze] entitlement_lookup", entitlementErr);
    return res.status(500).json({ error: "essay_entitlement_lookup_failed" });
  }
  if (!entitlement) {
    return res.status(402).json({ error: "essay_analysis_locked" });
  }

  const promptInput = {
    locale,
    draft,
    formState: application.form_state,
    reportPayload: rep.report_payload,
    strategy: req.body?.strategy,
  };

  let lastErr = null;
  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const { region, provider, model } = cfg;
    try {
      const { parsed, llmMs } = await generateEssayAnalysisWithConfig(cfg, promptInput);
      console.log(`[api/essay/analyze] llm_ms=${llmMs} model=${model} provider=${provider}`);

      const analysis = normalizeEssayAnalysis(parsed, locale);
      const now = new Date().toISOString();
      const { error: draftSaveErr } = await db.from("essay_drafts").upsert(
        {
          user_id: subject.id,
          application_id: rep.application_id,
          report_id: rep.id,
          draft_text: draft,
          updated_at: now,
        },
        { onConflict: "user_id,report_id" },
      );
      if (draftSaveErr) {
        console.error("[api/essay/analyze] draft_save", draftSaveErr);
      }

      const { data: savedAnalysis, error: analysisSaveErr } = await db
        .from("essay_analyses")
        .insert({
          user_id: subject.id,
          application_id: rep.application_id,
          report_id: rep.id,
          draft_text: draft,
          analysis_payload: analysis,
        })
        .select("id,created_at")
        .single();
      if (analysisSaveErr) {
        console.error("[api/essay/analyze] analysis_save", analysisSaveErr);
      }

      return res
        .setHeader("X-LLM-Duration-Ms", String(llmMs))
        .setHeader("X-LLM-Region", region)
        .setHeader("X-LLM-Provider", provider)
        .json({
          ...analysis,
          id: savedAnalysis?.id ?? undefined,
          created_at: savedAnalysis?.created_at ?? undefined,
        });
    } catch (e) {
      lastErr = e;
      const code = e && typeof e === "object" && "code" in e ? e.code : "";
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = isLlmRetryableError(e);
      if (canFallbackToNextLlm(e, i, configs)) {
        console.warn(`[api/essay/analyze] fallback provider=${configs[i + 1].provider} after ${provider} failed:`, msg);
        continue;
      }
      console.error("[api/essay/analyze] analysis_error", msg);
      return res.status(retryable ? 502 : 500).json({
        error: IS_PROD ? "essay_analysis_failed" : msg,
      });
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr || "essay_analysis_failed");
  return res.status(502).json({ error: IS_PROD ? "essay_analysis_failed" : msg });
});

function isValidConsultEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function bearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

/** 默认：项目根 data/expert-consult-leads.jsonl；可用 CONSULT_LEADS_FILE 覆盖 */
const DEFAULT_EXPERT_CONSULT_LEADS = path.join(__dirname, "..", "data", "expert-consult-leads.jsonl");

function resolveConsultLeadsFilePath() {
  const rel = (process.env.CONSULT_LEADS_FILE || "").trim();
  if (rel) return path.isAbsolute(rel) ? rel : path.join(__dirname, "..", rel);
  // Vercel Serverless 除 /tmp 外文件系统只读；留资落盘仅作冷启动间缓冲，生产请接外部存储或 Webhook
  if (process.env.VERCEL) return "/tmp/expert-consult-leads.jsonl";
  return DEFAULT_EXPERT_CONSULT_LEADS;
}

/** 与 .jsonl 同目录、同名改后缀，便于后台用 Excel 打开 */
function consultLeadsCsvPath(jsonlPath) {
  if (jsonlPath.toLowerCase().endsWith(".jsonl")) return `${jsonlPath.slice(0, -".jsonl".length)}.csv`;
  return `${jsonlPath}.csv`;
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function appendConsultLeadRecord(record) {
  try {
    const jsonlAbs = resolveConsultLeadsFilePath();
    fs.mkdirSync(path.dirname(jsonlAbs), { recursive: true });
    fs.appendFileSync(jsonlAbs, `${JSON.stringify(record)}\n`, "utf8");

    const csvAbs = consultLeadsCsvPath(jsonlAbs);
    const wechatStr = record.wechat ?? "";
    const row = `${csvEscape(record.email)},${csvEscape(wechatStr)},${csvEscape(record.at)}\n`;
    if (!fs.existsSync(csvAbs)) {
      const header = "\ufeff邮箱,微信,提交时间(UTC)\n";
      fs.writeFileSync(csvAbs, header + row, "utf8");
    } else {
      fs.appendFileSync(csvAbs, row, "utf8");
    }
  } catch (e) {
    console.error("[consult-lead] file write failed:", e);
  }
}

app.post("/api/consult-lead", (req, res) => {
  const email = String(req.body?.email || "").trim();
  const wechat = String(req.body?.wechat || "").trim().slice(0, 64);
  const locale = req.body?.locale === "en" ? "en" : "zh";
  const source = String(req.body?.source || "report_advisor_support").trim().slice(0, 80) || "report_advisor_support";
  if (!email || !isValidConsultEmail(email)) {
    return res.status(400).json({ error: "请提供有效邮箱地址" });
  }
  void (async () => {
    const admin = supabaseAdmin();
    const token = bearerToken(req);
    let userId = null;
    if (admin && token) {
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (!userErr && userData?.user?.id) userId = userData.user.id;
    }

    const applicationId = userId ? String(req.body?.applicationId || "").trim() || null : null;
    const reportId = userId ? String(req.body?.reportId || "").trim() || null : null;
    const record = {
      user_id: userId,
      application_id: applicationId,
      report_id: reportId,
      email,
      wechat: wechat || null,
      locale,
      source,
    };
    console.log("[consult-lead]", JSON.stringify({ email, wechat: wechat || null, locale, source, userId, applicationId, reportId }));

    if (admin) {
      const { error } = await admin.from("expert_consult_leads").insert(record);
      if (error) {
        console.error("[consult-lead] supabase insert failed:", error.message);
        if (IS_PROD) return res.status(500).json({ error: "lead_save_failed" });
      } else {
        return res.json({ ok: true });
      }
    }

    appendConsultLeadRecord({ email, wechat: wechat || null, locale, source, userId, applicationId, reportId, at: new Date().toISOString() });
    return res.json({ ok: true, fallback: true });
  })().catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[consult-lead] unexpected failure:", msg);
    return res.status(500).json({ error: IS_PROD ? "lead_save_failed" : msg });
  });
});

/** Local dev: create counselor Auth user + counselors row (needs SUPABASE_SERVICE_ROLE_KEY in .env). */
registerAdminCrmRoutes(app, { supabaseAdmin });
const requireCrmAdmin = async (req, res) => {
    const admin = supabaseAdmin();
    if (!admin) {
      res.status(503).json({ error: "supabase_admin_missing" });
      return null;
    }
    const emails = (process.env.CRM_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!emails.length) {
      res.status(503).json({ error: "crm_admin_not_configured" });
      return null;
    }
    const token = (req.headers.authorization || "").startsWith("Bearer ")
      ? req.headers.authorization.slice(7).trim()
      : "";
    if (!token) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user?.email) {
      res.status(401).json({ error: "invalid_session" });
      return null;
    }
    const email = data.user.email.toLowerCase();
    if (!emails.includes(email)) {
      res.status(403).json({ error: "admin_forbidden" });
      return null;
    }
    return { admin, user: data.user };
};

registerAdminEvalRoutes(app, {
  requireAdmin: requireCrmAdmin,
  generateReportForAdmin,
});
registerTrainingCorpusRoutes(app, {
  requireAdmin: requireCrmAdmin,
  buildUserPayload,
  systemPromptForLocale,
});
registerEngineStandardsRoutes(app, {
  requireAdmin: requireCrmAdmin,
});
ensureBenchmarksLoaded().catch((e) =>
  console.warn("[engine-benchmarks] preload_failed", e instanceof Error ? e.message : e),
);
registerCounselorCrmRoutes(app, { supabaseAdmin });
registerUsHighSchoolRoutes(app);
registerTranscriptParseRoutes(app, express);
registerActivitiesParseRoutes(app, express);

app.post("/api/dev/seed-counselor", (req, res) => {
  if (IS_PROD) return res.status(404).json({ error: "not_found" });
  const admin = supabaseAdmin();
  if (!admin) {
    return res.status(503).json({
      error: "missing_service_role",
      hint: "Add SUPABASE_SERVICE_ROLE_KEY to .env or run supabase/bootstrap-counselor-weiyiwang.sql in SQL Editor",
    });
  }
  const email = String(req.body?.email || "weiyiwang603@gmail.com").trim();
  const password = String(req.body?.password || "").trim();
  if (!password) {
    return res.status(400).json({ error: "password_required" });
  }
  void (async () => {
    let userId;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) throw listErr;
      const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) throw createErr;
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user?.id;
    }
    if (!userId) throw new Error("no_user_id");
    const { error: insErr } = await admin.from("counselors").upsert(
      {
        user_id: userId,
        name: "王老师",
        title: "首席留学顾问",
        email,
        active: true,
      },
      { onConflict: "user_id" },
    );
    if (insErr) throw insErr;
    return res.json({ ok: true, email, userId });
  })().catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  });
});

app.get("/api/health", async (_req, res) => {
  const cfg = resolveLLMConfig();
  const stripeCheckout = stripeReadyForCheckout();
  const essayAnalysisCheckout = stripeReadyForEssayAnalysisCheckout();
  const stripe = stripeConfigStatus();
  const { secret, priceId, siteUrl } = stripeEnv();
  /** @type {Record<string, unknown>} */
  const stripeDiagnostics = { siteUrlResolved: siteUrl || null };
  if (stripeCheckout && secret && priceId) {
    try {
      const stripeClient = new Stripe(secret);
      const check = await validateStripeCheckoutPrice(stripeClient, priceId);
      stripeDiagnostics.reportPrice = check.ok
        ? { active: check.price.active, type: check.price.type, currency: check.price.currency }
        : { error: check.code, message: redactStripeMessage(check.message) };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      stripeDiagnostics.reportPrice = {
        error: /expired api key/i.test(raw) ? "stripe_key_expired" : "stripe_price_lookup_failed",
        message: redactStripeMessage(raw),
      };
    }
  }
  const payload = {
    ok: true,
    llm: !("error" in cfg),
    stripeCheckout,
    essayAnalysisCheckout,
    crmAdmin: crmAdminConfigured(),
    stripe: { ...stripe, diagnostics: stripeDiagnostics },
  };
  if ("error" in cfg) {
    return res.json({ ...payload, llm: false, llmError: cfg.error });
  }
  return res.json({
    ...payload,
    llmRegion: cfg.region,
    provider: cfg.provider,
  });
});

/** 生产：同一进程托管 Vite 构建产物（非 Vercel；Vercel 由 CDN 提供 dist） */
const distDir = path.join(__dirname, "..", "dist");
const shouldServeDist =
  !process.env.VERCEL &&
  (process.env.SERVE_DIST === "1" ||
    process.env.SERVE_DIST === "true" ||
    (process.env.NODE_ENV === "production" && fs.existsSync(path.join(distDir, "index.html"))));

if (shouldServeDist && fs.existsSync(path.join(distDir, "index.html"))) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "not_found" });
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
  console.log(`[static] serving ${distDir}`);
}

const port = Number(process.env.PORT || 8787);

if (!process.env.VERCEL) {
  const server = app.listen(port, () => {
    const cfg = resolveLLMConfig();
    if ("error" in cfg) {
      console.log(`API http://127.0.0.1:${port} | 配置未就绪: ${cfg.error}`);
      return;
    }
    const { baseURL, model, region, provider } = cfg;
    console.log(
      `API http://127.0.0.1:${port} | llmRegion=${region} | provider=${provider} | baseURL=${baseURL || "(官方默认)"} | model=${model}`,
    );
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(
        `[API] 端口 ${port} 已被占用。\n` +
          `  做法 A：结束占用进程后再启动：\n` +
          `       lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
          `       kill <上面看到的 PID>\n` +
          `  做法 B：在 college-strategy-mvp/.env 里设置 PORT=8788（或任意空闲端口），保存后重新执行 npm run dev。\n` +
          `       （Vite 代理会读取同一 PORT，无需改 vite.config。）`,
      );
      process.exit(1);
    }
    throw err;
  });
}

export default app;
