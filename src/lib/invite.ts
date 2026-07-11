/**
 * Offline invite packages for DiscipleSpaces.
 * No server: the QR / pasted package carries everything needed to join locally.
 * Short codes are human-readable labels and are validated against the package.
 */

import type { Member, Space, SpaceKind, SpaceTemplateId } from "../types";
import { maxMembersForSpace } from "../types";

export const INVITE_KIND = "ds-invite" as const;
export const INVITE_PREFIX = "DS1.";

export interface SpaceInvitePayload {
  v: 1;
  kind: typeof INVITE_KIND;
  spaceId: string;
  code: string;
  name: string;
  description?: string;
  /** Member snapshot at invite time (ids + names only). */
  members: Array<{ id: string; name: string }>;
  issuedAt: string;
  /** group (default) or family — used for join capacity. */
  spaceKind?: SpaceKind;
  spaceTemplate?: SpaceTemplateId;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Derive a stable short code from space id (same device / re-open). */
export async function deriveInviteCode(spaceId: string): Promise<string> {
  const data = new TextEncoder().encode(`disciple-spaces-invite:${spaceId}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function formatInviteCode(code: string): string {
  const cleaned = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}

export function buildInvitePayload(
  space: Space,
  inviteCode: string,
): SpaceInvitePayload {
  return {
    v: 1,
    kind: INVITE_KIND,
    spaceId: space.id,
    code: inviteCode,
    name: space.name,
    description: space.description,
    members: space.members.map((m) => ({ id: m.id, name: m.name })),
    issuedAt: new Date().toISOString(),
    spaceKind: space.spaceKind === "family" ? "family" : "group",
    spaceTemplate: space.spaceTemplate,
  };
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Compact machine-readable invite package for QR / paste. */
export function encodeInvitePackage(payload: SpaceInvitePayload): string {
  return INVITE_PREFIX + toBase64Url(JSON.stringify(payload));
}

/** Friendly multi-line text for clipboard / messages. */
export function formatInviteShareText(payload: SpaceInvitePayload): string {
  const pack = encodeInvitePackage(payload);
  return [
    `DiscipleSpaces invite: ${payload.name}`,
    `Code: ${payload.code}`,
    "",
    "Paste the package below into DiscipleSpaces → Join a Space.",
    "You will join for current & future sessions only (not past history).",
    "",
    pack,
  ].join("\n");
}

/**
 * Parse invite from QR text, full share text, or bare DS1. package.
 */
export function parseInviteInput(raw: string): SpaceInvitePayload {
  const text = raw.trim();
  if (!text) throw new Error("Paste or scan an invite package");

  // Prefer DS1. package anywhere in the string
  const packageMatch = text.match(/DS1\.[A-Za-z0-9_-]+/);
  if (packageMatch) {
    return decodeInvitePackage(packageMatch[0]);
  }

  // Raw JSON payload
  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as SpaceInvitePayload;
    assertInvitePayload(parsed);
    return parsed;
  }

  throw new Error(
    "Could not read this invite. Scan the QR code or paste the full invite package (starts with DS1.).",
  );
}

export function decodeInvitePackage(pack: string): SpaceInvitePayload {
  const body = pack.trim().startsWith(INVITE_PREFIX)
    ? pack.trim().slice(INVITE_PREFIX.length)
    : pack.trim();
  try {
    const json = fromBase64Url(body);
    const parsed = JSON.parse(json) as SpaceInvitePayload;
    assertInvitePayload(parsed);
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid invite")) {
      throw err;
    }
    throw new Error("This invite package is damaged or incomplete.");
  }
}

function assertInvitePayload(p: SpaceInvitePayload): void {
  if (!p || p.kind !== INVITE_KIND || p.v !== 1) {
    throw new Error("Invalid invite: unsupported format.");
  }
  if (!p.spaceId || !p.name || !p.code) {
    throw new Error("Invalid invite: missing space details.");
  }
  if (!Array.isArray(p.members)) {
    p.members = [];
  }
}

/** Merge invite members with joiner; cap at maxMembers (group 5 / family 10). */
export function membersForJoin(
  inviteMembers: Array<{ id: string; name: string }>,
  joinerName: string,
  maxMembers: number = maxMembersForSpace("group"),
): Member[] {
  const now = new Date().toISOString();
  const result: Member[] = [];
  const seenNames = new Set<string>();

  for (const m of inviteMembers) {
    if (result.length >= maxMembers) break;
    const name = m.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    result.push({
      id: m.id || crypto.randomUUID(),
      name,
      joinedAt: now,
    });
  }

  const joinName = joinerName.trim();
  if (joinName && !seenNames.has(joinName.toLowerCase())) {
    if (result.length >= maxMembers) {
      throw new Error(
        `This space already has ${maxMembers} members. Ask someone to free a seat first.`,
      );
    }
    result.push({
      id: crypto.randomUUID(),
      name: joinName,
      joinedAt: now,
    });
  }

  if (result.length === 0) {
    throw new Error("Add your name so you appear on the member list.");
  }

  return result;
}
