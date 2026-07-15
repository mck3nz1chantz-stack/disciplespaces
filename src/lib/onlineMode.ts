/**
 * User preference: work online (allow sync) vs stay offline (local only).
 * Independent of browser network — toggling Offline pauses relay traffic.
 */

export const ONLINE_MODE_KEY = "ds-online-mode-v1";

export type OnlineMode = "online" | "offline";

export function readOnlineMode(): OnlineMode {
  try {
    const v = localStorage.getItem(ONLINE_MODE_KEY);
    if (v === "offline") return "offline";
    return "online";
  } catch {
    return "online";
  }
}

export function writeOnlineMode(mode: OnlineMode): void {
  try {
    localStorage.setItem(ONLINE_MODE_KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent("ds-online-mode", { detail: { mode } }),
  );
}

export function isOnlineModeEnabled(): boolean {
  return readOnlineMode() === "online";
}
