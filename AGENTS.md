# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
The product lives in `college-strategy-mvp/` (OnlyApply / 个性化选校策略). It is a single
Node project that runs two dev processes together:
- **Vite** React+TS frontend (default `http://localhost:5173`)
- **Express** API (`server/index.mjs`, port from `.env` `PORT`, here `8788`) serving `/api/*`.
  The Vite dev server proxies `/api` to that port.

All commands below run from `college-strategy-mvp/` (the repo root is one level up).
Standard scripts are defined in `college-strategy-mvp/package.json` — use those rather than
re-deriving commands:
- Run dev (both servers): `npm run dev`
- Lint / typecheck + build: `npm run build` (`tsc --noEmit && vite build`); typecheck alone: `npx tsc --noEmit`
- Tests: `npm run test:data` (standalone data-quality tests, no services needed).
  `scripts/test-local-integration.mjs` exists but needs real Supabase creds and is normally skipped.

### Local LLM is required for report generation (the core feature)
`POST /api/report` (the questionnaire → report flow) calls an OpenAI-compatible LLM. There is no
hosted key in this environment, so a **local Ollama** is used. Config lives in
`college-strategy-mvp/.env` (gitignored, persists in the VM snapshot):
```
LLM_REGION=us
PORT=8788
US_OPENAI_API_KEY=ollama
US_OPENAI_BASE_URL=http://127.0.0.1:11434/v1
US_OPENAI_MODEL=llama3.2:1b
LLM_TIMEOUT_MS=290000
```
Ollama and the `llama3.2:1b` model (and `qwen2.5:3b`) are installed in the snapshot. There is
**no systemd** in this VM, so Ollama is not auto-started. Start it manually (e.g. in a tmux session)
before generating reports, and pin the model in memory so it stays warm:
```
OLLAMA_KEEP_ALIVE=-1 OLLAMA_HOST=127.0.0.1:11434 ollama serve
```
Then pre-warm once: `curl -s http://127.0.0.1:11434/v1/chat/completions -H 'Content-Type: application/json' -d '{"model":"llama3.2:1b","messages":[{"role":"user","content":"ok"}],"max_tokens":3}'`.
Verify with `curl -s http://127.0.0.1:11434/api/version` and the app's own check
`curl -s http://127.0.0.1:8788/api/health` (expect `"llm":true`).

`llama3.2:1b` is chosen because CPU inference is slow and the school lists come from the deterministic
decision engine (the LLM only writes prose), so a small fast model is sufficient. `qwen2.5:3b` is also
pulled and adheres to JSON slightly better, but is ~2–3x slower and can blow the timeout on a cold start.

### CRITICAL Ollama gotcha (segfault)
On this VM's virtualized CPU the AMX / Sapphire Rapids ggml backend **segfaults at model warmup**
(`llama-server process has terminated: signal: segmentation fault`). The fix already applied in the
snapshot: the offending variant was moved to `/usr/local/lib/ollama/disabled/`:
```
sudo mv /usr/local/lib/ollama/libggml-cpu-sapphirerapids.so /usr/local/lib/ollama/disabled/
```
Ollama then auto-selects a lower AVX-512 variant and works. **If you ever reinstall/upgrade Ollama,
re-apply this move**, otherwise every model load will crash.

### Report-generation behavior to expect
- CPU inference is slow. With the model warm (`OLLAMA_KEEP_ALIVE=-1` + pre-warm) a report finishes in
  ~15–70s. A **cold** model or a JSON-schema validation retry can push it to 3–4 min and may exceed the
  timeout — so always keep the model warm. `LLM_TIMEOUT_MS=290000` gives headroom under the Vite
  proxy's 300s cap. Be patient; don't re-click "生成策略".
- The frontend persists questionnaire progress in `localStorage`. To start a clean run in the browser,
  run `localStorage.clear(); sessionStorage.clear(); location.reload();` in the DevTools console first.
- School lists (reach/match/safety) come from the deterministic decision engine; the LLM mostly writes
  the prose, so school names are stable even with a small model.
- The report UI is freemium: only the first school per tier is shown unless logged in (Supabase) — this
  is expected, not a bug.

### Optional integrations (not configured here, app works without them)
Supabase (login + saved reports), Stripe (one-time unlock), and invite codes are all optional and
gated behind `VITE_*` / server env vars. With none set, the app runs anonymously and report generation
still works. See `college-strategy-mvp/README.md` for enabling them.
