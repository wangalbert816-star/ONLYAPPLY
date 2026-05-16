/**
 * Vercel Serverless：所有 /api/* 经 vercel.json rewrite 进入此函数。
 * 本地开发仍用 `npm run dev`（Vite 代理 + node server/index.mjs），勿依赖本文件。
 */
import app from "../server/index.mjs";

export default app;
