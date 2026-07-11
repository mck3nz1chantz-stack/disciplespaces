import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
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
  </StrictMode>
);

// Register service worker for offline app shell (production builds).
if ("serviceWorker" in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        useAppStore.getState().setOfflineReady(true);
      }
    },
    onOfflineReady() {
      useAppStore.getState().setOfflineReady(true);
    },
  });
}
