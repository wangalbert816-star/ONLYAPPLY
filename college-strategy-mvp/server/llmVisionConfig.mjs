/** Shared vision-capable LLM client config (matches server/index.mjs env conventions). */

import OpenAI from "openai";

const DEFAULT_ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3";

function trimKey(raw) {
  return String(raw || "")
    .trim()
    .replace(/^["']+|["']+$/g, "");
}

function looksLikeOllamaCloudApiKey(key) {
  return /^[a-f0-9]{32}\.[A-Za-z0-9_-]+$/i.test(key);
}

function tryBuildChinaArkConfig() {
  const key = trimKey(process.env.ARK_API_KEY || process.env.OPENAI_API_KEY);
  if (!key) return null;

  const explicitBase = trimKey(process.env.ARK_BASE_URL || process.env.OPENAI_BASE_URL).replace(/\/$/, "");
  const modelRaw = trimKey(process.env.TRANSCRIPT_VISION_MODEL || process.env.ARK_ENDPOINT_ID || process.env.OPENAI_MODEL);
  const isArkKey = /^ark-/i.test(key);
  const explicitIsArk = /volces\.com|volcengine|ark\.cn/i.test(explicitBase);
  const forceArk = String(process.env.LLM_PROVIDER || "").toLowerCase() === "ark";
  if (!isArkKey && !explicitIsArk && !forceArk) return null;

  const baseURL = explicitBase || DEFAULT_ARK_BASE;
  if (!/^ep-/.test(modelRaw)) return null;

  return { key, baseURL, model: modelRaw, region: "cn", provider: "volcengine-ark" };
}

function tryBuildUSOpenAIConfig() {
  let key = trimKey(process.env.US_OPENAI_API_KEY);
  /** @type {"us" | "ollama" | "shared" | "none"} */
  let keySource = key ? "us" : "none";

  if (!key) {
    const ollamaKey = trimKey(process.env.OLLAMA_API_KEY);
    if (ollamaKey) {
      key = ollamaKey;
      keySource = "ollama";
    }
  }

  if (!key) {
    const alt = trimKey(process.env.OPENAI_API_KEY);
    if (alt && !/^ark-/i.test(alt)) {
      key = alt;
      keySource = "shared";
    }
  }
  if (!key || /^ark-/i.test(key)) return null;

  let model = trimKey(process.env.TRANSCRIPT_VISION_MODEL || process.env.US_OPENAI_MODEL);
  if (!model) model = trimKey(process.env.OLLAMA_MODEL);
  if (!model) {
    const om = trimKey(process.env.OPENAI_MODEL);
    if (om && !/^ep-/i.test(om)) model = om;
  }
  if (!model) model = "gpt-4o-mini";
  if (/^ep-/i.test(model)) return null;

  let explicitBase = trimKey(process.env.US_OPENAI_BASE_URL).replace(/\/$/, "");
  if (!explicitBase && (keySource === "ollama" || looksLikeOllamaCloudApiKey(key))) {
    explicitBase = trimKey(process.env.OLLAMA_BASE_URL || "https://ollama.com/v1").replace(/\/$/, "");
  }
  if (!explicitBase) {
    const ob = trimKey(process.env.OPENAI_BASE_URL).replace(/\/$/, "");
    if (ob && !/volces\.com|volcengine|ark\.cn/i.test(ob)) explicitBase = ob;
  }

  const inferOllama =
    keySource === "ollama" ||
    looksLikeOllamaCloudApiKey(key) ||
    /ollama\.com|localhost:11434|127\.0\.0\.1:11434/i.test(explicitBase || "");

  return {
    key,
    baseURL: explicitBase || undefined,
    model,
    region: "us",
    provider: inferOllama ? "ollama" : "openai",
  };
}

/**
 * @returns {{ client: import("openai").OpenAI, model: string, region: string, provider: string } | null}
 */
export function resolveVisionLlmClient() {
  const region = (process.env.LLM_REGION || "auto").toLowerCase().trim();
  const visionModelOverride = trimKey(process.env.TRANSCRIPT_VISION_MODEL);
  const cn = tryBuildChinaArkConfig();
  const us = tryBuildUSOpenAIConfig();

  /** @type {{ key: string, baseURL?: string, model: string, region: string, provider: string } | null} */
  let picked = null;

  // Dedicated transcript vision ep- always routes through Ark, even when LLM_REGION=auto prefers Ollama.
  if (/^ep-/.test(visionModelOverride) && cn) {
    picked = { ...cn, model: visionModelOverride };
  } else if (region === "cn") {
    picked = cn;
  } else if (region === "us") {
    picked = us;
  } else if (region === "auto") {
    picked = us?.provider === "ollama" ? us : us || cn;
  }

  if (!picked) return null;

  const timeoutMs = (() => {
    const configured = Number(process.env.TRANSCRIPT_VISION_TIMEOUT_MS || 0);
    return configured > 0 ? configured : 180_000;
  })();

  const client = new OpenAI({
    apiKey: picked.key,
    ...(picked.baseURL ? { baseURL: picked.baseURL } : {}),
    timeout: timeoutMs,
  });

  return { client, model: picked.model, region: picked.region, provider: picked.provider };
}

export function visionLlmConfigHint(locale = "zh") {
  const isEn = locale === "en";
  if (isEn) {
    return (
      "Image / scanned PDF parsing needs a vision-capable LLM in .env: " +
      "US_OPENAI_API_KEY=sk-… and US_OPENAI_MODEL=gpt-4o-mini (or gpt-4o). " +
      "For Ollama: US_OPENAI_BASE_URL=http://127.0.0.1:11434/v1, US_OPENAI_MODEL=llava (or another vision model). " +
      "For Volcengine Ark: ARK_API_KEY=ark-…, TRANSCRIPT_VISION_MODEL=ep-… (vision endpoint). " +
      "Restart npm run dev after editing .env."
    );
  }
  return (
    "图片 / 扫描版 PDF 解析需在 .env 配置支持视觉的 LLM：" +
    "US_OPENAI_API_KEY=sk-…，US_OPENAI_MODEL=gpt-4o-mini（或 gpt-4o）。" +
    "Ollama 本地：US_OPENAI_BASE_URL=http://127.0.0.1:11434/v1，US_OPENAI_MODEL=llava 等视觉模型。" +
    "火山方舟：ARK_API_KEY=ark-…，TRANSCRIPT_VISION_MODEL=ep-…（须为支持图片的接入点）。" +
    "改完 .env 后重启 npm run dev。"
  );
}
