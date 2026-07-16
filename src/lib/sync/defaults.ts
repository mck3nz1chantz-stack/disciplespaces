import type { SpaceDeviceRole, SpaceSyncState } from "../../types";

/** Default for every Space until the user opts into Connect. */
export function defaultSpaceSync(
  role: SpaceDeviceRole = "host",
): SpaceSyncState {
  return { mode: "local-only", deviceRole: role };
}

export function normalizeSpaceSync(
  sync: SpaceSyncState | undefined | null,
): SpaceSyncState {
  if (!sync || typeof sync !== "object") return defaultSpaceSync();
  // Missing role → host so pre-role installs keep Connect
  const deviceRole: SpaceDeviceRole =
    sync.deviceRole === "guest" ? "guest" : "host";
  if (sync.mode === "connected") {
    return {
      mode: "connected",
      roomId: sync.roomId,
      shortCode: sync.shortCode,
      lastSyncedAt: sync.lastSyncedAt,
      remoteRev: sync.remoteRev,
      paused: sync.paused === true,
      lastError: sync.lastError,
      deviceRole,
    };
  }
  return {
    mode: "local-only",
    lastSyncedAt: sync.lastSyncedAt,
    lastError: sync.lastError,
    deviceRole,
  };
}

/** Only the host (creator on this phone) may open a new room. Guests Sync only. */
export function canConnectSpaceToRelay(
  sync: SpaceSyncState | undefined | null,
): boolean {
  return normalizeSpaceSync(sync).deviceRole !== "guest";
}

export function isSpaceGuest(
  sync: SpaceSyncState | undefined | null,
): boolean {
  return normalizeSpaceSync(sync).deviceRole === "guest";
}
