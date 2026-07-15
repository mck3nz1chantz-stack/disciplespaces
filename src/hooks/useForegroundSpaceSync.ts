import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "../stores/useAppStore";
import { isOnlineModeEnabled } from "../lib/onlineMode";
import { isSpaceRelayConfigured, normalizeSpaceSync } from "../lib/sync";

/** Minimum gap between full auto-sync passes (ms). */
const MIN_INTERVAL_MS = 45_000;
/** Don’t spam “Groups updated” toasts more often than this. */
const SUCCESS_TOAST_MIN_MS = 90_000;

/**
 * Soft auto-sync: when the app is foregrounded / online mode / network up,
 * pull+push each connected Space that is not paused. Never touches private notes.
 * Shows a brief success toast (throttled) so people know it happened.
 */
export function useForegroundSpaceSync(): void {
  const lastRun = useRef(0);
  const lastSuccessToast = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    if (!isSpaceRelayConfigured()) return;

    async function syncConnected(reason: string) {
      if (!isOnlineModeEnabled()) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (document.visibilityState === "hidden") return;
      if (running.current) return;

      const now = Date.now();
      if (now - lastRun.current < MIN_INTERVAL_MS && reason !== "manual-boot") {
        return;
      }

      const { spaces, syncSpaceNow, initialize } = useAppStore.getState();
      if (spaces.length === 0) {
        try {
          await initialize();
        } catch {
          return;
        }
      }

      const list = useAppStore.getState().spaces.filter((s) => {
        const sync = normalizeSpaceSync(s.sync);
        return (
          sync.mode === "connected" &&
          Boolean(sync.roomId) &&
          sync.paused !== true
        );
      });

      if (list.length === 0) return;

      running.current = true;
      lastRun.current = Date.now();
      let failures = 0;
      let successes = 0;

      try {
        for (const space of list) {
          try {
            await syncSpaceNow(space.id);
            successes += 1;
          } catch {
            failures += 1;
          }
        }
        if (failures > 0 && failures === list.length) {
          toast.message("Couldn’t refresh groups", {
            description:
              "You’re online, but the connection failed. Tap Sync now on a group.",
            duration: 5000,
          });
        } else if (successes > 0) {
          const t = Date.now();
          if (t - lastSuccessToast.current >= SUCCESS_TOAST_MIN_MS) {
            lastSuccessToast.current = t;
            toast.success(
              successes === 1 ? "Group updated" : "Groups updated",
              {
                description: "Shared meetings are up to date.",
                duration: 2800,
              },
            );
          }
          window.dispatchEvent(new Event("ds-spaces-synced"));
        }
      } finally {
        running.current = false;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncConnected("visible");
      }
    };
    const onOnline = () => void syncConnected("online");
    const onFocus = () => void syncConnected("focus");
    const onMode = () => {
      if (isOnlineModeEnabled()) void syncConnected("mode-online");
    };

    const boot = window.setTimeout(() => {
      void syncConnected("manual-boot");
    }, 2500);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    window.addEventListener("ds-online-mode", onMode);

    return () => {
      window.clearTimeout(boot);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("ds-online-mode", onMode);
    };
  }, []);
}
