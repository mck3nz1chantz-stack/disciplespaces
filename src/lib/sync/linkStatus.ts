/**
 * Truthful group-link status for badges (dashboard, hero, pulse).
 * Never show "Live" when Offline mode, paused, error, or not connected.
 */

import type { SpaceSyncState } from "../../types";
import { isSpaceGuest, normalizeSpaceSync } from "./defaults";
import type { OnlineMode } from "../onlineMode";

export type GroupLinkKind =
  | "live"
  | "offline"
  | "paused"
  | "error"
  | "guest"
  | "local"
  | "linked-idle";

export interface GroupLinkStatus {
  kind: GroupLinkKind;
  /** Short chip label */
  label: string;
  /** Longer title / tooltip */
  title: string;
  /** True only when Online + connected + not paused + no lastError */
  isLive: boolean;
}

/**
 * @param onlineMode App Online/Offline preference (header).
 * Missing → treat as online for callers that only care about room metadata.
 */
export function getGroupLinkStatus(
  sync: SpaceSyncState | undefined | null,
  onlineMode: OnlineMode | "online" | "offline" = "online",
): GroupLinkStatus {
  const s = normalizeSpaceSync(sync);
  const connected = s.mode === "connected" && Boolean(s.roomId);
  const guest = isSpaceGuest(s);
  const offlineApp = onlineMode === "offline";

  if (s.lastError && connected) {
    return {
      kind: "error",
      label: "Fix link",
      title: s.lastError,
      isLive: false,
    };
  }

  if (!connected) {
    if (guest) {
      return {
        kind: "guest",
        label: "Guest",
        title: "Not linked to a room on this phone — Join with the host’s key",
        isLive: false,
      };
    }
    return {
      kind: "local",
      label: "Local",
      title: "This group is only on this phone until you open a room",
      isLive: false,
    };
  }

  if (s.paused === true) {
    return {
      kind: "paused",
      label: "Paused",
      title: "Sync paused for this group — tap Sync to resume",
      isLive: false,
    };
  }

  if (offlineApp) {
    return {
      kind: "offline",
      label: "Offline",
      title: "App is Offline — turn Online in the header to sync",
      isLive: false,
    };
  }

  // Connected, Online, no error — healthy link
  return {
    kind: "live",
    label: "Live",
    title: s.lastSyncedAt
      ? "Linked to the shared room — may sync when Online"
      : "Linked to the shared room",
    isLive: true,
  };
}
