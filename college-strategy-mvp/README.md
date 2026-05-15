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
2. **Authentication** 中启用 **Email**（Magic Link）与 **Google**；在 **URL Configuration** 将 Site URL 设为本地开发地址（如 `http://localhost:5173`），并把该地址加入 Redirect URLs。
3. 在 **Project Settings → API** 复制 URL 与 `anon` key，写入 `.env`：

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. 重新 `npm run dev`。登录后生成或解锁报告会自动写入 `saved_applications` / `saved_reports`；「我的申请」可查看历史并重新打开。

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

> 生产环境需自行部署 API（`server/index.mjs`）并配置前端 `proxy` 或环境变量指向真实 API 地址。

## 技术栈

- React 18 + TypeScript + Vite 5
- Express + OpenAI SDK（JSON 输出）

## 免责声明

报告由 AI 根据问卷生成，涉及录取、费用、奖助学金、截止日期等，**务必以各校官网为准**。本产品不构成任何录取或法律承诺。
