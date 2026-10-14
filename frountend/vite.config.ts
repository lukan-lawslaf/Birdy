import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
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
});
