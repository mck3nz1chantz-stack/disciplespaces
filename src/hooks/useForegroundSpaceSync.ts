import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "../stores/useAppStore";
import { isOnlineModeEnabled } from "../lib/onlineMode";
import {
  formatSyncChangeDescription,
  isSpaceRelayConfigured,
  normalizeSpaceSync,
  shouldShowAutoSyncSuccessToast,
  SYNC_FAIL_TOAST_ID,
  SYNC_SUCCESS_TOAST_ID,
  type SyncChangeSummary,
} from "../lib/sync";
import {
  checkAccountVaultOnForeground,
  maybeBootVaultCheck,
} from "../lib/keys/vaultAuto";

/** Minimum gap between full auto-sync passes (ms). */
const MIN_INTERVAL_MS = 45_000;
const VAULT_TOAST_MIN_MS = 120_000;

/**
 * Soft auto-sync: when the app is foregrounded / online mode / network up,
 * 1) Account Key vault check (personal Spaces home under the key)
 * 2) pull+push each connected Space that is not paused
 * Never puts private notes on the room relay.
 */
export function useForegroundSpaceSync(): void {
  const lastRun = useRef(0);
  const lastVaultToast = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    async function syncConnected(reason: string) {
      if (!isOnlineModeEnabled()) return;
      // Do not gate on navigator.onLine — false offline is common on phones.
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

      running.current = true;
      lastRun.current = Date.now();
      let failures = 0;
      let successes = 0;

      try {
        // Phase 4: personal Spaces under Account Key first
        if (reason === "manual-boot") {
          await maybeBootVaultCheck();
        } else {
          const vault = await checkAccountVaultOnForeground();
          if (vault.restored) {
            const t = Date.now();
            if (t - lastVaultToast.current >= VAULT_TOAST_MIN_MS) {
              lastVaultToast.current = t;
              toast.success("Spaces restored from your Account Key", {
                description:
                  vault.spaces > 0
                    ? `${vault.spaces} group${vault.spaces === 1 ? "" : "s"} merged from cloud.`
                    : "Cloud backup applied.",
                duration: 4000,
              });
            }
          }
        }

        if (!isSpaceRelayConfigured()) return;

        const list = useAppStore.getState().spaces.filter((s) => {
          const sync = normalizeSpaceSync(s.sync);
          return (
            sync.mode === "connected" &&
            Boolean(sync.roomId) &&
            sync.paused !== true
          );
        });

        if (list.length === 0) return;

        let anyNotable = false;
        let lastChanges: SyncChangeSummary | null = null;
        for (const space of list) {
          try {
            const { changes } = await syncSpaceNow(space.id);
            successes += 1;
            if (changes.hasChanges) {
              anyNotable = true;
              lastChanges = changes;
            }
          } catch {
            failures += 1;
          }
        }
        if (failures > 0 && failures === list.length) {
          const failed = useAppStore
            .getState()
            .spaces.find((s) => normalizeSpaceSync(s.sync).lastError);
          const detail =
            normalizeSpaceSync(failed?.sync).lastError ||
            "Tap Sync now on the group. If it still fails, re-Join with the host’s current room key.";
          toast.message("Couldn’t sync yet", {
            id: SYNC_FAIL_TOAST_ID,
            description:
              detail.length > 140 ? `${detail.slice(0, 139).trimEnd()}…` : detail,
            duration: 6000,
          });
        } else if (successes > 0) {
          if (shouldShowAutoSyncSuccessToast(anyNotable)) {
            toast.success(
              successes === 1
                ? anyNotable
                  ? "Group updated"
                  : "Group up to date"
                : anyNotable
                  ? "Groups updated"
                  : "Groups up to date",
              {
                id: SYNC_SUCCESS_TOAST_ID,
                description:
                  (anyNotable && lastChanges
                    ? formatSyncChangeDescription(lastChanges)
                    : null) ??
                  (successes === 1
                    ? "Shared meetings are up to date."
                    : `${successes} groups refreshed.`),
                duration: anyNotable ? 4200 : 2800,
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
