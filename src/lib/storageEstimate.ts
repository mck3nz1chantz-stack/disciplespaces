/**
 * Approximate storage usage for Settings.
 * Bible size is a known bundle estimate; user data uses JSON size of Dexie rows.
 */

import { db } from "./db";

/** Approx. total KJV JSON under public/data/bible (~4.2 MB on disk). */
export const BIBLE_DATA_BYTES_ESTIMATE = 4.2 * 1024 * 1024;

export interface StorageBreakdown {
  bibleBytes: number;
  userDataBytes: number;
  /** From navigator.storage.estimate().usage when available */
  browserUsageBytes: number | null;
  /** From navigator.storage.estimate().quota when available */
  browserQuotaBytes: number | null;
  spaces: number;
  sessions: number;
  privateNotes: number;
  prayerBoard: number;
  templates: number;
}

export async function estimateStorageBreakdown(): Promise<StorageBreakdown> {
  const [spaces, sessions, privateNotes, prayerBoard, templates, estimate] =
    await Promise.all([
      db.spaces.toArray(),
      db.sessions.toArray(),
      db.privateNotes.toArray(),
      db.prayerBoard.toArray(),
      db.templates.toArray(),
      typeof navigator !== "undefined" && navigator.storage?.estimate
        ? navigator.storage.estimate()
        : Promise.resolve({ usage: undefined, quota: undefined }),
    ]);

  const userDataBytes =
    utf8JsonBytes(spaces) +
    utf8JsonBytes(sessions) +
    utf8JsonBytes(privateNotes) +
    utf8JsonBytes(prayerBoard) +
    utf8JsonBytes(templates);

  return {
    bibleBytes: BIBLE_DATA_BYTES_ESTIMATE,
    userDataBytes,
    browserUsageBytes:
      typeof estimate.usage === "number" ? estimate.usage : null,
    browserQuotaBytes:
      typeof estimate.quota === "number" ? estimate.quota : null,
    spaces: spaces.length,
    sessions: sessions.length,
    privateNotes: privateNotes.length,
    prayerBoard: prayerBoard.length,
    templates: templates.length,
  };
}

function utf8JsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
