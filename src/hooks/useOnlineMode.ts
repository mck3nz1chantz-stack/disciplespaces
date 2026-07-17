import { useCallback, useEffect, useState } from "react";
import {
  isOnlineModeEnabled,
  readOnlineMode,
  writeOnlineMode,
  type OnlineMode,
} from "../lib/onlineMode";
import { getSpaceRelayBaseUrl, isSpaceRelayConfigured } from "../lib/sync/config";

/**
 * Soft network check. navigator.onLine is unreliable on iOS — also probe
 * the relay (or same-origin favicon) so we don't falsely block Sync.
 */
async function probeReachability(): Promise<boolean> {
  try {
    if (isSpaceRelayConfigured()) {
      const base = getSpaceRelayBaseUrl();
      const res = await fetch(`${base}/health`, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
      });
      if (res.ok) return true;
    }
  } catch {
    // fall through
  }
  try {
    const res = await fetch(`${window.location.origin}/favicon.svg`, {
      method: "GET",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }
}

/** Browser network + user Online/Offline preference. */
export function useOnlineMode() {
  const [mode, setMode] = useState<OnlineMode>(() => readOnlineMode());
  const [networkOnline, setNetworkOnline] = useState(
    () => (typeof navigator !== "undefined" ? navigator.onLine : true),
  );

  useEffect(() => {
    const onMode = (e: Event) => {
      const detail = (e as CustomEvent<{ mode: OnlineMode }>).detail;
      if (detail?.mode === "online" || detail?.mode === "offline") {
        setMode(detail.mode);
      } else {
        setMode(readOnlineMode());
      }
    };
    const on = () => {
      setNetworkOnline(true);
      void probeReachability().then((ok) => setNetworkOnline(ok));
    };
    const off = () => {
      // Don't immediately trust "offline" — probe first (Safari false positives)
      void probeReachability().then((ok) => setNetworkOnline(ok));
    };
    window.addEventListener("ds-online-mode", onMode);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    // Correct initial state after mount
    void probeReachability().then((ok) => setNetworkOnline(ok));

    return () => {
      window.removeEventListener("ds-online-mode", onMode);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const setOnlineMode = useCallback((next: OnlineMode) => {
    writeOnlineMode(next);
    setMode(next);
  }, []);

  const toggleOnlineMode = useCallback(() => {
    const next: OnlineMode = mode === "online" ? "offline" : "online";
    writeOnlineMode(next);
    setMode(next);
    return next;
  }, [mode]);

  /**
   * App prefers Online mode — actual Sync still tries the network even if
   * navigator.onLine is wrong. Prefer this over gating on networkOnline alone.
   */
  const canSync = mode === "online" && isOnlineModeEnabled();

  return {
    mode,
    networkOnline,
    preferOnline: mode === "online",
    canSync,
    setOnlineMode,
    toggleOnlineMode,
    refreshNetworkStatus: () =>
      probeReachability().then((ok) => {
        setNetworkOnline(ok);
        return ok;
      }),
  };
}
