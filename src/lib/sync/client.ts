/**
 * HTTP client for the light Space room relay.
 * No-ops with clear errors when VITE_SPACE_RELAY_URL is unset.
 */

import { getDeviceId, getDeviceSecret } from "./deviceIdentity";
import { getSpaceRelayBaseUrl, isSpaceRelayConfigured } from "./config";
import {
  assertNoPrivateNotes,
  type SharedSpaceSnapshot,
} from "./sharedSnapshot";

export class SpaceRelayNotConfiguredError extends Error {
  constructor() {
    super(
      "Space cloud join is not enabled on this build yet. Use file backup or offline invite for now.",
    );
    this.name = "SpaceRelayNotConfiguredError";
  }
}

export interface CreateRoomResult {
  roomId: string;
  shortCode: string;
  rev: number;
  joinUrl?: string;
}

export interface JoinRoomResult {
  roomId: string;
  shortCode: string;
  rev: number;
  snapshot: SharedSpaceSnapshot;
  hostDeviceId: string;
}

export interface PullResult {
  rev: number;
  snapshot: SharedSpaceSnapshot;
}

async function relayFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!isSpaceRelayConfigured()) {
    throw new SpaceRelayNotConfiguredError();
  }
  const base = getSpaceRelayBaseUrl();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Device-Id", getDeviceId());
  headers.set("Authorization", `Bearer ${getDeviceSecret()}`);

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });
  return res;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // ignore
  }
  return `Relay error (${res.status})`;
}

/** Host: create a room from shared snapshot (opt-in Connect). */
export async function createRoom(input: {
  snapshot: SharedSpaceSnapshot;
  displayName?: string;
}): Promise<CreateRoomResult> {
  assertNoPrivateNotes(input.snapshot);
  const res = await relayFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({
      snapshot: input.snapshot,
      displayName: input.displayName,
      deviceId: getDeviceId(),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CreateRoomResult>;
}

/** Guest: join with short code + name → receive shared snapshot. */
export async function joinRoom(input: {
  shortCode: string;
  displayName: string;
}): Promise<JoinRoomResult> {
  const res = await relayFetch("/rooms/join", {
    method: "POST",
    body: JSON.stringify({
      shortCode: input.shortCode.trim().toUpperCase(),
      displayName: input.displayName.trim(),
      deviceId: getDeviceId(),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as JoinRoomResult;
  assertNoPrivateNotes(data.snapshot);
  return data;
}

/** Pull latest shared snapshot when rev is newer. */
export async function pullRoom(input: {
  roomId: string;
  sinceRev?: number;
}): Promise<PullResult | { unchanged: true; rev: number }> {
  const q =
    input.sinceRev != null ? `?since=${encodeURIComponent(input.sinceRev)}` : "";
  const res = await relayFetch(`/rooms/${encodeURIComponent(input.roomId)}${q}`, {
    method: "GET",
  });
  if (res.status === 304) {
    return { unchanged: true, rev: input.sinceRev ?? 0 };
  }
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as PullResult & { unchanged?: boolean };
  if (data.unchanged) {
    return { unchanged: true, rev: data.rev };
  }
  assertNoPrivateNotes(data.snapshot);
  return { rev: data.rev, snapshot: data.snapshot };
}

/** Push full shared snapshot (MVP last-write / full replace). */
export async function pushRoom(input: {
  roomId: string;
  snapshot: SharedSpaceSnapshot;
  baseRev?: number;
}): Promise<{ rev: number }> {
  assertNoPrivateNotes(input.snapshot);
  const res = await relayFetch(`/rooms/${encodeURIComponent(input.roomId)}`, {
    method: "POST",
    body: JSON.stringify({
      snapshot: input.snapshot,
      baseRev: input.baseRev,
      deviceId: getDeviceId(),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ rev: number }>;
}

/** Host: unlink / dissolve remote room (local data kept by client). */
export async function deleteRoom(roomId: string): Promise<void> {
  const res = await relayFetch(`/rooms/${encodeURIComponent(roomId)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(await readError(res));
  }
}
