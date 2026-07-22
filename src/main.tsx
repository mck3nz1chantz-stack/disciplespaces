import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

const SW_RELOAD_KEY = "ds-sw-reload-once";

/**
 * When a new SW takes control, reload once so HTML/JS/CSS hashes match.
 * Avoids white-screen “bricks” from mixed old shell + new index.
 */
function wireServiceWorkerReload() {
  if (!("serviceWorker" in navigator)) return;

  let reloading = false;
  const safeReload = () => {
    if (reloading) return;
    try {
      if (sessionStorage.getItem(SW_RELOAD_KEY) === "1") return;
      sessionStorage.setItem(SW_RELOAD_KEY, "1");
    } catch {
      // sessionStorage blocked — still try one reload
    }
    reloading = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    safeReload();
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "DS_SW_ACTIVATED") {
      safeReload();
    }
  });

  // Clear the one-shot flag after a successful paint so future updates can reload
  window.addEventListener("load", () => {
    window.setTimeout(() => {
      try {
        sessionStorage.removeItem(SW_RELOAD_KEY);
      } catch {
        // ignore
      }
    }, 2500);
  });
}

/** Register public/sw.js for offline shell + Bible cache (production / preview). */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Skip noisy SW on pure Vite HMR unless explicitly testing PWA
  if (import.meta.env.DEV) {
    return;
  }
  wireServiceWorkerReload();
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
