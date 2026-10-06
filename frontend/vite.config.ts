/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server proxies /api to FastAPI, so the browser talks to one origin.
export default defineConfig({
  plugins: [react()],
  build: {
    // Recharts (the largest dependency) in its own long-cached chunk.
    rollupOptions: { output: { manualChunks: { charts: ["recharts"] } } },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" }, // FastAPI dev server (uvicorn default port)
  },
  test: {
    environment: "jsdom",
    globals: true, // lets Testing Library unmount each render automatically
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
