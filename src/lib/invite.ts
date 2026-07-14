/**
 * Offline invite packages for DiscipleSpaces.
 * No server: the QR / pasted package / deep link carries everything needed to join locally.
 * Short codes are human-readable labels and are validated against the package.
 */

import type { Member, Space, SpaceKind, SpaceTemplateId } from "../types";
import { maxMembersForSpace } from "../types";
import { PRODUCTION_URL } from "./legal";

export const INVITE_KIND = "ds-invite" as const;
export const INVITE_PREFIX = "DS1.";

/** Joiner → host receipt so the host can add them to the local member list. */
export const MEMBER_JOIN_KIND = "ds-member-join" as const;
export const MEMBER_JOIN_PREFIX = "DSM1.";

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

export interface MemberJoinPayload {
  v: 1;
  kind: typeof MEMBER_JOIN_KIND;
  spaceId: string;
  code: string;
  spaceName: string;
  member: { id: string; name: string };
  joinedAt: string;
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

export function buildMemberJoinPayload(input: {
  spaceId: string;
  code: string;
  spaceName: string;
  member: Member;
}): MemberJoinPayload {
  return {
    v: 1,
    kind: MEMBER_JOIN_KIND,
    spaceId: input.spaceId,
    code: input.code,
    spaceName: input.spaceName,
    member: { id: input.member.id, name: input.member.name },
    joinedAt: input.member.joinedAt || new Date().toISOString(),
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
  // SMS / mail clients sometimes insert spaces or newlines into long tokens
  const cleaned = input.replace(/[\s\u200b\u00ad]/g, "");
  const padded = cleaned.replace(/-/g, "+").replace(/_/g, "/");
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

export function encodeMemberJoinPackage(payload: MemberJoinPayload): string {
  return MEMBER_JOIN_PREFIX + toBase64Url(JSON.stringify(payload));
}

/**
 * Tappable deep link for Messages / Mail.
 * Uses hash so Cloudflare Pages always serves the SPA shell.
 */
export function buildInviteDeepLink(pack: string): string {
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : PRODUCTION_URL;
  return `${base}/#invite=${encodeURIComponent(pack)}`;
}

export function buildMemberJoinDeepLink(pack: string): string {
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : PRODUCTION_URL;
  return `${base}/#joinconfirm=${encodeURIComponent(pack)}`;
}

/** Friendly multi-line text for clipboard / messages. */
export function formatInviteShareText(payload: SpaceInvitePayload): string {
  const pack = encodeInvitePackage(payload);
  const link = buildInviteDeepLink(pack);
  return [
    `DiscipleSpaces invite: ${payload.name}`,
    `Code: ${payload.code}`,
    "",
    "Open this link on your phone (install DiscipleSpaces if needed):",
    link,
    "",
    "Or open the app → Join → paste the package below:",
    pack,
    "",
    "Tip: After you join, send the “I'm in” confirmation back so your name appears on their member list.",
  ].join("\n");
}

export function formatMemberJoinShareText(payload: MemberJoinPayload): string {
  const pack = encodeMemberJoinPackage(payload);
  const link = buildMemberJoinDeepLink(pack);
  return [
    `I'm in — DiscipleSpaces: ${payload.spaceName}`,
    `${payload.member.name} joined (code ${payload.code}).`,
    "",
    "Host: open this link (or Join → paste) so your member count updates:",
    link,
    "",
    pack,
  ].join("\n");
}

/**
 * Read invite/export/join-confirm token from the current URL (query or hash).
 * Clears the token from the address bar after reading.
 */
export function consumeInviteFromLocation(
  loc: Location = window.location,
): { kind: "invite" | "export" | "member-join"; raw: string } | null {
  try {
    const url = new URL(loc.href);

    const fromQuery =
      url.searchParams.get("invite") ||
      url.searchParams.get("i") ||
      url.searchParams.get("joinconfirm") ||
      url.searchParams.get("export");
    if (fromQuery) {
      const kind = classifyPackageToken(fromQuery);
      url.searchParams.delete("invite");
      url.searchParams.delete("i");
      url.searchParams.delete("joinconfirm");
      url.searchParams.delete("export");
      const next = url.pathname + url.search + (url.hash || "");
      window.history.replaceState(null, "", next || "/");
      if (kind) return { kind, raw: fromQuery };
    }

    const hash = loc.hash.startsWith("#") ? loc.hash.slice(1) : loc.hash;
    if (!hash) return null;

    let raw: string | null = null;
    if (hash.startsWith("invite=")) {
      raw = decodeURIComponent(hash.slice("invite=".length));
    } else if (hash.startsWith("joinconfirm=")) {
      raw = decodeURIComponent(hash.slice("joinconfirm=".length));
    } else if (hash.startsWith("export=")) {
      raw = decodeURIComponent(hash.slice("export=".length));
    } else if (
      hash.includes("DS1.") ||
      hash.includes("DSX1.") ||
      hash.includes("DSM1.")
    ) {
      raw = decodeURIComponent(hash);
    }

    if (!raw) return null;

    const kind = classifyPackageToken(raw);
    // Clear hash so refresh doesn't re-trigger
    const cleaned = `${url.pathname}${url.search}` || "/";
    window.history.replaceState(null, "", cleaned);
    if (!kind) return null;
    return { kind, raw };
  } catch {
    return null;
  }
}

function classifyPackageToken(
  raw: string,
): "invite" | "export" | "member-join" | null {
  const t = raw.trim();
  if (/DSM1\./i.test(t) || t.includes("ds-member-join")) return "member-join";
  if (/DSX1\./i.test(t) || t.includes("ds-export")) return "export";
  if (/DS1\./i.test(t) || t.includes("ds-invite")) return "invite";
  // Bare package body without prefix — try decode later as invite
  if (/^[A-Za-z0-9_-]{40,}$/.test(t.replace(/[\s\u200b]/g, ""))) {
    return "invite";
  }
  return null;
}

/**
 * Parse invite from QR text, full share text, deep link, or bare DS1. package.
 */
export function parseInviteInput(raw: string): SpaceInvitePayload {
  const text = normalizeInviteText(raw);
  if (!text) throw new Error("Paste or scan an invite package");

  // Deep link: …#invite=DS1.… or ?invite=
  const linkPack = extractPackageFromDeepLinkish(text, "invite");
  if (linkPack) {
    return decodeInvitePackage(linkPack);
  }

  // Prefer DS1. package anywhere in the string (allow whitespace inside body)
  const packageMatch = text.match(/DS1\.([A-Za-z0-9_=\s\u200b-]+)/i);
  if (packageMatch) {
    return decodeInvitePackage(
      "DS1." + packageMatch[1]!.replace(/[\s\u200b\u00ad]/g, ""),
    );
  }

  // Raw JSON payload
  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as SpaceInvitePayload;
    assertInvitePayload(parsed);
    return parsed;
  }

  // Short code only — common failure mode when texting
  const shortOnly = text.replace(/[^a-zA-Z0-9-]/g, "");
  if (/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(shortOnly) && !/DS1\./i.test(text)) {
    throw new Error(
      "That looks like only the short code. The short code alone cannot join offline — paste the full invite (starts with DS1.) or open the invite link from the message.",
    );
  }

  throw new Error(
    "Could not read this invite. Open the invite link, scan the QR code, or paste the full invite package (starts with DS1.).",
  );
}

export function parseMemberJoinInput(raw: string): MemberJoinPayload {
  const text = normalizeInviteText(raw);
  if (!text) throw new Error("Paste a join confirmation package");

  const linkPack = extractPackageFromDeepLinkish(text, "joinconfirm");
  if (linkPack) {
    return decodeMemberJoinPackage(linkPack);
  }

  const packageMatch = text.match(/DSM1\.([A-Za-z0-9_=\s\u200b-]+)/i);
  if (packageMatch) {
    return decodeMemberJoinPackage(
      "DSM1." + packageMatch[1]!.replace(/[\s\u200b\u00ad]/g, ""),
    );
  }

  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as MemberJoinPayload;
    assertMemberJoinPayload(parsed);
    return parsed;
  }

  throw new Error(
    "Could not read this join confirmation. Paste the full package (starts with DSM1.) or open the confirmation link.",
  );
}

function normalizeInviteText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .trim();
}

function extractPackageFromDeepLinkish(
  text: string,
  param: "invite" | "joinconfirm" | "export",
): string | null {
  // Full URL or fragment
  try {
    if (text.includes("://") || text.startsWith("/") || text.includes("#")) {
      const asUrl = text.includes("://")
        ? new URL(text)
        : new URL(text, "https://disciple-spaces.pages.dev");
      const q =
        asUrl.searchParams.get(param) ||
        asUrl.searchParams.get(param === "invite" ? "i" : param);
      if (q) return q;
      const hash = asUrl.hash.startsWith("#")
        ? asUrl.hash.slice(1)
        : asUrl.hash;
      if (hash.startsWith(`${param}=`)) {
        return decodeURIComponent(hash.slice(param.length + 1));
      }
    }
  } catch {
    // fall through
  }

  const re = new RegExp(
    `[#?&]${param}=([^\\s&]+)|(?:^|\\s)(${param}=)([^\\s]+)`,
    "i",
  );
  const m = text.match(re);
  if (m) {
    const val = m[1] || m[3];
    if (val) {
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}

export function decodeInvitePackage(pack: string): SpaceInvitePayload {
  let body = pack.trim();
  if (body.toUpperCase().startsWith(INVITE_PREFIX.toUpperCase())) {
    body = body.slice(INVITE_PREFIX.length);
  }
  body = body.replace(/[\s\u200b\u00ad]/g, "");
  try {
    const json = fromBase64Url(body);
    const parsed = JSON.parse(json) as SpaceInvitePayload;
    assertInvitePayload(parsed);
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid invite")) {
      throw err;
    }
    throw new Error(
      "This invite package is damaged or incomplete. Ask them to re-share the full invite (or the link), not only the short code.",
    );
  }
}

export function decodeMemberJoinPackage(pack: string): MemberJoinPayload {
  let body = pack.trim();
  if (body.toUpperCase().startsWith(MEMBER_JOIN_PREFIX.toUpperCase())) {
    body = body.slice(MEMBER_JOIN_PREFIX.length);
  }
  body = body.replace(/[\s\u200b\u00ad]/g, "");
  try {
    const parsed = JSON.parse(fromBase64Url(body)) as MemberJoinPayload;
    assertMemberJoinPayload(parsed);
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid join")) {
      throw err;
    }
    throw new Error("This join confirmation is damaged or incomplete.");
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

function assertMemberJoinPayload(p: MemberJoinPayload): void {
  if (!p || p.kind !== MEMBER_JOIN_KIND || p.v !== 1) {
    throw new Error("Invalid join confirmation: unsupported format.");
  }
  if (!p.spaceId || !p.member?.name) {
    throw new Error("Invalid join confirmation: missing member details.");
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

/** Detect what kind of package is in freeform paste (for Join modal routing). */
export function detectJoinPackageKind(
  raw: string,
): "invite" | "export" | "member-join" | "unknown" {
  const text = normalizeInviteText(raw);
  if (!text) return "unknown";
  if (/DSM1\./i.test(text) || /ds-member-join/i.test(text)) return "member-join";
  if (/DSX1\./i.test(text) || /ds-export/i.test(text)) return "export";
  if (/DS1\./i.test(text) || /ds-invite/i.test(text)) return "invite";
  if (text.includes("joinconfirm=")) return "member-join";
  if (text.includes("export=")) return "export";
  if (text.includes("invite=") || text.includes("#invite")) return "invite";
  return "unknown";
}
