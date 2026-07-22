/**
 * Light realtime for a connected Space room:
 * - WebSocket to the Durable Object (rev notifications)
 * - HTTP poll fallback when WS unavailable
 * Never carries private notes — only rev / optional full snapshot hint.
 */

import { getSpaceRelayBaseUrl, isSpaceRelayConfigured } from "./config";
import { getDeviceId, getDeviceSecret } from "./deviceIdentity";

export type RoomLiveHandler = (info: {
  rev: number;
  reason: "ws" | "poll";
}) => void;

/**
 * Subscribe to room updates. Returns unsubscribe.
 * Safe to call when relay is off (no-op).
 */
export function subscribeRoomLive(
  roomId: string,
  onUpdate: RoomLiveHandler,
  opts?: { pollMs?: number; knownRev?: number },
): () => void {
  if (!isSpaceRelayConfigured() || !roomId) {
    return () => undefined;
  }

  const base = getSpaceRelayBaseUrl();
  const pollMs = opts?.pollMs ?? 12_000;
  let knownRev = opts?.knownRev ?? 0;
  let closed = false;
  let ws: WebSocket | null = null;
  let pollTimer: number | null = null;
  let reconnectTimer: number | null = null;

  const wsUrl = () => {
    const u = new URL(`${base}/rooms/${encodeURIComponent(roomId)}/live`);
    // Browser WS: convert https → wss
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return u.toString();
  };

  const notify = (rev: number, reason: "ws" | "poll") => {
    if (closed) return;
    if (rev <= knownRev) return;
    knownRev = rev;
    onUpdate({ rev, reason });
  };

  const pollOnce = async () => {
    if (closed || !isSpaceRelayConfigured()) return;
    try {
      const res = await fetch(
        `${base}/rooms/${encodeURIComponent(roomId)}?since=${knownRev}`,
        {
          method: "GET",
          headers: {
            "X-Device-Id": getDeviceId(),
            Authorization: `Bearer ${getDeviceSecret()}`,
          },
          cache: "no-store",
          mode: "cors",
          credentials: "omit",
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        unchanged?: boolean;
        rev?: number;
      };
      if (data.unchanged) return;
      if (typeof data.rev === "number") notify(data.rev, "poll");
    } catch {
      // network — try again next interval
    }
  };

  const schedulePoll = () => {
    if (pollTimer != null) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => {
      void pollOnce();
    }, pollMs);
  };

  const connectWs = () => {
    if (closed) return;
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      schedulePoll();
      return;
    }

    ws.onopen = () => {
      // Prefer WS; keep a slow poll as safety net
      schedulePoll();
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as {
          type?: string;
          rev?: number;
        };
        if (data.type === "room-updated" && typeof data.rev === "number") {
          notify(data.rev, "ws");
        } else if (data.type === "hello" && typeof data.rev === "number") {
          if (data.rev > knownRev) notify(data.rev, "ws");
          else knownRev = Math.max(knownRev, data.rev);
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onerror = () => {
      // onclose will reconnect
    };

    ws.onclose = () => {
      ws = null;
      if (closed) return;
      schedulePoll();
      reconnectTimer = window.setTimeout(() => {
        connectWs();
      }, 4_000);
    };
  };

  connectWs();
  // Immediate poll so we don't wait for WS handshake
  void pollOnce();
  schedulePoll();

  return () => {
    closed = true;
    if (pollTimer != null) window.clearInterval(pollTimer);
    if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
    try {
      ws?.close();
    } catch {
      // ignore
    }
    ws = null;
  };
}
