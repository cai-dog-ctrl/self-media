import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  // maplibre-gl v6 通过 import.meta.url 创建 module worker，
  // 被 Vite 预打包后 worker URL 解析会失败（"Worker failed to load"），必须排除
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
});
