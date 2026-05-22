# 个性化选校策略 MVP

问卷（3 步）→ 调用大模型（OpenAI 官方 **或** 火山方舟兼容接口）→ 结构化报告：冲/稳/保、理由、风险、提升建议。

## 本地运行

```bash
cd college-strategy-mvp
cp .env.example .env
# 编辑 .env：见下方「模型提供方」；可选配置 Supabase（登录与保存）

npm install
npm run dev
```

### 登录与云端保存（可选 Supabase）

未配置时应用仍可匿名使用；配置后可在报告页登录并保存问卷与报告。

1. 在 [Supabase](https://supabase.com) 新建项目，在 **SQL Editor** 执行 `supabase/schema.sql`。
2. **Authentication → URL Configuration**：Site URL = `http://localhost:5173`；Redirect URLs 增加 `http://localhost:5173/**`（上线后换成正式域名）。
3. **Authentication → Providers → Google**（推荐，无邮件限流）：
   - 打开 [Google Cloud Console](https://console.cloud.google.com/) → 创建项目（或选已有）→ **API 和服务** → **凭据** → **创建凭据** → **OAuth 客户端 ID** → 类型选 **Web 应用**。
   - **已授权的 JavaScript 来源**：`http://localhost:5173`（上线后加正式域名）。
   - **已授权的重定向 URI**：复制 Supabase 该页显示的 **Callback URL**（形如 `https://<project-ref>.supabase.co/auth/v1/callback`），粘贴到 Google。
   - 把 Google 的 **Client ID**、**Client Secret** 填回 Supabase Google 提供商并 **Enable**。
4. **Authentication → Providers → Email**：可选；Magic Link 受 Supabase 发信频率限制，开发期建议优先用 Google。
5. 在 **Project Settings → API** 复制 URL 与 `anon` key，写入 `.env`：

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

6. 重新 `npm run dev`。点左上角 **登录** → **使用 Google 登录**，授权后回到本站即已登录；报告会自动保存到「我的申请」。

### Stripe 一次性付费解锁（可选）

- **语义**：一笔支付解锁**当前这条已保存的申请**（`saved_applications`），该记录下**所有历史报告版本**均视为完整版。必须先登录并在云端有一条 `saved_reports` 记录后才能创建 Checkout Session。
- **数据库**：在 Supabase **SQL Editor** 执行 `supabase/schema-stripe-entitlements.sql`（在原 `schema.sql` 之后执行即可）。

**配齐 checklist（按顺序）：**

1. **Stripe Dashboard**  
   - 创建 **Product**，添加 **一次性付款**（one-time）的 **Price**，复制 **Price ID**（形如 `price_...`）→ 填入 `.env` 的 `STRIPE_PRICE_ID`。  
   - **Developers → API keys**：复制 **Secret key**（测试用 `sk_test_...`）→ `STRIPE_SECRET_KEY`。

2. **Webhook（付完款写入权益表；不配则用户付完也不会解锁）**  
   - **线上**：Developers → Webhooks → Add endpoint，URL = `https://你的后端域名/api/stripe/webhook`，事件勾选 **`checkout.session.completed`**，保存后复制 **Signing secret** → `STRIPE_WEBHOOK_SECRET`。  
   - **本地**：安装 [Stripe CLI](https://stripe.com/docs/stripe-cli)，执行：  
     `stripe listen --forward-to 127.0.0.1:PORT/api/stripe/webhook`  
     其中 **PORT 与 `college-strategy-mvp/.env` 里 `PORT` 一致**（示例里常用 `8788`；勿照抄旧文档里的 `8787`）。CLI 会打印一个 `whsec_...` → 填进 `STRIPE_WEBHOOK_SECRET`。

3. **Supabase 服务端密钥**（仅供 `server/index.mjs` 校验用户 JWT、Webhook 里写库；**不要**写进任何 `VITE_*`）  
   - Project **Settings → API** → **service_role** → `SUPABASE_SERVICE_ROLE_KEY`  
   - `SUPABASE_URL` 可省略，服务端会回退使用 `VITE_SUPABASE_URL`。

4. **站点回跳地址**  
   - `SITE_URL` = 用户浏览器打开的**站点根地址**，无尾斜杠，例如 `http://localhost:5173`（需与 Supabase Auth 的 Site URL 一致或可重定向）。

5. **自检**：`npm run dev` 后浏览器或终端访问  
   `http://127.0.0.1:PORT/api/health`  
   查看 JSON 里 **`stripe.createCheckoutSession`** 与 **`stripe.webhookVerified`**；若 `stripe.envBlockers` 非空，按其中项补 `.env`。

6. **前端开关**：在 `.env` 增加 **`VITE_ENABLE_STRIPE_CHECKOUT=true`**，保存后**重启** `npm run dev`。

- **可与邀请码并存**：可同时 `VITE_ENABLE_INVITE_CODES=true`，报告页会显示结账主按钮 + 下方邀请码兑换。

- **生产**：API 必须使用 **HTTPS** 公网地址配置 Stripe Webhook；`SITE_URL` 设为正式前端域名。

### 邀请码解锁（可选，第一版在 Supabase 管理码）

- **数据库**：在 **SQL Editor** 依次执行 `schema-stripe-entitlements.sql`（若未执行过）与 `supabase/schema-invite-codes-v1.sql`。码在 Dashboard 用 SQL 插入 `invite_codes` 即可，无需自建后台。
- **前端**：`.env` 设置 `VITE_ENABLE_INVITE_CODES=true`。可与 `VITE_ENABLE_STRIPE_CHECKOUT` 同时开启（页面上支付与邀请码并存）。
- **流程**：用户登录 → 报告保存到「我的申请」→ 在报告预览区输入邀请码 → 调用 RPC `redeem_invite_code` 写入权益表。

### 模型提供方

**OpenAI 官方**：只填 `OPENAI_API_KEY`；可不填 `OPENAI_BASE_URL`；`OPENAI_MODEL` 默认 `gpt-4o-mini`。

**火山方舟**（推荐）：在项目根目录 `college-strategy-mvp/.env` 配置：

- `OPENAI_API_KEY`（或 `ARK_API_KEY`）= 方舟控制台 **API Key**（常见 **`ark-` 开头**）
- `OPENAI_MODEL`（或 `ARK_ENDPOINT_ID`）= **`ep-` 推理接入点 ID**
- `OPENAI_BASE_URL` / `ARK_BASE_URL`：**可不写**——只要 Key 以 `ark-` 开头，服务端会自动使用方舟北京兼容网关（见 `server/index.mjs` 中 `DEFAULT_ARK_BASE`）；地域不对时再按[方舟文档](https://www.volcengine.com/docs/82379/1330626)改 URL。

`.env` 始终从**项目根目录**加载，避免从错误工作目录启动 `node` 时读不到配置、误连 OpenAI 官方而出现 `401`（错误里可能仍显示 `sk-....` 为脱敏文案）。

若 Key 不是 `ark-` 但仍强制走方舟，可设 `LLM_PROVIDER=ark`。

### 付费话术 A/B（报告页）

在报告页 URL 加参数切换三套文案（默认 `rational`）：

- `?paywall=rational`：偏理性，强调省时间、可核对、可执行清单  
- `?paywall=anxiety`：偏焦虑，强调错 list 的代价、风险摊开  
- `?paywall=curiosity`：偏好奇，配合「校名指纹」强钩子（首字 + 字数，与完整版一致）

示例：`http://localhost:5173/?paywall=anxiety`（端口以终端为准）

浏览器打开终端里提示的 Vite 地址（一般为 `http://localhost:5173`；端口被占用时会顺延）。  
`npm run dev` 会同时启动：

- **Vite** 前端（默认 5173）
- **Express** API（默认 **8787**，`/api/report`；代理从 `.env` 的 `PORT` 读取，与 API 一致）

若 API 报错 **`EADDRINUSE: address already in use :::8787`**：说明 8787 已被其它进程占用（常见是之前没关掉的 `node server/index.mjs`）。任选其一：用 `lsof -nP -iTCP:8787 -sTCP:LISTEN` 找到 PID 后 `kill`；或在 `.env` 里设 `PORT=8788` 后重新 `npm run dev`。

前端通过代理访问 `/api/report`，无需改 CORS。

仅生产构建前端：

```bash
npm run build
npm run preview
```

> 除 **Vercel**（见下节）外，若只部署静态 `dist/`，需另起 Node 提供 `/api` 或改前端 API 基地址。

### 上线部署（先不接 Stripe 亦可）

当前生产构建里前端请求走**相对路径** `/api/*`，因此最简单是 **同一域名** 同时提供静态页与 API：

1. **构建**：在仓库 `college-strategy-mvp` 目录执行 `npm ci`（或 `npm install`）后 `npm run build`，生成 `dist/`。
2. **启动**：`NODE_ENV=production` 且存在 `dist/index.html` 时，`node server/index.mjs` 会**自动托管 `dist`** 并继续提供 `/api`（也可用 `SERVE_DIST=1` 强制开启）。`package.json` 已提供 **`npm start`**。
3. **平台环境变量**（在 Railway / Fly.io / Render 等面板配置，勿提交进 Git）：
   - 与本地相同的 **LLM**（`OPENAI_*` / `US_*` 等）、**`PORT`**（多数平台注入，可不写）
   - **`VITE_SUPABASE_URL`**、**`VITE_SUPABASE_ANON_KEY`**（构建与运行时若同机可先 build 再 start；若 CI 分步构建，需在 **build 阶段** 注入以打进前端包）
   - 上线用邀请码：**`VITE_ENABLE_INVITE_CODES=true`**；**不要**开 `VITE_ENABLE_STRIPE_CHECKOUT` 直到 Stripe 配齐
4. **Supabase Auth**：**Authentication → URL Configuration** 里 **Site URL**、**Redirect URLs** 改为你的**正式站点根地址**（与浏览器打开的一致）。
5. **健康检查**：部署后访问 `https://你的域名/api/health`，确认 `llm: true`（或你接受的配置）与无意外 5xx。

**分两域部署**（例如静态在 CDN、API 在另一子域）时，需在构建前增加 `VITE_PUBLIC_API_ORIGIN` 等改造；当前仓库默认**单服务**方案，改动最少。

### Vercel 托管

仓库内已包含 **`vercel.json`** 与 **`api/index.js`**：`dist` 由 Vercel 静态提供，所有 **`/api/*`** 进入 **Serverless** 里的同一 Express 应用（与本地相对路径一致）。

1. [Vercel](https://vercel.com) → New Project → 导入本 Git 仓库。  
2. **Root Directory** 设为 **`college-strategy-mvp`**（若仓库根目录不是该子目录则必须设置，否则读不到 `vercel.json`）。  
3. **Framework Preset** 选 **Other**（或 Vite；以能执行 `npm run build` 且 **Output Directory = `dist`** 为准）。  
4. **Environment Variables**（Production / Preview 按需同步），与本地 `.env` 对齐，至少包括：
   - **构建 + 前端**：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_ENABLE_INVITE_CODES`（按需 `VITE_ENABLE_STRIPE_CHECKOUT`）  
   - **仅函数运行时**：`OPENAI_*` / `US_*`、`LLM_REGION`、`PORT`（Vercel 可不设）、以及其它 LLM 相关变量  
5. **部署**：Push 到已连接分支或点 **Deploy**。首次上线后打开 **`https://<你的域名>/api/health`** 自检。

**重要限制**

- **报告生成耗时**：`/api/report` 可能需 **1–5 分钟**。`vercel.json` 已设 **`maxDuration`: 300**（Hobby 上限；**Pro** 可在控制台与 `VERCEL_FUNCTION_MAX_SEC` 提到最高 **800**）。若仍超时，请优化模型/输出长度或改用 Workflows / 自建 API。  
- **专家咨询留资**：在 Vercel 上默认写入 **`/tmp`** 下 jsonl（实例间不持久）。正式运营请接 **外部存储 / Webhook**，或设置 `CONSULT_LEADS_FILE` 指向你可写的路径（若使用支持持久卷的平台）。  
- **Stripe Webhook**：以后接支付时，Webhook URL 为 **`https://<你的域名>/api/stripe/webhook`**，且需在 Stripe 与 Vercel 环境变量中配置 `STRIPE_WEBHOOK_SECRET` 等（见上文 Stripe 小节）。

## 技术栈

- React 18 + TypeScript + Vite 5
- Express + OpenAI SDK（JSON 输出）

## 免责声明

报告由 AI 根据问卷生成，涉及录取、费用、奖助学金、截止日期等，**务必以各校官网为准**。本产品不构成任何录取或法律承诺。
