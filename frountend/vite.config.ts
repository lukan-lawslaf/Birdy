import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // The API client prefixes every call with /api. In dev this forwards to the
    // FastAPI process; in production set VITE_API_URL to the deployed origin.
    proxy: {
      "/api": {
        target: loadEnv(mode, ".", "BIRDPEDIA_").BIRDPEDIA_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "three-vendor": ["three"],
          "motion-vendor": ["motion/react"],
          "react-vendor": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
}));
