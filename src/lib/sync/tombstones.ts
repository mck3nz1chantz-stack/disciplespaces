/**
 * Shared-layer tombstones — deleted sessions / prayer board rows.
 * Propagate via room snapshot + Account Key vault so deletes are not revived
 * by merge-union. Never used for private notes.
 */

import { db, type SharedTombstoneKind, type SharedTombstoneRow } from "../db";
import { entityUpdatedAtMs, nowUpdatedAt } from "./merge";

export interface SnapshotTombstone {
  id: string;
  deletedAt: string;
}

export interface SharedTombstonesPayload {
  sessions: SnapshotTombstone[];
  prayerBoard: SnapshotTombstone[];
}

export function tombstoneKey(kind: SharedTombstoneKind, id: string): string {
  return `${kind}:${id}`;
}

export async function recordTombstone(
  spaceId: string,
  kind: SharedTombstoneKind,
  entityId: string,
  deletedAt: string = nowUpdatedAt(),
): Promise<void> {
  const id = entityId.trim();
  if (!spaceId || !id) return;
  const key = tombstoneKey(kind, id);
  const existing = await db.sharedTombstones.get(key);
  if (existing && entityUpdatedAtMs({ updatedAt: existing.deletedAt }) > entityUpdatedAtMs({ updatedAt: deletedAt })) {
    return;
  }
  const row: SharedTombstoneRow = {
    key,
    spaceId,
    kind,
    id,
    deletedAt,
  };
  await db.sharedTombstones.put(row);
}

export async function listTombstonesForSpace(
  spaceId: string,
): Promise<SharedTombstonesPayload> {
  const rows = await db.sharedTombstones
    .where("spaceId")
    .equals(spaceId)
    .toArray();
  const sessions: SnapshotTombstone[] = [];
  const prayerBoard: SnapshotTombstone[] = [];
  for (const r of rows) {
    const t = { id: r.id, deletedAt: r.deletedAt };
    if (r.kind === "session") sessions.push(t);
    else prayerBoard.push(t);
  }
  return { sessions, prayerBoard };
}

/** Merge two tombstone lists (LWW by deletedAt). */
export function mergeTombstoneLists(
  a: SnapshotTombstone[] | undefined,
  b: SnapshotTombstone[] | undefined,
): SnapshotTombstone[] {
  const map = new Map<string, SnapshotTombstone>();
  for (const list of [a ?? [], b ?? []]) {
    for (const t of list) {
      const id = String(t.id || "").trim();
      if (!id) continue;
      const prev = map.get(id);
      if (
        !prev ||
        entityUpdatedAtMs({ updatedAt: t.deletedAt }) >=
          entityUpdatedAtMs({ updatedAt: prev.deletedAt })
      ) {
        map.set(id, { id, deletedAt: t.deletedAt || nowUpdatedAt() });
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Drop live rows that are covered by a newer-or-equal tombstone.
 * If a live row is newer than its tombstone, resurrect (drop tombstone).
 */
export function applyTombstonesToEntities<
  T extends { id?: string; updatedAt?: string },
>(
  entities: T[],
  tombs: SnapshotTombstone[],
): { entities: T[]; tombstones: SnapshotTombstone[] } {
  const tombMap = new Map(
    tombs
      .filter((t) => t.id)
      .map((t) => [t.id, t] as const),
  );
  const kept: T[] = [];
  const remainingTombs = new Map(tombMap);

  for (const row of entities) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    const tomb = tombMap.get(id);
    if (!tomb) {
      kept.push(row);
      continue;
    }
    const liveMs = entityUpdatedAtMs(row);
    const delMs = entityUpdatedAtMs({ updatedAt: tomb.deletedAt });
    if (liveMs > delMs) {
      // Local/remote edit after delete → resurrect
      remainingTombs.delete(id);
      kept.push(row);
    }
    // else: tombstone wins — drop entity
  }

  return {
    entities: kept,
    tombstones: Array.from(remainingTombs.values()),
  };
}

/** Persist remote tombstones + delete local rows they cover. */
export async function applyRemoteTombstonesLocally(
  spaceId: string,
  payload: SharedTombstonesPayload | undefined,
): Promise<{ deletedSessions: number; deletedPrayers: number }> {
  if (!payload) return { deletedSessions: 0, deletedPrayers: 0 };
  let deletedSessions = 0;
  let deletedPrayers = 0;

  for (const t of payload.sessions ?? []) {
    const id = String(t.id || "").trim();
    if (!id) continue;
    await recordTombstone(spaceId, "session", id, t.deletedAt);
    const local = await db.sessions.get(id);
    if (local && local.spaceId === spaceId) {
      const liveMs = entityUpdatedAtMs(local);
      const delMs = entityUpdatedAtMs({ updatedAt: t.deletedAt });
      if (liveMs <= delMs) {
        await db.transaction("rw", db.sessions, db.privateNotes, async () => {
          // Keep private notes — they are device-local and not shared
          await db.sessions.delete(id);
        });
        deletedSessions += 1;
      }
    }
  }

  for (const t of payload.prayerBoard ?? []) {
    const id = String(t.id || "").trim();
    if (!id) continue;
    await recordTombstone(spaceId, "prayer", id, t.deletedAt);
    const local = await db.prayerBoard.get(id);
    if (local && local.spaceId === spaceId) {
      const liveMs = entityUpdatedAtMs(local);
      const delMs = entityUpdatedAtMs({ updatedAt: t.deletedAt });
      if (liveMs <= delMs) {
        await db.prayerBoard.delete(id);
        deletedPrayers += 1;
      }
    }
  }

  return { deletedSessions, deletedPrayers };
}
