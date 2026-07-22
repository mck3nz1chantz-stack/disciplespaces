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
  const groupFields = {
    groupKeyFingerprint: sync.groupKeyFingerprint,
    groupKeyId: sync.groupKeyId,
    groupKeyRotatedAt: sync.groupKeyRotatedAt,
    groupKeyRotation: sync.groupKeyRotation,
  };

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
      ...groupFields,
    };
  }
  return {
    mode: "local-only",
    lastSyncedAt: sync.lastSyncedAt,
    lastError: sync.lastError,
    deviceRole,
    ...groupFields,
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

/** Host on this device — may edit title, roster, open room. Guests Sync only. */
export function isSpaceHost(
  sync: SpaceSyncState | undefined | null,
): boolean {
  return !isSpaceGuest(sync);
}

export const HOST_ONLY_ROSTER_MESSAGE =
  "Only the host can add or remove people on the list. Ask them to update who’s here, then tap Sync.";

export const HOST_ONLY_TITLE_MESSAGE =
  "Only the host can rename this group. Tap Sync to pull the latest name and meetings.";
