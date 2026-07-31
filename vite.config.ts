import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * PWA: manifest + service worker live in public/ (manifest.webmanifest, sw.js).
 * We avoid vite-plugin-pwa / workbox-build generateSW here — those pull
 * common-tags + graceful-fs paths that break under Node 25/26.
 * Offline behavior is preserved via public/sw.js registered in main.tsx.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    // VDG-004: avoid hung “failed to load page” when esbuild prebundle stalls (Node 26)
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/App.tsx"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  optimizeDeps: {
    // Holding-pattern fix for intermittent Vite hang under Node 26 + lucide
    holdUntilCrawlEnd: false,
    exclude: ["lucide-react"],
    include: [
      "sonner",
      "dexie",
      "dexie-react-hooks",
      "zustand",
      "date-fns",
      "react-router-dom",
      "react",
      "react-dom",
      "react-dom/client",
    ],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
