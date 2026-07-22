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

/** Server rejected push because another device advanced the room rev. */
export class SpaceRelayConflictError extends Error {
  rev: number;
  snapshot?: SharedSpaceSnapshot;

  constructor(rev: number, snapshot?: SharedSpaceSnapshot) {
    super(
      "Someone else updated this group while you were syncing. Pulling the latest and trying again.",
    );
    this.name = "SpaceRelayConflictError";
    this.rev = rev;
    this.snapshot = snapshot;
  }
}

/** Alphanumeric-only short code (matches Worker lookup). */
export function normalizeShortCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export interface CreateRoomResult {
  roomId: string;
  shortCode: string;
  rev: number;
  joinUrl?: string;
  /** True when server reused the existing room for this spaceId (no fork). */
  reused?: boolean;
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

  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      // Explicit CORS for cross-origin Workers relay
      mode: "cors",
      credentials: "omit",
    });
  } catch {
    // Network/DNS/blocked — does NOT delete any local Space data
    throw new Error(
      "Couldn’t reach the shared room right now (network). Your group is still saved on this phone — nothing was deleted. Stay Online, try Sync again, or save a group file from Settings. If it keeps failing, re-Join with the host’s current room key.",
    );
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) {
      // Never surface bare short codes as "fault codes" — wrap clearly
      const err = data.error.trim();
      if (/^[A-Z0-9]{4}[-–—\s]?[A-Z0-9]{2,4}$/i.test(err)) {
        return `Could not complete sync. If you see a room key like ${err.toUpperCase()}, that is an invite code — not an error. Ask the host to Sync, then try Sync now again.`;
      }
      return err;
    }
  } catch {
    // ignore
  }
  if (res.status === 404) {
    return "Couldn’t join that room. Use the host’s short room key (like ABCD-EF) from their group card — not Group Key (DS-GRP-…) unless they registered one, and not Account Key. Host: Online → open the group → share the room key, then you Join again.";
  }
  if (res.status === 409) {
    return "Group changed on another device. Sync again to merge the latest shared meetings.";
  }
  if (res.status === 400) {
    return "Sync request was rejected. Try Sync again, or ask the host to open the room and share a fresh key.";
  }
  if (res.status >= 500) {
    return `Group connection is having trouble (${res.status}). Your data is still on this phone — try again in a moment.`;
  }
  return `Group connection failed (${res.status}). Your data is still on this phone — try Sync again.`;
}

/**
 * Host: open or create room for this Space (opt-in Connect).
 * Default reuses the server’s room for this spaceId so friends aren’t orphaned.
 * Pass forceNew only after an explicit “new room / new join code” confirmation.
 */
export async function createRoom(input: {
  snapshot: SharedSpaceSnapshot;
  displayName?: string;
  forceNew?: boolean;
}): Promise<CreateRoomResult> {
  assertNoPrivateNotes(input.snapshot);
  const res = await relayFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({
      snapshot: input.snapshot,
      displayName: input.displayName,
      deviceId: getDeviceId(),
      forceNew: input.forceNew === true,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CreateRoomResult>;
}

export interface PreviewRoomResult {
  roomId: string;
  rev: number;
  spaceId: string;
  name: string;
  members: Array<{ id: string; name: string }>;
  /** Shared meetings already in the room (host must Sync for history). */
  sessionCount?: number;
  prayerCount?: number;
}

/**
 * Peek at group name + people without joining.
 * Used so guests can pick “I’m already on the list” vs a new name.
 */
export async function previewRoom(input: {
  shortCode?: string;
  groupKeyHash?: string;
}): Promise<PreviewRoomResult> {
  const code = input.shortCode ? normalizeShortCode(input.shortCode) : "";
  const gkh = (input.groupKeyHash || "").trim().toLowerCase();
  if (code.length < 4 && gkh.length < 32) {
    throw new Error("Enter the full room key from your host (like ABCD-EF).");
  }
  const res = await relayFetch("/rooms/preview", {
    method: "POST",
    body: JSON.stringify({
      shortCode: code || undefined,
      groupKeyHash: gkh || undefined,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<PreviewRoomResult>;
}

/** Host: register Group Key hash → room so guests can re-link with DS-GRP-… */
export async function bindGroupKeyHash(input: {
  roomId: string;
  groupKeyHash: string;
}): Promise<void> {
  const hash = input.groupKeyHash.trim().toLowerCase();
  if (hash.length < 32 || !input.roomId) return;
  try {
    const res = await relayFetch(
      `/rooms/${encodeURIComponent(input.roomId)}/bind-group-key`,
      {
        method: "POST",
        body: JSON.stringify({
          groupKeyHash: hash,
          deviceId: getDeviceId(),
        }),
      },
    );
    if (!res.ok) {
      // Non-fatal for older relays
      return;
    }
  } catch {
    // ignore
  }
}

/** Register spaceId → roomId (backfill after successful sync/join). */
export async function registerSpaceRoom(input: {
  spaceId: string;
  roomId: string;
}): Promise<void> {
  try {
    const res = await relayFetch("/rooms/register-space", {
      method: "POST",
      body: JSON.stringify({
        spaceId: input.spaceId,
        roomId: input.roomId,
        deviceId: getDeviceId(),
      }),
    });
    if (!res.ok) {
      // Non-fatal — anti-fork is best-effort for legacy rooms
      return;
    }
  } catch {
    // ignore
  }
}

/**
 * Guest: join with short room key (ABCD-EF) and/or Group Key hash (trusted re-link).
 * Prefer shortCode for invites; groupKeyHash when host shared DS-GRP-… instead.
 */
export async function joinRoom(input: {
  shortCode?: string;
  /** SHA-256 hex of normalized Group Key (server never sees raw secret). */
  groupKeyHash?: string;
  displayName: string;
}): Promise<JoinRoomResult> {
  const code = input.shortCode ? normalizeShortCode(input.shortCode) : "";
  const gkh = (input.groupKeyHash || "").trim().toLowerCase();
  if (code.length < 4 && gkh.length < 32) {
    throw new Error(
      "Enter the host’s room key (like ABCD-EF). That is not the same as a Group Key (DS-GRP-…) or Account Key.",
    );
  }
  const res = await relayFetch("/rooms/join", {
    method: "POST",
    body: JSON.stringify({
      shortCode: code || undefined,
      groupKeyHash: gkh || undefined,
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

/**
 * Push shared snapshot.
 * Default mergeShared=true so host/guest never wipe each other's members or sessions.
 */
export async function pushRoom(input: {
  roomId: string;
  snapshot: SharedSpaceSnapshot;
  baseRev?: number;
  /** When true (default), union members/sessions by id on the relay. */
  mergeShared?: boolean;
}): Promise<{ rev: number }> {
  assertNoPrivateNotes(input.snapshot);
  const mergeShared = input.mergeShared !== false;
  const res = await relayFetch(`/rooms/${encodeURIComponent(input.roomId)}`, {
    method: "POST",
    body: JSON.stringify({
      snapshot: input.snapshot,
      baseRev: input.baseRev,
      deviceId: getDeviceId(),
      mergeShared,
    }),
  });
  if (res.status === 409) {
    let rev = input.baseRev ?? 0;
    let snapshot: SharedSpaceSnapshot | undefined;
    try {
      const data = (await res.json()) as {
        rev?: number;
        snapshot?: SharedSpaceSnapshot;
        error?: string;
      };
      if (typeof data.rev === "number") rev = data.rev;
      if (data.snapshot) snapshot = data.snapshot;
    } catch {
      // ignore parse errors
    }
    throw new SpaceRelayConflictError(rev, snapshot);
  }
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

/**
 * After Group Key rotation completes: issue a new short join code.
 * Old code bindings stop resolving once rebound.
 */
export async function rotateJoinCode(input: {
  roomId: string;
  groupKeyHash?: string;
}): Promise<{ shortCode: string; rev: number }> {
  const res = await relayFetch(
    `/rooms/${encodeURIComponent(input.roomId)}/rotate-code`,
    {
      method: "POST",
      body: JSON.stringify({
        deviceId: getDeviceId(),
        groupKeyHash: input.groupKeyHash,
      }),
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ shortCode: string; rev: number }>;
}
