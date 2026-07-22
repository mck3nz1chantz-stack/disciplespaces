/**
 * DiscipleSpaces Space room relay — shared-layer only.
 * Never accepts private notes. Join via short code.
 * Also hosts pilot feedback inbox (POST /feedback, GET with admin secret).
 */

export interface Env {
  SPACE_ROOM: DurableObjectNamespace;
  FEEDBACK_INBOX: DurableObjectNamespace;
  /** Optional secret for GET /feedback (list reports). Set via wrangler secret. */
  FEEDBACK_ADMIN_SECRET?: string;
}

interface FeedbackRecord {
  id: string;
  receivedAt: string;
  kind: string;
  message: string;
  contact?: string;
  diagnostics?: Record<string, unknown>;
  clientId?: string;
  deviceId?: string;
}

interface SnapshotTombstone {
  id: string;
  deletedAt: string;
}

interface SharedSnapshot {
  v: 1;
  kind: "ds-shared-snapshot";
  spaceId: string;
  name: string;
  members?: unknown;
  sessions?: unknown;
  prayerBoard?: unknown;
  tombstones?: {
    sessions?: SnapshotTombstone[];
    prayerBoard?: SnapshotTombstone[];
  };
  exportedAt?: string;
  [key: string]: unknown;
}

interface RoomMember {
  deviceId: string;
  displayName: string;
  joinedAt: string;
}

interface RoomState {
  roomId: string;
  shortCode: string;
  hostDeviceId: string;
  rev: number;
  snapshot: SharedSnapshot;
  members: RoomMember[];
  createdAt: string;
  updatedAt: string;
  /** Optional Group Key hash (server never stores raw Group Key). */
  groupKeyHash?: string;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Canonical short-code key for Durable Object idFromName.
 * Strips hyphens/spaces so "ABCD-EF", "ABCDEF", and "ABCD EF" all resolve.
 */
function normalizeShortCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Device-Id",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(req ? corsHeaders(req) : {}),
    },
  });
}

function error(message: string, status: number, req: Request): Response {
  return json({ error: message }, status, req);
}

function deviceIdFrom(req: Request): string {
  return (
    req.headers.get("X-Device-Id") ||
    crypto.randomUUID()
  );
}

function assertNoPrivateNotes(payload: unknown): void {
  const s = JSON.stringify(payload);
  if (/"privateNotes?"\s*:/i.test(s)) {
    throw new Error("Private notes are not allowed on the Space room");
  }
}

function makeShortCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (let i = 0; i < 6; i++) {
    raw += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Resolve short code → roomId.
 * Tries canonical key plus legacy hyphenated keys so pilot rooms keep working.
 */
async function resolveRoomIdFromShortCode(
  env: Env,
  shortCode: string,
): Promise<string | null> {
  const norm = normalizeShortCode(shortCode);
  if (!norm) return null;

  const candidates = new Set<string>([norm]);
  // Legacy bind used uppercase with hyphens left in (e.g. ABCD-EF)
  if (norm.length === 6) {
    candidates.add(`${norm.slice(0, 4)}-${norm.slice(4)}`);
  }
  if (norm.length === 8) {
    candidates.add(`${norm.slice(0, 4)}-${norm.slice(4)}`);
  }
  // User typed spaces only (already stripped into norm); also try raw upper
  const spaced = shortCode.trim().toUpperCase().replace(/\s+/g, "");
  if (spaced) candidates.add(spaced);

  for (const key of candidates) {
    const stub = env.SPACE_ROOM.get(
      env.SPACE_ROOM.idFromName(`code:${key}`),
    );
    const bindRes = await stub.fetch(
      new Request("https://room/resolve-code", { method: "GET" }),
    );
    if (!bindRes.ok) continue;
    const data = (await bindRes.json()) as { roomId?: string };
    if (data.roomId) return data.roomId;
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/health" && req.method === "GET") {
        return json(
          {
            ok: true,
            service: "disciple-spaces-relay",
            features: ["rooms", "feedback", "account-vault"],
          },
          200,
          req,
        );
      }

      // Pilot feedback (POST submit / GET list with secret)
      if (path === "/feedback" || path.endsWith("/feedback")) {
        if (req.method === "POST") return acceptFeedback(req, env);
        if (req.method === "GET") return listFeedback(req, env);
        return error("Method not allowed", 405, req);
      }

      /**
       * Account Key vault — encrypted personal backup only.
       * Path vault id is a client-side hash of the Account Key; server never sees the raw key.
       */
      const vaultMatch = path.match(/^\/vault\/([a-f0-9]{32,128})$/i);
      if (vaultMatch) {
        const vaultId = vaultMatch[1]!.toLowerCase();
        if (req.method === "GET") {
          return getAccountVault(req, env, vaultId, url.searchParams.has("meta"));
        }
        if (req.method === "PUT") {
          return putAccountVault(req, env, vaultId);
        }
        if (req.method === "DELETE") {
          return deleteAccountVault(req, env, vaultId);
        }
        return error("Method not allowed", 405, req);
      }

      if (path === "/rooms" && req.method === "POST") {
        return createRoom(req, env);
      }

      /** Register spaceId → roomId for rooms created before the anti-fork index. */
      if (path === "/rooms/register-space" && req.method === "POST") {
        return registerSpaceRoom(req, env);
      }

      if (path === "/rooms/join" && req.method === "POST") {
        return joinRoom(req, env);
      }

      /** Peek at group name + members without joining (for “Who are you?”). */
      if (path === "/rooms/preview" && req.method === "POST") {
        return previewRoom(req, env);
      }

      // POST /rooms/:roomId/rotate-code — new short join code after Group Key rotate
      const rotateMatch = path.match(/^\/rooms\/([^/]+)\/rotate-code$/);
      if (rotateMatch && req.method === "POST") {
        const roomKey = decodeURIComponent(rotateMatch[1]!);
        return rotateRoomJoinCode(req, env, roomKey);
      }

      // POST /rooms/:roomId/bind-group-key — register hash for trusted re-link
      const bindGkhMatch = path.match(/^\/rooms\/([^/]+)\/bind-group-key$/);
      if (bindGkhMatch && req.method === "POST") {
        const roomKey = decodeURIComponent(bindGkhMatch[1]!);
        return bindGroupKeyOnRoom(req, env, roomKey);
      }

      // WebSocket live channel: /rooms/:roomId/live
      const liveMatch = path.match(/^\/rooms\/([^/]+)\/live$/);
      if (liveMatch) {
        const roomKey = decodeURIComponent(liveMatch[1]!);
        const id = env.SPACE_ROOM.idFromName(`room:${roomKey}`);
        const stub = env.SPACE_ROOM.get(id);
        // Preserve Upgrade headers for WebSocketPair on the DO
        return stub.fetch(
          new Request("https://room/live", req),
        );
      }

      const roomMatch = path.match(/^\/rooms\/([^/]+)$/);
      if (roomMatch) {
        const roomKey = decodeURIComponent(roomMatch[1]!);
        const id = env.SPACE_ROOM.idFromName(`room:${roomKey}`);
        const stub = env.SPACE_ROOM.get(id);
        return stub.fetch(req);
      }

      return error("Not found", 404, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Server error";
      return error(message, 400, req);
    }
  },
};

/**
 * Account vault record — ciphertext only. vaultId is opaque client hash.
 */
interface AccountVaultRecord {
  vaultId: string;
  updatedAt: string;
  spaceCount: number;
  fingerprint?: string;
  /** AES-GCM blob encrypted client-side with Account Key */
  blob: {
    v: 1;
    alg: string;
    iv: string;
    ciphertext: string;
  };
  deviceId?: string;
}

async function getAccountVault(
  req: Request,
  env: Env,
  vaultId: string,
  metaOnly: boolean,
): Promise<Response> {
  const stub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`vault:${vaultId}`),
  );
  const res = await stub.fetch(
    new Request(`https://vault/get?meta=${metaOnly ? "1" : "0"}`, {
      method: "GET",
    }),
  );
  if (res.status === 404) {
    return error("No cloud backup for this Account Key yet", 404, req);
  }
  if (!res.ok) {
    return error("Could not read cloud backup", 500, req);
  }
  const data = await res.json();
  return json(data, 200, req);
}

async function putAccountVault(
  req: Request,
  env: Env,
  vaultId: string,
): Promise<Response> {
  let body: {
    v?: number;
    kind?: string;
    updatedAt?: string;
    spaceCount?: number;
    fingerprint?: string;
    blob?: AccountVaultRecord["blob"];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error("Invalid JSON", 400, req);
  }
  if (!body.blob?.iv || !body.blob?.ciphertext) {
    return error("Encrypted backup blob required", 400, req);
  }
  // Never accept plain private notes keys on vault body
  assertNoPrivateNotes({
    spaceCount: body.spaceCount,
    fingerprint: body.fingerprint,
  });

  const record: AccountVaultRecord = {
    vaultId,
    updatedAt: body.updatedAt || new Date().toISOString(),
    spaceCount: Math.max(0, Number(body.spaceCount) || 0),
    fingerprint: body.fingerprint
      ? String(body.fingerprint).slice(0, 16)
      : undefined,
    blob: {
      v: 1,
      alg: String(body.blob.alg || "AES-GCM"),
      iv: String(body.blob.iv),
      ciphertext: String(body.blob.ciphertext),
    },
    deviceId: deviceIdFrom(req).slice(0, 80),
  };

  const stub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`vault:${vaultId}`),
  );
  const res = await stub.fetch(
    new Request("https://vault/put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    }),
  );
  if (!res.ok) {
    return error("Could not store cloud backup", 500, req);
  }
  return json(
    {
      ok: true,
      updatedAt: record.updatedAt,
      spaceCount: record.spaceCount,
      fingerprint: record.fingerprint,
    },
    200,
    req,
  );
}

async function deleteAccountVault(
  req: Request,
  env: Env,
  vaultId: string,
): Promise<Response> {
  const stub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`vault:${vaultId}`),
  );
  await stub.fetch(new Request("https://vault/delete", { method: "DELETE" }));
  return json({ ok: true }, 200, req);
}

async function acceptFeedback(req: Request, env: Env): Promise<Response> {
  let body: {
    v?: number;
    kind?: string;
    message?: string;
    contact?: string;
    diagnostics?: Record<string, unknown>;
    clientId?: string;
    createdAt?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error("Invalid JSON", 400, req);
  }

  const message = String(body.message || "").trim().slice(0, 4000);
  if (message.length < 5) {
    return error("Message too short", 400, req);
  }
  if (/"privateNotes?"\s*:/i.test(message)) {
    return error("Do not include private notes", 400, req);
  }
  assertNoPrivateNotes(body);

  const kind = ["bug", "confusing", "idea", "other"].includes(
    String(body.kind || ""),
  )
    ? String(body.kind)
    : "other";

  const record: FeedbackRecord = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    kind,
    message,
    contact: body.contact
      ? String(body.contact).trim().slice(0, 120)
      : undefined,
    diagnostics: body.diagnostics && typeof body.diagnostics === "object"
      ? body.diagnostics
      : undefined,
    clientId: body.clientId ? String(body.clientId).slice(0, 80) : undefined,
    deviceId: deviceIdFrom(req).slice(0, 80),
  };

  const stub = env.FEEDBACK_INBOX.get(
    env.FEEDBACK_INBOX.idFromName("pilot-inbox"),
  );
  const res = await stub.fetch(
    new Request("https://feedback/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    }),
  );
  if (!res.ok) {
    return error("Could not store feedback", 500, req);
  }

  // Also log for `wrangler tail` during active testing
  console.log(
    JSON.stringify({
      type: "pilot_feedback",
      id: record.id,
      kind: record.kind,
      message: record.message.slice(0, 200),
      contact: record.contact,
      receivedAt: record.receivedAt,
    }),
  );

  return json({ ok: true, id: record.id }, 201, req);
}

async function listFeedback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const secret =
    url.searchParams.get("secret") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const expected = env.FEEDBACK_ADMIN_SECRET || "";
  if (!expected || secret !== expected) {
    return error("Unauthorized", 401, req);
  }
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") || "40")),
  );

  const stub = env.FEEDBACK_INBOX.get(
    env.FEEDBACK_INBOX.idFromName("pilot-inbox"),
  );
  const res = await stub.fetch(
    new Request(`https://feedback/list?limit=${limit}`, { method: "GET" }),
  );
  if (!res.ok) {
    return error("Could not list feedback", 500, req);
  }
  const data = await res.json();
  return json(data, 200, req);
}

/** Backfill: map spaceId → existing roomId if the room is still alive. */
async function registerSpaceRoom(
  req: Request,
  env: Env,
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    spaceId?: string;
    roomId?: string;
  };
  const spaceId = String(body.spaceId || "").trim();
  const roomId = String(body.roomId || "").trim();
  if (!spaceId || !roomId) {
    return error("spaceId and roomId required", 400, req);
  }
  const roomStub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`room:${roomId}`),
  );
  const full = await roomStub.fetch(
    new Request("https://room/full", { method: "GET" }),
  );
  if (!full.ok) {
    return error("Room not found", 404, req);
  }
  const st = (await full.json()) as RoomState;
  const snapSpace = String(st.snapshot?.spaceId || "");
  if (snapSpace && snapSpace !== spaceId) {
    return error("Room belongs to a different Space", 409, req);
  }
  await bindSpaceIdToRoom(env, spaceId, roomId);
  return json(
    { ok: true, spaceId, roomId, shortCode: st.shortCode },
    200,
    req,
  );
}

/**
 * Resolve app spaceId → roomId (prevents double rooms for one group).
 * Bound when a room is first created; join/open reuses it.
 */
async function resolveRoomIdFromSpaceId(
  env: Env,
  spaceId: string,
): Promise<string | null> {
  const id = String(spaceId || "").trim();
  if (!id) return null;
  const stub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`space:${id}`),
  );
  const res = await stub.fetch(
    new Request("https://room/resolve-space", { method: "GET" }),
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { roomId?: string };
  return data.roomId || null;
}

async function bindSpaceIdToRoom(
  env: Env,
  spaceId: string,
  roomId: string,
): Promise<void> {
  const id = String(spaceId || "").trim();
  if (!id || !roomId) return;
  const stub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`space:${id}`),
  );
  await stub.fetch(
    new Request("https://room/bind-space", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId: id, roomId }),
    }),
  );
}

async function bindShortCodeToRoom(
  env: Env,
  shortCode: string,
  roomId: string,
): Promise<void> {
  const bindPayload = JSON.stringify({ roomId, shortCode });
  const keys = new Set<string>([
    normalizeShortCode(shortCode),
    shortCode.trim().toUpperCase(),
  ]);
  for (const key of keys) {
    if (!key) continue;
    const codeStub = env.SPACE_ROOM.get(
      env.SPACE_ROOM.idFromName(`code:${key}`),
    );
    await codeStub.fetch(
      new Request("https://room/bind-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bindPayload,
      }),
    );
  }
}

function normalizeGroupKeyHash(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9]/g, "");
}

/** Index Group Key hash → roomId for trusted re-link (raw key never stored). */
async function bindGroupKeyHashToRoom(
  env: Env,
  groupKeyHash: string,
  roomId: string,
): Promise<void> {
  const h = normalizeGroupKeyHash(groupKeyHash);
  if (h.length < 32 || !roomId) return;
  const stub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`gkh:${h}`),
  );
  await stub.fetch(
    new Request("https://room/bind-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, shortCode: `gkh:${h.slice(0, 12)}` }),
    }),
  );
}

async function resolveRoomIdFromGroupKeyHash(
  env: Env,
  groupKeyHash: string,
): Promise<string | null> {
  const h = normalizeGroupKeyHash(groupKeyHash);
  if (h.length < 32) return null;
  const stub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`gkh:${h}`),
  );
  const res = await stub.fetch(
    new Request("https://room/resolve-code", { method: "GET" }),
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { roomId?: string };
  return data.roomId || null;
}

const INVALID_JOIN_HELP =
  "Couldn’t join that shared room. Use the host’s short room key (like ABCD-EF) from their group card. Group Key (DS-GRP-…) only works after the host creates one while the room is open. Account Key is for personal backup only — not group join. Host: Online → open group → share the room key.";

/**
 * Open or create a room for a Space.
 * Default: reuse existing room for snapshot.spaceId (no double rooms).
 * forceNew: true only after host explicitly starts a fresh room (orphans old code).
 */
async function createRoom(req: Request, env: Env): Promise<Response> {
  const body = (await req.json()) as {
    snapshot?: SharedSnapshot;
    displayName?: string;
    deviceId?: string;
    /** Explicit new room — only when host confirms they want a new join code. */
    forceNew?: boolean;
  };
  if (!body.snapshot?.spaceId || !body.snapshot?.name) {
    return error("snapshot.spaceId and snapshot.name required", 400, req);
  }
  assertNoPrivateNotes(body.snapshot);

  const spaceId = String(body.snapshot.spaceId);
  const hostDeviceId = body.deviceId || deviceIdFrom(req);
  const displayName = body.displayName || "Host";

  // ── Reuse existing room for this Space (anti double-room) ──
  if (!body.forceNew) {
    const existingRoomId = await resolveRoomIdFromSpaceId(env, spaceId);
    if (existingRoomId) {
      const roomStub = env.SPACE_ROOM.get(
        env.SPACE_ROOM.idFromName(`room:${existingRoomId}`),
      );
      const fullRes = await roomStub.fetch(
        new Request("https://room/full", { method: "GET" }),
      );
      if (fullRes.ok) {
        // Ensure this device is listed as a member (host reclaim)
        await roomStub.fetch(
          new Request("https://room/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deviceId: hostDeviceId,
              displayName,
            }),
          }),
        );
        // Host re-open must refresh shared history — otherwise guests join a
        // stale snapshot from the first Connect (empty past sessions).
        const pushRes = await roomStub.fetch(
          new Request("https://room/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              snapshot: body.snapshot,
              mergeShared: true,
            }),
          }),
        );
        if (!pushRes.ok) {
          // Fall back to full replace if merge endpoint unavailable
          await roomStub.fetch(
            new Request("https://room/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ snapshot: body.snapshot }),
            }),
          );
        }
        const again = await roomStub.fetch(
          new Request("https://room/full", { method: "GET" }),
        );
        const st = (await again.json()) as RoomState;
        return json(
          {
            roomId: st.roomId,
            shortCode: st.shortCode,
            rev: st.rev,
            reused: true,
          },
          200,
          req,
        );
      }
      // Binding pointed at a dead room — fall through and create fresh
    }
  }

  const shortCode = makeShortCode();
  const roomId = crypto.randomUUID();

  // Primary DO keyed by room id
  const roomDoId = env.SPACE_ROOM.idFromName(`room:${roomId}`);
  const roomStub = env.SPACE_ROOM.get(roomDoId);

  const initRes = await roomStub.fetch(
    new Request("https://room/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        shortCode,
        hostDeviceId,
        snapshot: body.snapshot,
        displayName,
      }),
    }),
  );
  if (!initRes.ok) {
    return error("Could not create room", 500, req);
  }
  const state = (await initRes.json()) as RoomState;

  await bindShortCodeToRoom(env, state.shortCode, state.roomId);
  await bindSpaceIdToRoom(env, spaceId, state.roomId);

  return json(
    {
      roomId: state.roomId,
      shortCode: state.shortCode,
      rev: state.rev,
      reused: false,
    },
    201,
    req,
  );
}

/**
 * Resolve short code → group name + members only.
 * Does not add the guest (used for “Who are you?” before join).
 */
async function previewRoom(req: Request, env: Env): Promise<Response> {
  const body = (await req.json()) as {
    shortCode?: string;
    groupKeyHash?: string;
  };
  const shortCodeRaw = body.shortCode || "";
  const gkh = normalizeGroupKeyHash(body.groupKeyHash || "");
  if (!normalizeShortCode(shortCodeRaw) && gkh.length < 32) {
    return error("Room key or Group Key hash required", 400, req);
  }

  let roomId: string | null = null;
  if (normalizeShortCode(shortCodeRaw)) {
    roomId = await resolveRoomIdFromShortCode(env, shortCodeRaw);
  }
  if (!roomId && gkh.length >= 32) {
    roomId = await resolveRoomIdFromGroupKeyHash(env, gkh);
  }
  if (!roomId) {
    return error(INVALID_JOIN_HELP, 404, req);
  }

  const roomStub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`room:${roomId}`),
  );
  const pullRes = await roomStub.fetch(
    new Request("https://room/pull", { method: "GET" }),
  );
  if (!pullRes.ok) {
    return error("Room not found", 404, req);
  }
  const data = (await pullRes.json()) as {
    rev?: number;
    snapshot?: SharedSnapshot & {
      members?: Array<{ id?: string; name?: string }>;
      name?: string;
      spaceId?: string;
    };
  };
  const snap = data.snapshot;
  if (!snap) {
    return error("Room not found", 404, req);
  }

  const members = (Array.isArray(snap.members) ? snap.members : [])
    .map((m) => ({
      id: String(m.id || ""),
      name: String(m.name || "").trim(),
    }))
    .filter((m) => m.name.length > 0);

  const snapExtra = snap as SharedSnapshot & {
    sessions?: unknown;
    prayerBoard?: unknown;
  };
  const sessions = Array.isArray(snapExtra.sessions) ? snapExtra.sessions : [];
  const prayerBoard = Array.isArray(snapExtra.prayerBoard)
    ? snapExtra.prayerBoard
    : [];

  return json(
    {
      roomId,
      rev: data.rev ?? 0,
      spaceId: String(snap.spaceId || ""),
      name: String(snap.name || "Group"),
      members,
      sessionCount: sessions.length,
      prayerCount: prayerBoard.length,
    },
    200,
    req,
  );
}

/**
 * Issue a new short join code for an existing room (Group Key rotation).
 * Binds new code; room keeps same roomId and snapshot.
 */
async function rotateRoomJoinCode(
  req: Request,
  env: Env,
  roomKey: string,
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    deviceId?: string;
    groupKeyHash?: string;
  };
  const roomStub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`room:${roomKey}`),
  );
  const newShortCode = makeShortCode();
  const rotateRes = await roomStub.fetch(
    new Request("https://room/rotate-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shortCode: newShortCode,
        groupKeyHash: body.groupKeyHash,
        deviceId: body.deviceId || deviceIdFrom(req),
      }),
    }),
  );
  if (!rotateRes.ok) {
    const err = (await rotateRes.json().catch(() => ({}))) as {
      error?: string;
    };
    return error(err.error || "Could not rotate join code", rotateRes.status, req);
  }
  const state = (await rotateRes.json()) as RoomState;

  await bindShortCodeToRoom(env, state.shortCode, state.roomId);
  if (body.groupKeyHash) {
    await bindGroupKeyHashToRoom(env, body.groupKeyHash, state.roomId);
  }
  // Keep spaceId mapping so Connect never forks a second room after code rotate
  const spaceId = String(
    (state.snapshot as SharedSnapshot | undefined)?.spaceId || "",
  );
  if (spaceId) {
    await bindSpaceIdToRoom(env, spaceId, state.roomId);
  }

  return json(
    { shortCode: state.shortCode, rev: state.rev, roomId: state.roomId },
    200,
    req,
  );
}

/** Register Group Key hash on an existing room (no short-code change). */
async function bindGroupKeyOnRoom(
  req: Request,
  env: Env,
  roomKey: string,
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    groupKeyHash?: string;
  };
  const h = normalizeGroupKeyHash(body.groupKeyHash || "");
  if (h.length < 32) {
    return error("groupKeyHash required", 400, req);
  }
  const roomStub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`room:${roomKey}`),
  );
  const full = await roomStub.fetch(
    new Request("https://room/full", { method: "GET" }),
  );
  if (!full.ok) {
    return error("Room not found", 404, req);
  }
  const st = (await full.json()) as RoomState;
  // Persist hash on room record
  await roomStub.fetch(
    new Request("https://room/rotate-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shortCode: st.shortCode,
        groupKeyHash: h,
      }),
    }),
  );
  await bindGroupKeyHashToRoom(env, h, st.roomId);
  return json({ ok: true, roomId: st.roomId }, 200, req);
}

async function joinRoom(req: Request, env: Env): Promise<Response> {
  const body = (await req.json()) as {
    shortCode?: string;
    groupKeyHash?: string;
    displayName?: string;
    deviceId?: string;
  };
  const shortCodeRaw = body.shortCode || "";
  const gkh = normalizeGroupKeyHash(body.groupKeyHash || "");
  const displayName = (body.displayName || "").trim();
  if (
    (!normalizeShortCode(shortCodeRaw) && gkh.length < 32) ||
    !displayName
  ) {
    return error(
      "Room key (or Group Key) and display name required",
      400,
      req,
    );
  }

  let roomId: string | null = null;
  if (normalizeShortCode(shortCodeRaw)) {
    roomId = await resolveRoomIdFromShortCode(env, shortCodeRaw);
  }
  if (!roomId && gkh.length >= 32) {
    roomId = await resolveRoomIdFromGroupKeyHash(env, gkh);
  }
  if (!roomId) {
    return error(INVALID_JOIN_HELP, 404, req);
  }

  const roomStub = env.SPACE_ROOM.get(
    env.SPACE_ROOM.idFromName(`room:${roomId}`),
  );
  const joinRes = await roomStub.fetch(
    new Request("https://room/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: body.deviceId || deviceIdFrom(req),
        displayName,
      }),
    }),
  );
  if (!joinRes.ok) {
    const err = (await joinRes.json().catch(() => ({}))) as { error?: string };
    return error(err.error || "Could not join", joinRes.status, req);
  }
  const data = (await joinRes.json()) as {
    roomId: string;
    shortCode: string;
    rev: number;
    snapshot: SharedSnapshot;
    hostDeviceId: string;
  };
  // Keep spaceId → room map so later Connect reuses this room (no duplicates)
  const spaceId = String(data.snapshot?.spaceId || "");
  if (spaceId) {
    await bindSpaceIdToRoom(env, spaceId, data.roomId);
  }
  return json(data, 200, req);
}

/** Parse entity updatedAt ISO; missing/invalid → 0 (loses LWW). */
function entityUpdatedAtMs(row: { updatedAt?: unknown } | null | undefined): number {
  const raw = row?.updatedAt;
  if (typeof raw !== "string" || !raw) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Whole-entity last-write-wins by updatedAt.
 * On equal stamps (or both missing), prefer incoming.
 */
function pickLwwRow(
  existing: { id?: string; updatedAt?: unknown; [key: string]: unknown } | undefined,
  incoming: { id?: string; updatedAt?: unknown; [key: string]: unknown },
  id: string,
): { id: string; [key: string]: unknown } {
  if (!existing) return { ...incoming, id };
  const a = entityUpdatedAtMs(existing);
  const b = entityUpdatedAtMs(incoming);
  if (b >= a) return { ...existing, ...incoming, id };
  return { ...existing, id };
}

function mergeTombstoneLists(
  a: SnapshotTombstone[] | undefined,
  b: SnapshotTombstone[] | undefined,
): SnapshotTombstone[] {
  const map = new Map<string, SnapshotTombstone>();
  for (const list of [a ?? [], b ?? []]) {
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const id = String(raw.id || "").trim();
      if (!id) continue;
      const deletedAt = String(raw.deletedAt || new Date().toISOString());
      const prev = map.get(id);
      if (
        !prev ||
        entityUpdatedAtMs({ updatedAt: deletedAt }) >=
          entityUpdatedAtMs({ updatedAt: prev.deletedAt })
      ) {
        map.set(id, { id, deletedAt });
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Drop live rows covered by a newer-or-equal tombstone; resurrect if live is newer.
 */
function applyTombstonesToRows(
  rows: Map<string, { id: string; updatedAt?: unknown; [key: string]: unknown }>,
  tombs: SnapshotTombstone[],
): SnapshotTombstone[] {
  const remaining: SnapshotTombstone[] = [];
  for (const t of tombs) {
    const id = String(t.id || "").trim();
    if (!id) continue;
    const live = rows.get(id);
    if (!live) {
      remaining.push({ id, deletedAt: t.deletedAt });
      continue;
    }
    const liveMs = entityUpdatedAtMs(live);
    const delMs = entityUpdatedAtMs({ updatedAt: t.deletedAt });
    if (liveMs > delMs) {
      // resurrect — keep live, drop tombstone
      continue;
    }
    rows.delete(id);
    remaining.push({ id, deletedAt: t.deletedAt });
  }
  return remaining;
}

/**
 * Union shared snapshots by entity id with updatedAt LWW + tombstones.
 * Members still union by name (first wins) so renames do not fork people.
 */
function mergeSharedSnapshots(
  current: SharedSnapshot,
  incoming: SharedSnapshot,
): SharedSnapshot {
  type Row = { id?: string; updatedAt?: unknown; [key: string]: unknown };
  const byId = (rows: unknown): Map<string, Row> => {
    const map = new Map<string, Row>();
    if (!Array.isArray(rows)) return map;
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Row;
      const id = String(row.id || "").trim();
      if (!id) continue;
      map.set(id, row);
    }
    return map;
  };

  const sessions = byId(current.sessions);
  for (const [id, row] of byId(incoming.sessions)) {
    sessions.set(id, pickLwwRow(sessions.get(id), row, id));
  }

  const prayers = byId(current.prayerBoard);
  for (const [id, row] of byId(incoming.prayerBoard)) {
    prayers.set(id, pickLwwRow(prayers.get(id), row, id));
  }

  const sessionTombs = mergeTombstoneLists(
    current.tombstones?.sessions,
    incoming.tombstones?.sessions,
  );
  const prayerTombs = mergeTombstoneLists(
    current.tombstones?.prayerBoard,
    incoming.tombstones?.prayerBoard,
  );

  const keptSessionTombs = applyTombstonesToRows(
    sessions as Map<string, { id: string; updatedAt?: unknown; [key: string]: unknown }>,
    sessionTombs,
  );
  const keptPrayerTombs = applyTombstonesToRows(
    prayers as Map<string, { id: string; updatedAt?: unknown; [key: string]: unknown }>,
    prayerTombs,
  );

  type Member = { id?: string; name?: string; joinedAt?: string };
  const memberMap = new Map<string, Member>();
  const addMembers = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const m = raw as Member;
      const name = String(m.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!memberMap.has(key)) {
        memberMap.set(key, {
          id: String(m.id || crypto.randomUUID()),
          name,
          joinedAt: m.joinedAt || new Date().toISOString(),
        });
      }
    }
  };
  addMembers(current.members);
  addMembers(incoming.members);

  return {
    ...current,
    ...incoming,
    kind: "ds-shared-snapshot",
    v: 1,
    spaceId: String(incoming.spaceId || current.spaceId),
    name: String(incoming.name || current.name),
    members: Array.from(memberMap.values()),
    sessions: Array.from(sessions.values()),
    prayerBoard: Array.from(prayers.values()),
    tombstones: {
      sessions: keptSessionTombs,
      prayerBoard: keptPrayerTombs,
    },
    exportedAt: new Date().toISOString(),
  };
}

function broadcastRoomRev(state: DurableObjectState, rev: number): void {
  const payload = JSON.stringify({ type: "room-updated", rev });
  for (const ws of state.getWebSockets()) {
    try {
      ws.send(payload);
    } catch {
      // drop broken sockets
    }
  }
}

export class SpaceRoom implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Live WebSocket — rev notifications only (no private data)
    if (path === "/live") {
      const upgrade = req.headers.get("Upgrade") || "";
      if (upgrade.toLowerCase() !== "websocket") {
        return Response.json(
          { error: "Expected WebSocket upgrade" },
          { status: 426 },
        );
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      const room = await this.state.storage.get<RoomState>("room");
      try {
        server.send(
          JSON.stringify({
            type: "hello",
            rev: room?.rev ?? 0,
            roomId: room?.roomId,
          }),
        );
      } catch {
        // ignore
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    // ── Account vault slots (same DO class, vault: idFromName) ──
    if (path === "/get" && req.method === "GET") {
      const record = await this.state.storage.get<AccountVaultRecord>("vault");
      if (!record) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      const metaOnly = url.searchParams.get("meta") === "1";
      if (metaOnly) {
        return Response.json({
          updatedAt: record.updatedAt,
          spaceCount: record.spaceCount,
          fingerprint: record.fingerprint,
        });
      }
      return Response.json(record);
    }
    if (path === "/put" && req.method === "POST") {
      const record = (await req.json()) as AccountVaultRecord;
      await this.state.storage.put("vault", record);
      return Response.json({ ok: true });
    }
    if (path === "/delete" && req.method === "DELETE") {
      await this.state.storage.delete("vault");
      return Response.json({ ok: true });
    }

    if (path === "/init" && req.method === "POST") {
      const body = (await req.json()) as {
        roomId: string;
        shortCode: string;
        hostDeviceId: string;
        snapshot: SharedSnapshot;
        displayName: string;
      };
      assertNoPrivateNotes(body.snapshot);
      const now = new Date().toISOString();
      const room: RoomState = {
        roomId: body.roomId,
        shortCode: body.shortCode,
        hostDeviceId: body.hostDeviceId,
        rev: 1,
        snapshot: body.snapshot,
        members: [
          {
            deviceId: body.hostDeviceId,
            displayName: body.displayName,
            joinedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      await this.state.storage.put("room", room);
      return Response.json(room);
    }

    if (path === "/bind-code" && req.method === "POST") {
      const body = (await req.json()) as { roomId: string; shortCode: string };
      await this.state.storage.put("codeBinding", {
        roomId: body.roomId,
        shortCode: body.shortCode,
      });
      return Response.json({ ok: true });
    }

    if (path === "/resolve-code" && req.method === "GET") {
      const binding = await this.state.storage.get<{ roomId: string }>(
        "codeBinding",
      );
      if (!binding?.roomId) {
        return Response.json({ error: "Unknown code" }, { status: 404 });
      }
      return Response.json(binding);
    }

    /** One room per DiscipleSpaces spaceId (anti double-room registry). */
    if (path === "/bind-space" && req.method === "POST") {
      const body = (await req.json()) as { spaceId: string; roomId: string };
      await this.state.storage.put("spaceBinding", {
        spaceId: body.spaceId,
        roomId: body.roomId,
      });
      return Response.json({ ok: true });
    }

    if (path === "/resolve-space" && req.method === "GET") {
      const binding = await this.state.storage.get<{ roomId: string }>(
        "spaceBinding",
      );
      if (!binding?.roomId) {
        return Response.json({ error: "Unknown space" }, { status: 404 });
      }
      return Response.json(binding);
    }

    if (path === "/full" && req.method === "GET") {
      const room = await this.state.storage.get<RoomState>("room");
      if (!room) {
        return Response.json({ error: "Room not found" }, { status: 404 });
      }
      return Response.json(room);
    }

    if (path === "/join" && req.method === "POST") {
      const room = await this.state.storage.get<RoomState>("room");
      if (!room) {
        return Response.json({ error: "Room not found" }, { status: 404 });
      }
      const body = (await req.json()) as {
        deviceId: string;
        displayName: string;
      };
      const existing = room.members.find((m) => m.deviceId === body.deviceId);
      if (!existing) {
        room.members.push({
          deviceId: body.deviceId,
          displayName: body.displayName,
          joinedAt: new Date().toISOString(),
        });
        // Also add to snapshot members by name if missing
        const members = (room.snapshot.members as Array<{
          id: string;
          name: string;
          joinedAt: string;
        }>) || [];
        if (
          !members.some(
            (m) =>
              m.name.toLowerCase() === body.displayName.toLowerCase(),
          )
        ) {
          members.push({
            id: crypto.randomUUID(),
            name: body.displayName,
            joinedAt: new Date().toISOString(),
          });
          room.snapshot = { ...room.snapshot, members };
          room.rev += 1;
        }
        room.updatedAt = new Date().toISOString();
        await this.state.storage.put("room", room);
      }
      return Response.json({
        roomId: room.roomId,
        shortCode: room.shortCode,
        rev: room.rev,
        snapshot: room.snapshot,
        hostDeviceId: room.hostDeviceId,
      });
    }

    // External API paths on the room DO (proxied from worker)
    if (req.method === "GET") {
      const room = await this.state.storage.get<RoomState>("room");
      if (!room) {
        return Response.json({ error: "Room not found" }, { status: 404 });
      }
      const since = Number(url.searchParams.get("since") || "0");
      if (since > 0 && since >= room.rev) {
        return Response.json({ unchanged: true, rev: room.rev });
      }
      return Response.json({ rev: room.rev, snapshot: room.snapshot });
    }

    if (req.method === "POST") {
      const room = await this.state.storage.get<RoomState>("room");
      if (!room) {
        return Response.json({ error: "Room not found" }, { status: 404 });
      }
      const body = (await req.json()) as {
        snapshot?: SharedSnapshot;
        baseRev?: number;
        /** Union sessions/prayers by id so host re-open never drops guest rows. */
        mergeShared?: boolean;
      };
      if (!body.snapshot) {
        return Response.json({ error: "snapshot required" }, { status: 400 });
      }
      assertNoPrivateNotes(body.snapshot);
      // Optimistic concurrency: client must push from the rev it last pulled.
      // Missing baseRev (legacy clients) skips the check so pilots keep working.
      if (
        body.baseRev != null &&
        Number.isFinite(Number(body.baseRev)) &&
        Number(body.baseRev) !== room.rev
      ) {
        return Response.json(
          {
            error: "Revision conflict",
            code: "REV_CONFLICT",
            rev: room.rev,
            snapshot: room.snapshot,
          },
          { status: 409 },
        );
      }
      if (body.mergeShared) {
        room.snapshot = mergeSharedSnapshots(room.snapshot, body.snapshot);
      } else {
        room.snapshot = body.snapshot;
      }
      room.rev += 1;
      room.updatedAt = new Date().toISOString();
      await this.state.storage.put("room", room);
      broadcastRoomRev(this.state, room.rev);
      return Response.json({ rev: room.rev });
    }

    if (req.method === "DELETE") {
      await this.state.storage.deleteAll();
      return Response.json({ ok: true });
    }

    if (path === "/rotate-code" && req.method === "POST") {
      const room = await this.state.storage.get<RoomState>("room");
      if (!room) {
        return Response.json({ error: "Room not found" }, { status: 404 });
      }
      const body = (await req.json()) as {
        shortCode: string;
        groupKeyHash?: string;
        deviceId?: string;
      };
      if (!body.shortCode) {
        return Response.json(
          { error: "shortCode required" },
          { status: 400 },
        );
      }
      room.shortCode = body.shortCode;
      if (body.groupKeyHash) {
        room.groupKeyHash = body.groupKeyHash;
      }
      room.rev += 1;
      room.updatedAt = new Date().toISOString();
      await this.state.storage.put("room", room);
      broadcastRoomRev(this.state, room.rev);
      return Response.json(room);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Clients may ping; reply with current rev
    try {
      const text =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      const data = JSON.parse(text) as { type?: string };
      if (data.type === "ping") {
        const room = await this.state.storage.get<RoomState>("room");
        ws.send(
          JSON.stringify({ type: "pong", rev: room?.rev ?? 0 }),
        );
      }
    } catch {
      // ignore
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
}

/** Pilot feedback inbox — newest first, capped. */
export class FeedbackInbox implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/append" && req.method === "POST") {
      const record = (await req.json()) as FeedbackRecord;
      const list =
        (await this.state.storage.get<FeedbackRecord[]>("items")) || [];
      list.unshift(record);
      // Keep last 200 reports for the pilot
      await this.state.storage.put("items", list.slice(0, 200));
      return Response.json({ ok: true, id: record.id });
    }

    if (path === "/list" && req.method === "GET") {
      const limit = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get("limit") || "40")),
      );
      const list =
        (await this.state.storage.get<FeedbackRecord[]>("items")) || [];
      return Response.json({
        count: list.length,
        items: list.slice(0, limit),
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
