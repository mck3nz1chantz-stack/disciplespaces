/**
 * Manual Space Update export / import (device-local, no cloud).
 * Never includes PrivateNote content.
 * Includes shared prayer board entries (space-facing).
 */

import type { PrayerBoardEntry, Session, Space } from "../types";

export const EXPORT_KIND = "ds-export" as const;
export const EXPORT_PREFIX = "DSX1.";

export interface SpaceExportPayload {
  v: 1;
  kind: typeof EXPORT_KIND;
  exportedAt: string;
  space: {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    members: Space["members"];
    preferredBibleVersion: "KJV" | "WEB";
    inviteCode?: string;
    spaceTemplate?: Space["spaceTemplate"];
    spaceKind?: Space["spaceKind"];
    defaultSessionTemplateId?: string;
  };
  /** Shared sessions only — no private notes. */
  sessions: Session[];
  /** Shared prayer board — optional for older packages. */
  prayerBoard?: PrayerBoardEntry[];
}

export function buildSpaceExport(
  space: Space,
  sessions: Session[],
  prayerBoard: PrayerBoardEntry[] = [],
): SpaceExportPayload {
  return {
    v: 1,
    kind: EXPORT_KIND,
    exportedAt: new Date().toISOString(),
    space: {
      id: space.id,
      name: space.name,
      description: space.description,
      createdAt: space.createdAt,
      members: space.members,
      preferredBibleVersion: "KJV",
      inviteCode: space.inviteCode,
      spaceTemplate: space.spaceTemplate,
      spaceKind: space.spaceKind === "family" ? "family" : "group",
      defaultSessionTemplateId: space.defaultSessionTemplateId,
    },
    sessions: sessions
      .filter((s) => s.spaceId === space.id)
      .map((s) => ({
        ...s,
        // Ensure shape is plain data
        passagesStudied: s.passagesStudied ?? [],
        attendees: s.attendees ?? [],
        notes: s.notes,
      })),
    prayerBoard: prayerBoard
      .filter((e) => e.spaceId === space.id)
      .map((e) => ({
        id: e.id,
        spaceId: e.spaceId,
        sessionId: e.sessionId,
        scope: e.scope,
        kind: e.kind,
        authorMemberId: e.authorMemberId,
        authorName: e.authorName,
        subject: e.subject,
        content: e.content,
        status: e.status,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
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

export function encodeExportPackage(payload: SpaceExportPayload): string {
  return EXPORT_PREFIX + toBase64Url(JSON.stringify(payload));
}

export function formatExportShareText(payload: SpaceExportPayload): string {
  const pack = encodeExportPackage(payload);
  const n = payload.sessions.length;
  const prayers = payload.prayerBoard?.length ?? 0;
  return [
    `DiscipleSpaces group file: ${payload.space.name}`,
    `Meetings included: ${n}`,
    prayers > 0 ? `Prayer notes: ${prayers}` : null,
    `Saved: ${payload.exportedAt.slice(0, 10)}`,
    "",
    "How to open this on another phone:",
    "1. Open https://disciple-spaces.pages.dev",
    "2. Tap Join a group (or Settings → Restore)",
    "3. Paste this whole message, enter your name",
    "",
    "Shared prayer is included. Notes marked “Just for me” are never included.",
    "",
    pack,
  ]
    .filter((line) => line != null)
    .join("\n");
}

export function parseExportInput(raw: string): SpaceExportPayload {
  const text = raw.trim();
  if (!text) throw new Error("Paste a Space Update package");

  const packageMatch = text.match(/DSX1\.[A-Za-z0-9_-]+/);
  if (packageMatch) {
    return decodeExportPackage(packageMatch[0]);
  }

  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as SpaceExportPayload;
    assertExport(parsed);
    return parsed;
  }

  throw new Error(
    "Could not read this as a group backup. Need a full Space Update package (starts with DSX1.), optional export JSON, or a Zip that contains one. Personal multi-space files use DSP1.",
  );
}

export function decodeExportPackage(pack: string): SpaceExportPayload {
  const body = pack.trim().startsWith(EXPORT_PREFIX)
    ? pack.trim().slice(EXPORT_PREFIX.length)
    : pack.trim();
  try {
    const parsed = JSON.parse(fromBase64Url(body)) as SpaceExportPayload;
    assertExport(parsed);
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid export")) {
      throw err;
    }
    throw new Error("This Space Update package is damaged or incomplete.");
  }
}

function assertExport(p: SpaceExportPayload): void {
  if (!p || p.kind !== EXPORT_KIND || p.v !== 1) {
    throw new Error("Invalid export: unsupported format.");
  }
  if (!p.space?.id || !p.space?.name) {
    throw new Error("Invalid export: missing space.");
  }
  if (!Array.isArray(p.sessions)) {
    throw new Error("Invalid export: missing sessions list.");
  }
  if (p.prayerBoard != null && !Array.isArray(p.prayerBoard)) {
    throw new Error("Invalid export: prayer board must be a list.");
  }
}

export function exportFilename(spaceName: string): string {
  const safe = spaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const day = new Date().toISOString().slice(0, 10);
  return `disciple-spaces-${safe || "space"}-${day}.txt`;
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
