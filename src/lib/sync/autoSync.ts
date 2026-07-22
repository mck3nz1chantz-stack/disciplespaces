/**
 * Debounced auto pull+push for connected Spaces after shared writes.
 * Never touches private notes. No-ops when relay off, Offline mode, or paused.
 */

import { isOnlineModeEnabled } from "../onlineMode";
import { isSpaceRelayConfigured } from "./config";
import { normalizeSpaceSync } from "./defaults";

const DEBOUNCE_MS = 1_800;
const timers = new Map<string, number>();
const inFlight = new Set<string>();

type SyncRunner = (spaceId: string) => Promise<unknown>;
let runner: SyncRunner | null = null;

/** Wire once from the app store (avoids circular imports at module load). */
export function registerConnectedSpaceSyncRunner(fn: SyncRunner): void {
  runner = fn;
}

/**
 * Schedule a soft sync for a connected Space after a shared mutation.
 * Safe to call often — debounced per spaceId.
 */
export function scheduleConnectedSpaceSync(spaceId: string): void {
  if (!spaceId || !isSpaceRelayConfigured()) return;
  if (typeof window === "undefined") return;
  if (!isOnlineModeEnabled()) return;

  const existing = timers.get(spaceId);
  if (existing != null) window.clearTimeout(existing);

  const handle = window.setTimeout(() => {
    timers.delete(spaceId);
    void runSync(spaceId);
  }, DEBOUNCE_MS);
  timers.set(spaceId, handle);
}

/** Flush a pending sync sooner (e.g. leaving a group screen). */
export function flushConnectedSpaceSync(spaceId: string): void {
  if (!spaceId) return;
  const existing = timers.get(spaceId);
  if (existing != null) {
    window.clearTimeout(existing);
    timers.delete(spaceId);
  }
  void runSync(spaceId);
}

async function runSync(spaceId: string): Promise<void> {
  if (!runner || inFlight.has(spaceId)) return;
  if (!isOnlineModeEnabled() || !isSpaceRelayConfigured()) return;

  // Lazy import to read live store state without cycles at load time
  const { useAppStore } = await import("../../stores/useAppStore");
  const space = useAppStore.getState().spaces.find((s) => s.id === spaceId);
  const sync = normalizeSpaceSync(space?.sync);
  if (sync.mode !== "connected" || !sync.roomId || sync.paused) return;

  inFlight.add(spaceId);
  try {
    await runner(spaceId);
    window.dispatchEvent(new Event("ds-spaces-synced"));
  } catch {
    // lastError is stored on the Space by syncSpaceNow — UI surfaces it
  } finally {
    inFlight.delete(spaceId);
  }
}
