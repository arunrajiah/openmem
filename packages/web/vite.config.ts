import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    // Built directly into companion's public/ dir so it's served on the same port.
    outDir: resolve(__dirname, "../companion/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/ingest": "http://127.0.0.1:7410",
      "/conversations": "http://127.0.0.1:7410",
      "/search": "http://127.0.0.1:7410",
      "/health": "http://127.0.0.1:7410",
    },
  },
});
