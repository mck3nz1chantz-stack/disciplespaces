import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useAppStore } from "./stores/useAppStore";
import { initPwaInstallListeners } from "./hooks/usePwaInstall";
import {
  applyTheme,
  getStoredThemePreference,
} from "./lib/theme";

initPwaInstallListeners();
// Re-apply stored preference (inline script in index.html already set first paint)
applyTheme(getStoredThemePreference());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/** Register public/sw.js for offline shell + Bible cache (production / preview). */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Skip noisy SW on pure Vite HMR unless explicitly testing PWA
  if (import.meta.env.DEV) {
    return;
  }
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        useAppStore.getState().setOfflineReady(true);
        // New SW (e.g. favicon cache bump) takes over ASAP
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // Activate immediately so icon/shell updates apply
              worker.postMessage?.({ type: "SKIP_WAITING" });
            }
          });
        });
        registration.update().catch(() => {});
      })
      .catch(() => {
        // Offline shell not required for first paint
      });
  });
}

registerServiceWorker();
