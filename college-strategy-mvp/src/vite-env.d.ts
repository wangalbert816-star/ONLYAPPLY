/// <reference types="vite/client" />

/** 由 vite.config `define` 注入；`vite build` 下为空字符串 */
declare const __DEV_API_ORIGIN__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
