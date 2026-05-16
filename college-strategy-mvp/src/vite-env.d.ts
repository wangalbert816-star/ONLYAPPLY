/// <reference types="vite/client" />

/** 由 vite.config `define` 注入；`vite build` 下为空字符串 */
declare const __DEV_API_ORIGIN__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "true"：报告页走 Stripe 结账；需同时配置 API 侧 Stripe 与环境变量 */
  readonly VITE_ENABLE_STRIPE_CHECKOUT?: string;
  /** "true"：启用邀请码核销（需在 Supabase 部署 schema-invite-codes-v1.sql） */
  readonly VITE_ENABLE_INVITE_CODES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
