/**
 * Personal device backup (DSP1.) — multi-space + optional encrypted private notes.
 * Separate from Space Update packages (DSX1.) which stay shared-layer only.
 */

import type { PrivateNote, Session, Space } from "../../types";
import type { SpaceExportPayload } from "../share";
import { buildSpaceExport, downloadTextFile } from "../share";
import {
  getAccountKeyMeta,
  getAccountKeyPrefs,
  getStoredAccountKey,
  normalizeAccountKeyInput,
} from "./accountKey";
import {
  decryptJson,
  encryptJson,
  type EncryptedBlob,
} from "./crypto";

export const PERSONAL_BACKUP_KIND = "ds-personal-backup" as const;
export const PERSONAL_BACKUP_PREFIX = "DSP1.";

const NOTES_PURPOSE = "personal-notes-v1";

export interface PersonalBackupPayload {
  v: 1;
  kind: typeof PERSONAL_BACKUP_KIND;
  exportedAt: string;
  accountKeyId?: string;
  accountKeyFingerprint?: string;
  /** Shared-layer space packages (same shape as DSX1 body). */
  spaces: SpaceExportPayload[];
  /**
   * Present only when user opted in and Account Key was used.
   * Ciphertext of PrivateNote[] — never plain.
   */
  privateNotesEnc?: EncryptedBlob;
  /** true when notes were intentionally omitted (default). */
  privateNotesIncluded: boolean;
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

export function encodePersonalBackup(payload: PersonalBackupPayload): string {
  return PERSONAL_BACKUP_PREFIX + toBase64Url(JSON.stringify(payload));
}

export function parsePersonalBackupInput(raw: string): PersonalBackupPayload {
  const text = raw.trim();
  const match = text.match(/DSP1\.[A-Za-z0-9_-]+/);
  const pack = match ? match[0] : text;
  if (!pack.startsWith(PERSONAL_BACKUP_PREFIX) && !pack.startsWith("{")) {
    throw new Error(
      "Could not read personal backup. Expected a DSP1. package, JSON, or a Zip that contains one.",
    );
  }
  if (pack.startsWith("{")) {
    const parsed = JSON.parse(pack) as PersonalBackupPayload;
    assertPersonal(parsed);
    return parsed;
  }
  const body = pack.slice(PERSONAL_BACKUP_PREFIX.length);
  const parsed = JSON.parse(fromBase64Url(body)) as PersonalBackupPayload;
  assertPersonal(parsed);
  return parsed;
}

function assertPersonal(p: PersonalBackupPayload): void {
  if (!p || p.kind !== PERSONAL_BACKUP_KIND || p.v !== 1) {
    throw new Error("Invalid personal backup format.");
  }
  if (!Array.isArray(p.spaces)) {
    throw new Error("Invalid personal backup: missing spaces.");
  }
}

export async function buildPersonalBackup(input: {
  spaces: Space[];
  sessionsBySpace: Map<string, Session[]>;
  prayerBySpace: Map<string, import("../../types").PrayerBoardEntry[]>;
  privateNotes: PrivateNote[];
  /** Override prefs / force include notes. Requires Account Key. */
  includePrivateNotes?: boolean;
  accountKeySecret?: string | null;
}): Promise<PersonalBackupPayload> {
  const prefs = getAccountKeyPrefs();
  const include =
    input.includePrivateNotes ?? prefs.includePrivateNotesInPersonalBackup;
  const meta = getAccountKeyMeta();
  const secret =
    input.accountKeySecret ?? getStoredAccountKey() ?? null;

  const spaces: SpaceExportPayload[] = input.spaces.map((space) =>
    buildSpaceExport(
      space,
      input.sessionsBySpace.get(space.id) ?? [],
      input.prayerBySpace.get(space.id) ?? [],
    ),
  );

  const payload: PersonalBackupPayload = {
    v: 1,
    kind: PERSONAL_BACKUP_KIND,
    exportedAt: new Date().toISOString(),
    accountKeyId: meta?.keyId,
    accountKeyFingerprint: meta?.fingerprint,
    spaces,
    privateNotesIncluded: false,
  };

  if (include) {
    if (!secret) {
      throw new Error(
        "Create or link an Account Key before including private notes in a backup.",
      );
    }
    payload.privateNotesEnc = await encryptJson(
      normalizeAccountKeyInput(secret),
      NOTES_PURPOSE,
      input.privateNotes,
    );
    payload.privateNotesIncluded = true;
  }

  return payload;
}

export async function decryptPersonalNotes(
  payload: PersonalBackupPayload,
  accountKeyRaw: string,
): Promise<PrivateNote[]> {
  if (!payload.privateNotesEnc) {
    return [];
  }
  return decryptJson<PrivateNote[]>(
    normalizeAccountKeyInput(accountKeyRaw),
    NOTES_PURPOSE,
    payload.privateNotesEnc,
  );
}

export function formatPersonalBackupShareText(
  payload: PersonalBackupPayload,
): string {
  const pack = encodePersonalBackup(payload);
  return [
    "DiscipleSpaces personal backup",
    `Spaces: ${payload.spaces.length}`,
    `Saved: ${payload.exportedAt.slice(0, 10)}`,
    payload.privateNotesIncluded
      ? "Private notes: included (encrypted with your Account Key)"
      : "Private notes: not included (device-only)",
    payload.accountKeyFingerprint
      ? `Account Key fingerprint: ${payload.accountKeyFingerprint}`
      : null,
    "",
    "Restore: Settings → Your Spaces & data → Restore, or paste below.",
    "Shared group files still use DSX1. packages.",
    "",
    pack,
  ]
    .filter((line) => line != null)
    .join("\n");
}

export function personalBackupFilename(): string {
  const day = new Date().toISOString().slice(0, 10);
  return `disciple-spaces-personal-${day}.txt`;
}

export function downloadPersonalBackup(payload: PersonalBackupPayload): void {
  downloadTextFile(
    personalBackupFilename(),
    formatPersonalBackupShareText(payload),
  );
}

/** Download a tiny key-card file (Account or Group) for the save gate. */
export function downloadKeyCard(input: {
  title: string;
  key: string;
  fingerprint?: string;
  extraLines?: string[];
}): void {
  const day = new Date().toISOString().slice(0, 10);
  const safe = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const body = [
    `DiscipleSpaces — ${input.title}`,
    `Saved: ${day}`,
    "",
    "Store this somewhere safe. DiscipleSpaces cannot recover it for you.",
    "Anyone with this key can restore linked data on another device.",
    "",
    input.key,
    input.fingerprint ? `Fingerprint: ${input.fingerprint}` : null,
    ...(input.extraLines ?? []),
    "",
    "Also keep a DSX1. group backup or DSP1. personal backup.",
  ]
    .filter((line) => line != null)
    .join("\n");
  downloadTextFile(`disciple-spaces-${safe || "key"}-${day}.txt`, body);
}
