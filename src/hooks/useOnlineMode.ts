import { useCallback, useEffect, useState } from "react";
import {
  isOnlineModeEnabled,
  readOnlineMode,
  writeOnlineMode,
  type OnlineMode,
} from "../lib/onlineMode";

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
    const on = () => setNetworkOnline(true);
    const off = () => setNetworkOnline(false);
    window.addEventListener("ds-online-mode", onMode);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
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

  /** Can attempt network sync right now. */
  const canSync =
    mode === "online" && networkOnline && isOnlineModeEnabled();

  return {
    mode,
    networkOnline,
    preferOnline: mode === "online",
    canSync,
    setOnlineMode,
    toggleOnlineMode,
  };
}
