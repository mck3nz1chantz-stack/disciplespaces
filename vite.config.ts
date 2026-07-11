import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    VitePWA({
      registerType: "autoUpdate",
      // Do NOT list data/bible/** here — hashing 4MB+ of KJV JSON during
      // generateSW was hanging builds. Bible books use runtime CacheFirst.
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "DiscipleSpaces",
        short_name: "Spaces",
        description:
          "Private small-group discipleship. Spaces, sessions, offline KJV Bible, and manual sharing — notes stay on your device.",
        theme_color: "#1e3a2f",
        background_color: "#f7f5f0",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        lang: "en",
        categories: ["lifestyle", "education", "productivity"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // App shell only — exclude bible JSON from precache (use runtime cache).
        // Including **/*.json made workbox generateSW hang for many minutes.
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff2,webmanifest}",
        ],
        globIgnores: ["**/data/bible/**", "**/node_modules/**"],
        // SPA navigation offline: serve index so React can route (incl. /help, /offline)
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/data\//],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        runtimeCaching: [
          {
            // KJV books: cache on first read (offline after visit). Index too.
            urlPattern: /\/data\/bible\/.*\.json$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "kjv-bible-data",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["lucide-react"],
    include: [
      "sonner",
      "dexie",
      "dexie-react-hooks",
      "zustand",
      "date-fns",
      "react-router-dom",
    ],
  },
});
