import { useLiveQuery } from "dexie-react-hooks";
import { db, hydrateSpace, hydrateSpaces, type SpaceRow } from "../lib/db";
import type {
  PrayerBoardEntry,
  PrayerBoardScope,
  PrivateNote,
  Session,
  Space,
  Template,
} from "../types";

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date));
}

function sortPrivateNotes(notes: PrivateNote[]): PrivateNote[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function sortPrayerBoard(entries: PrayerBoardEntry[]): PrayerBoardEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Reactive list of hydrated spaces (newest activity via hydrate sessions). */
export function useLiveSpaces(): Space[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.spaces.orderBy("createdAt").reverse().toArray();
    return hydrateSpaces(rows);
  }, []);
}

/** Reactive single space (hydrated) or undefined while loading / null if missing. */
export function useLiveSpace(
  spaceId: string | undefined,
): Space | null | undefined {
  return useLiveQuery(async () => {
    if (!spaceId) return null;
    const row = await db.spaces.get(spaceId);
    if (!row) return null;
    return hydrateSpace(row);
  }, [spaceId]);
}

/** Reactive sessions for a space, newest first. */
export function useLiveSessions(
  spaceId: string | undefined,
): Session[] | undefined {
  return useLiveQuery(async () => {
    if (!spaceId) return [];
    const list = await db.sessions.where("spaceId").equals(spaceId).toArray();
    return sortSessions(list);
  }, [spaceId]);
}

/** Reactive templates (name order). */
export function useLiveTemplates(): Template[] | undefined {
  return useLiveQuery(() => db.templates.orderBy("name").toArray(), []);
}

/** Reactive space row without sessions (lighter). */
export function useLiveSpaceRow(
  spaceId: string | undefined,
): SpaceRow | null | undefined {
  return useLiveQuery(async () => {
    if (!spaceId) return null;
    return (await db.spaces.get(spaceId)) ?? null;
  }, [spaceId]);
}

/**
 * Device-local private notes for a space (never exported).
 * - sessionId omitted → all notes for the space
 * - sessionId set → notes for that session only (space-level excluded)
 * - sessionId === null → space-level only
 * - sectionKey string → only that section
 * - sectionKey === null → only unscoped notes
 * - sectionKey undefined → no section filter
 */
export function useLivePrivateNotes(opts: {
  spaceId: string | undefined;
  sessionId?: string | null;
  sectionKey?: string | null;
  /** When viewing a session, also include space-level notes. */
  includeSpaceLevel?: boolean;
}): PrivateNote[] | undefined {
  const { spaceId, sessionId, sectionKey, includeSpaceLevel } = opts;
  return useLiveQuery(async () => {
    if (!spaceId) return [];
    let list = await db.privateNotes.where("spaceId").equals(spaceId).toArray();

    if (sessionId) {
      list = list.filter((n) =>
        includeSpaceLevel
          ? n.sessionId === sessionId || !n.sessionId
          : n.sessionId === sessionId,
      );
    } else if (sessionId === null) {
      // Explicit space-level only
      list = list.filter((n) => !n.sessionId);
    }

    if (typeof sectionKey === "string") {
      list = list.filter((n) => n.sectionKey === sectionKey);
    } else if (sectionKey === null) {
      // Notes without a section key (general)
      list = list.filter((n) => !n.sectionKey);
    }

    return sortPrivateNotes(list);
  }, [spaceId, sessionId, sectionKey, includeSpaceLevel]);
}

/** Count of private notes for a session (badge), optional section. */
export function useLivePrivateNoteCount(
  spaceId: string | undefined,
  sessionId: string | undefined,
  sectionKey?: string,
): number | undefined {
  return useLiveQuery(async () => {
    if (!spaceId || !sessionId) return 0;
    return db.privateNotes
      .where("spaceId")
      .equals(spaceId)
      .filter((n) => {
        if (n.sessionId !== sessionId) return false;
        if (sectionKey !== undefined) return n.sectionKey === sectionKey;
        return true;
      })
      .count();
  }, [spaceId, sessionId, sectionKey]);
}

/** Shared prayer board for a space (exportable). Newest first. */
export function useLivePrayerBoard(
  spaceId: string | undefined,
  scope?: PrayerBoardScope | "all",
): PrayerBoardEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!spaceId) return [];
    let list = await db.prayerBoard.where("spaceId").equals(spaceId).toArray();
    if (scope && scope !== "all") {
      list = list.filter((e) => e.scope === scope);
    }
    return sortPrayerBoard(list);
  }, [spaceId, scope]);
}

export function useLivePrayerBoardCount(
  spaceId: string | undefined,
): number | undefined {
  return useLiveQuery(async () => {
    if (!spaceId) return 0;
    return db.prayerBoard.where("spaceId").equals(spaceId).count();
  }, [spaceId]);
}

/**
 * Open prayers across groups (home “Next up” chip).
 * Prefers the group with the most open entries; falls back to any non-closed.
 */
export function useLiveOpenPrayerSummary():
  | { spaceId: string; count: number }
  | null
  | undefined {
  return useLiveQuery(async () => {
    const all = await db.prayerBoard.toArray();
    // “Open” = still on the board for prayer (not closed)
    const open = all.filter((e) => e.status !== "closed");
    if (open.length === 0) return null;
    const bySpace = new Map<string, number>();
    for (const e of open) {
      bySpace.set(e.spaceId, (bySpace.get(e.spaceId) ?? 0) + 1);
    }
    let bestId = "";
    let bestCount = 0;
    for (const [id, n] of bySpace) {
      if (n > bestCount) {
        bestId = id;
        bestCount = n;
      }
    }
    if (!bestId) return null;
    return { spaceId: bestId, count: bestCount };
  }, []);
}
