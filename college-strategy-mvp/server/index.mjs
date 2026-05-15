import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 始终从项目根目录加载 .env（避免从别的 cwd 启动 node 时读不到 OPENAI_BASE_URL，误连 OpenAI 官方导致 401）
dotenv.config({ path: path.join(__dirname, "..", ".env") });

/** 方舟 OpenAI 兼容网关（北京）；地域以控制台为准时可改 ARK_BASE_URL */
const DEFAULT_ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3";

/** OpenAI SDK 默认 maxRetries=2，超时/5xx 会重试，同一用户操作可能触发多次模型计费与更长等待 */
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 120_000);
const LLM_MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES ?? 0);
/** 0 = 不传 max_tokens，由模型默认；否则限制输出长度以缩短极端长文耗时 */
const COMPLETION_MAX_TOKENS = Number(process.env.COMPLETION_MAX_TOKENS ?? 6000);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "256kb" }));

const SYSTEM_PROMPT = `你是一位资深美国本科升学顾问（10年+经验），风格：专业、克制、可执行。基于用户问卷生成「选校策略草案」。

【语言】全程简体中文（校名保留英文）。

【顾问感】
- 先判断信息是否足够；不足则在 information_gaps 列出需补充问题（0-6条）。
- 若用户消息末含有【用户补充说明】区块：必须结合其更新 reach/match/safety 的入档理由与风险表述；information_gaps 中已被充分覆盖的点应删除或合并；禁止输出与补充说明明显矛盾的内容。
- 至少3处明确引用用户问卷中的具体字段（预算/身份/标化/专业/偏好/活动）；若有补充说明，至少1处明确引用补充中的事实。
- 禁止「保证」「稳进」「必录」；不编造具体截止日期、具体奖学金金额、具体录取率（除非用户提供了且你仅复述）。

【易变信息】涉及政策/费用/轮次/国际生要求：写「以学校官网当年公布为准」，verification_focus 写核对项但不要写具体日期数字。

【冲稳保】
- 冲：录取不确定性高但有合理申请理由。
- 稳：主战场，总体匹配仍有方差。
- 保：底线逻辑，解释如何降低全拒风险（非随便一所）。

【数量】reach、match、safety 每档恰好 3 所学校（共9所）。

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
  "reach": [{"school":"","why_reach_for_you":"","key_fit_signals":["",""],"key_risks":["",""],"verification_focus":["","",""]}],
  "match": [同结构，但用 why_match_for_you 字段名与冲一致逻辑：说明为何在「稳」档],
  "safety": [同结构，字段 why_safety_for_you],
  "portfolio_risks": [{"risk_title":"","what_it_means_for_you":"","mitigation":""}],
  "improvement_plan": {"this_week":["3-5条"],"this_month":["4-7条"],"before_submitting":["4-7条"]},
  "strategy_notes": ["3-6条"]
}

match 每元素字段名必须为：school, why_match_for_you, key_fit_signals, key_risks, verification_focus
safety 每元素字段名必须为：school, why_safety_for_you, key_fit_signals, key_risks, verification_focus
reach 每元素字段名必须为：school, why_reach_for_you, key_fit_signals, key_risks, verification_focus
`;

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

  if (us) return us;
  if (cn) return cn;
  return {
    error:
      "未配置可用 LLM：请配置 OpenAI 兼容端（US_OPENAI_API_KEY / OLLAMA_API_KEY / sk- 的 OPENAI_API_KEY），和/或火山方舟中国（ARK_API_KEY + ep- 接入点）。Ollama 云见 https://ollama.com/v1 + ollama.com/settings/keys。LLM_REGION=cn|us|auto（默认 auto：优先 US 侧，其次中国方舟）。",
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
    if (out.length >= 12) break;
  }
  return out;
}

function buildUserPayload(body) {
  const {
    intakeTerm,
    applicantIdentity,
    budget,
    testing,
    satScore,
    actScore,
    highSchoolSystem,
    gpa,
    majorPrimary,
    majorSecondary,
    schoolSize,
    geoPrefs,
    activities,
    riskStyle,
    dealbreakers,
  } = body;

  const supplementary = normalizeSupplementaryNotes(body.supplementary_notes);
  let extra = "";
  if (supplementary.length > 0) {
    const lines = supplementary.map((x) => `【${x.topic}】${x.text}`);
    extra = `\n\n【用户补充说明（信息缺口已更新，请据此重写 JSON：档位、理由、风险与 information_gaps 须与补充一致；已覆盖的缺口应移除或显著缩短）】\n${lines.join("\n")}`;
  }

  return `请基于以下问卷生成 JSON 报告（严格遵守 system 的结构与每档3所的数量）。

【申请入学季】${intakeTerm || "未填"}
【申请身份】${applicantIdentity || "未填"}
【目标范围】美国本科
【学费/经济】${budget || "未填"}
【标化策略】${testing || "未填"}${testing === "will_submit" ? `\nSAT: ${satScore || "未填"}\nACT: ${actScore || "未填"}` : ""}

【高中体系】${highSchoolSystem || "未填"}
【GPA/成绩说明】${gpa || "未填"}
【主申专业】${majorPrimary || "未填"}
【备选专业】${majorSecondary || "无"}
【校园规模偏好】${schoolSize || "未填"}
【地理偏好】${Array.isArray(geoPrefs) ? geoPrefs.join("、") : geoPrefs || "未填"}

【活动/奖项摘要】${activities || "未提供"}
【选校风格】${riskStyle || "未填"}
【绝对不能接受】${dealbreakers || "无"}${extra}`;
}

/**
 * 服务端硬校验：9 校互不重复、每档恰好 3 所（不自动改写模型输出，不通过则拒绝返回）。
 * @param {unknown} parsed
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateSchoolUniqueness(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "根对象无效" };
  }
  const o = /** @type {Record<string, unknown>} */ (parsed);
  const tiers = ["reach", "match", "safety"];
  const seen = new Set();
  for (const t of tiers) {
    const rows = o[t];
    if (!Array.isArray(rows) || rows.length !== 3) {
      return {
        ok: false,
        reason: `${t} 须恰好 3 所学校，实际为 ${Array.isArray(rows) ? rows.length : "非数组"}`,
      };
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== "object") {
        return { ok: false, reason: `${t}[${i}] 条目无效` };
      }
      const name = String(/** @type {Record<string, unknown>} */ (row).school || "").trim();
      if (!name) {
        return { ok: false, reason: `${t} 中存在空 school` };
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        return { ok: false, reason: `重复校名：${name}` };
      }
      seen.add(key);
    }
  }
  return { ok: true };
}

app.post("/api/report", async (req, res) => {
  const cfg = resolveLLMConfig();
  if ("error" in cfg) {
    return res.status(500).json({ error: cfg.error });
  }
  const { key, baseURL, model, isArk, region, provider } = cfg;

  try {
    const client = new OpenAI({
      apiKey: key,
      ...(baseURL ? { baseURL } : {}),
      timeout: LLM_TIMEOUT_MS,
      maxRetries: LLM_MAX_RETRIES,
    });
    const userContent = buildUserPayload(req.body || {});

    const tLlm = Date.now();
    const requestBody = {
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    };
    if (provider !== "ollama") {
      requestBody.response_format = { type: "json_object" };
    }
    if (COMPLETION_MAX_TOKENS > 0) {
      requestBody.max_tokens = COMPLETION_MAX_TOKENS;
    }

    const completion = await client.chat.completions.create(requestBody);
    const llmMs = Date.now() - tLlm;
    console.log(`[api/report] llm_ms=${llmMs} model=${model}`);

    const messageContent = completion.choices[0]?.message?.content;
    if (!messageContent) {
      return res.status(502).json({ error: "模型未返回内容" });
    }

    let parsed;
    try {
      parsed = JSON.parse(messageContent);
    } catch {
      return res.status(502).json({
        error: "模型返回非合法 JSON",
        raw: messageContent.slice(0, 500),
      });
    }

    const uniq = validateSchoolUniqueness(parsed);
    if (!uniq.ok) {
      console.warn("[api/report] school_list_invalid:", uniq.reason);
      return res.status(502).json({
        error: `校名单未满足去重规则，请重新点击生成。（${uniq.reason}）`,
      });
    }

    return res
      .setHeader("X-LLM-Duration-Ms", String(llmMs))
      .setHeader("X-LLM-Region", region)
      .setHeader("X-LLM-Provider", provider)
      .json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hint = "";
    if (/401|Incorrect API key/i.test(msg)) {
      hint =
        region === "cn" || isArk
          ? " 当前为中国火山方舟（北京网关）。若仍 401：核对 ARK_API_KEY、ep- 接入点与地域；改 .env 后重启 npm run dev。"
          : provider === "ollama"
            ? " 当前为 Ollama（OpenAI 兼容）。若仍 401：在 ollama.com/settings/keys 核对 key；云端须 US_OPENAI_BASE_URL=https://ollama.com/v1（或设 OLLAMA_API_KEY）；本地一般为 http://127.0.0.1:11434/v1 且 api_key 可填 ollama。"
            : " 当前为 OpenAI 兼容接口。若仍 401：核对 US_OPENAI_API_KEY（或 sk- 的 OPENAI_API_KEY）与 US_OPENAI_BASE_URL；改 .env 后重启。";
    }
    return res.status(500).json({ error: msg + hint });
  }
});

function isValidConsultEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** 默认：项目根 data/expert-consult-leads.jsonl；可用 CONSULT_LEADS_FILE 覆盖 */
const DEFAULT_EXPERT_CONSULT_LEADS = path.join(__dirname, "..", "data", "expert-consult-leads.jsonl");

function resolveConsultLeadsFilePath() {
  const rel = (process.env.CONSULT_LEADS_FILE || "").trim();
  if (!rel) return DEFAULT_EXPERT_CONSULT_LEADS;
  return path.isAbsolute(rel) ? rel : path.join(__dirname, "..", rel);
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
  if (!email || !isValidConsultEmail(email)) {
    return res.status(400).json({ error: "请提供有效邮箱地址" });
  }
  const record = { email, wechat: wechat || null, at: new Date().toISOString() };
  console.log("[consult-lead]", JSON.stringify(record));
  appendConsultLeadRecord(record);
  return res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  const cfg = resolveLLMConfig();
  if ("error" in cfg) {
    return res.json({ ok: true, llm: false, llmError: cfg.error });
  }
  res.json({
    ok: true,
    llm: true,
    llmRegion: cfg.region,
    provider: cfg.provider,
  });
});

const port = Number(process.env.PORT || 8787);
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
