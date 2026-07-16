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

interface SharedSnapshot {
  v: 1;
  kind: "ds-shared-snapshot";
  spaceId: string;
  name: string;
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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
            features: ["rooms", "feedback"],
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

      if (path === "/rooms" && req.method === "POST") {
        return createRoom(req, env);
      }

      if (path === "/rooms/join" && req.method === "POST") {
        return joinRoom(req, env);
      }

      /** Peek at group name + members without joining (for “Who are you?”). */
      if (path === "/rooms/preview" && req.method === "POST") {
        return previewRoom(req, env);
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

async function createRoom(req: Request, env: Env): Promise<Response> {
  const body = (await req.json()) as {
    snapshot?: SharedSnapshot;
    displayName?: string;
    deviceId?: string;
  };
  if (!body.snapshot?.spaceId || !body.snapshot?.name) {
    return error("snapshot.spaceId and snapshot.name required", 400, req);
  }
  assertNoPrivateNotes(body.snapshot);

  const shortCode = makeShortCode();
  const roomId = crypto.randomUUID();
  const hostDeviceId = body.deviceId || deviceIdFrom(req);

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
        displayName: body.displayName || "Host",
      }),
    }),
  );
  if (!initRes.ok) {
    return error("Could not create room", 500, req);
  }
  const state = (await initRes.json()) as RoomState;

  // Code index: bind under normalized key (and legacy hyphen key for safety)
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
    const bindRes = await codeStub.fetch(
      new Request("https://room/bind-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bindPayload,
      }),
    );
    if (!bindRes.ok) {
      return error("Could not publish join code", 500, req);
    }
  }

  return json(
    {
      roomId: state.roomId,
      shortCode: state.shortCode,
      rev: state.rev,
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
  const body = (await req.json()) as { shortCode?: string };
  const shortCodeRaw = body.shortCode || "";
  if (!normalizeShortCode(shortCodeRaw)) {
    return error("shortCode required", 400, req);
  }

  const roomId = await resolveRoomIdFromShortCode(env, shortCodeRaw);
  if (!roomId) {
    return error(
      "Invalid or expired join code. Check the code (hyphens optional) and that the host Connected this group.",
      404,
      req,
    );
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

  return json(
    {
      roomId,
      rev: data.rev ?? 0,
      spaceId: String(snap.spaceId || ""),
      name: String(snap.name || "Group"),
      members,
    },
    200,
    req,
  );
}

async function joinRoom(req: Request, env: Env): Promise<Response> {
  const body = (await req.json()) as {
    shortCode?: string;
    displayName?: string;
    deviceId?: string;
  };
  const shortCodeRaw = body.shortCode || "";
  const displayName = (body.displayName || "").trim();
  if (!normalizeShortCode(shortCodeRaw) || !displayName) {
    return error("shortCode and displayName required", 400, req);
  }

  const roomId = await resolveRoomIdFromShortCode(env, shortCodeRaw);
  if (!roomId) {
    return error(
      "Invalid or expired join code. Check the code (hyphens optional) and that the host Connected this group.",
      404,
      req,
    );
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
  const data = await joinRes.json();
  return json(data, 200, req);
}

export class SpaceRoom implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

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
      };
      if (!body.snapshot) {
        return Response.json({ error: "snapshot required" }, { status: 400 });
      }
      assertNoPrivateNotes(body.snapshot);
      room.snapshot = body.snapshot;
      room.rev += 1;
      room.updatedAt = new Date().toISOString();
      await this.state.storage.put("room", room);
      return Response.json({ rev: room.rev });
    }

    if (req.method === "DELETE") {
      await this.state.storage.deleteAll();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
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
