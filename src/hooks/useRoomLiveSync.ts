/**
 * Phase 6 light realtime: while viewing a connected Space, subscribe to
 * room rev updates (WebSocket + poll) and pull+push when remote advances.
 */

import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/useAppStore";
import { isOnlineModeEnabled } from "../lib/onlineMode";
import {
  isSpaceRelayConfigured,
  normalizeSpaceSync,
  subscribeRoomLive,
} from "../lib/sync";

/** Min gap between live-triggered full syncs for one space. */
const LIVE_SYNC_MIN_MS = 2_500;

export function useRoomLiveSync(spaceId: string | undefined): void {
  const lastSync = useRef(0);
  const syncing = useRef(false);
  const roomId = useAppStore((s) => {
    if (!spaceId) return undefined;
    const space = s.spaces.find((x) => x.id === spaceId);
    const sync = normalizeSpaceSync(space?.sync);
    return sync.mode === "connected" && !sync.paused ? sync.roomId : undefined;
  });
  const remoteRev = useAppStore((s) => {
    if (!spaceId) return 0;
    const space = s.spaces.find((x) => x.id === spaceId);
    return normalizeSpaceSync(space?.sync).remoteRev ?? 0;
  });

  useEffect(() => {
    if (!spaceId || !roomId || !isSpaceRelayConfigured()) return;
    if (!isOnlineModeEnabled()) return;

    const knownRev = remoteRev;

    const run = async (remoteRev: number) => {
      if (syncing.current) return;
      if (!isOnlineModeEnabled()) return;
      const now = Date.now();
      if (now - lastSync.current < LIVE_SYNC_MIN_MS) return;

      const current = useAppStore
        .getState()
        .spaces.find((s) => s.id === spaceId);
      const cur = normalizeSpaceSync(current?.sync);
      if (cur.mode !== "connected" || cur.paused) return;
      // Already at or past this rev
      if ((cur.remoteRev ?? 0) >= remoteRev) return;

      syncing.current = true;
      lastSync.current = now;
      try {
        await useAppStore.getState().syncSpaceNow(spaceId);
        window.dispatchEvent(new Event("ds-spaces-synced"));
      } catch {
        // lastError on Space
      } finally {
        syncing.current = false;
      }
    };

    const unsub = subscribeRoomLive(
      roomId,
      ({ rev }) => {
        void run(rev);
      },
      { knownRev, pollMs: 12_000 },
    );

    return () => {
      unsub();
    };
    // Re-subscribe when room link or Online-related room id changes
  }, [spaceId, roomId]);
}
