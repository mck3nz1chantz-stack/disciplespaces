import type { SpaceSyncState } from "../../types";

/** Default for every Space until the user opts into Connect. */
export function defaultSpaceSync(): SpaceSyncState {
  return { mode: "local-only" };
}

export function normalizeSpaceSync(
  sync: SpaceSyncState | undefined | null,
): SpaceSyncState {
  if (!sync || typeof sync !== "object") return defaultSpaceSync();
  if (sync.mode === "connected") {
    return {
      mode: "connected",
      roomId: sync.roomId,
      shortCode: sync.shortCode,
      lastSyncedAt: sync.lastSyncedAt,
      remoteRev: sync.remoteRev,
      paused: sync.paused === true,
      lastError: sync.lastError,
    };
  }
  return {
    mode: "local-only",
    lastSyncedAt: sync.lastSyncedAt,
    lastError: sync.lastError,
  };
}
