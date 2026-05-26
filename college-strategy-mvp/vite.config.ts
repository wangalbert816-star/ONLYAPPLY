import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || "8787";
  const apiOrigin = `http://127.0.0.1:${apiPort}`;
  const apiProxy = {
    "/api": {
      target: apiOrigin,
      changeOrigin: true,
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
