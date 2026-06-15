import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(rootDir, ".env"), override: true });

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, rootDir, "");
  const apiPort = env.PORT || "8787";
  const apiOrigin = `http://127.0.0.1:${apiPort}`;
  const apiProxy = {
    "/api": {
      target: apiOrigin,
      changeOrigin: true,
      timeout: 300_000,
      proxyTimeout: 300_000,
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    /** dev + preview 下直连 API，与代理目标同源，避免留资/报告接口连不上 */
    define: {
      __DEV_API_ORIGIN__: JSON.stringify(command === "serve" ? apiOrigin : ""),
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: apiProxy,
    },
    preview: {
      proxy: apiProxy,
    },
  };
});
